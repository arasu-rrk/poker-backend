import { describe, expect, it } from "vitest";
import {
  roomCreateRequestSchema,
  roomJoinRequestSchema,
  participantRoleRequestSchema
} from "@planning-poker/contracts";
import { RoomRepository } from "../src/rooms/repository";
import { RoomService, RoomServiceError } from "../src/rooms/service";

function roomRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "room-1",
    room_code: "ABCD234567",
    name: "Sprint",
    description: null,
    owner_id: "owner-1",
    settings_json: '{"deck":"fibonacci","allowSpecialValues":true,"revealPolicy":"moderator"}',
    is_active: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    ...overrides
  };
}

describe("room contracts", () => {
  it("validates room creation and join requests", () => {
    expect(
      roomCreateRequestSchema.parse({
        name: "Sprint",
        description: null,
        settings: {
          deck: "fibonacci",
          allowSpecialValues: true,
          revealPolicy: "moderator"
        }
      }).name
    ).toBe("Sprint");
    expect(roomJoinRequestSchema.parse({ roomCode: "ABCD234567" }).roomCode).toBe("ABCD234567");
  });

  it("validates participant role changes", () => {
    expect(participantRoleRequestSchema.parse({ role: "observer" }).role).toBe("observer");
  });
});

describe("room service", () => {
  it("creates a room with a unique room code", async () => {
    const repository = {
      roomCodeExists: async () => false,
      createRoom: async () => undefined,
      findRoomById: async () => roomRow()
    } as unknown as RoomRepository;
    const room = await new RoomService(repository).createRoom({
      ownerId: "owner-1",
      name: "Sprint"
    });
    expect(room.roomCode).toHaveLength(10);
  });

  it("joins a room by code without creating a duplicate membership", async () => {
    let membershipCalls = 0;
    const repository = {
      findRoomByCode: async () => roomRow(),
      addMembership: async () => {
        membershipCalls += 1;
        return false;
      }
    } as unknown as RoomRepository;
    const room = await new RoomService(repository).joinRoom({
      userId: "participant-1",
      roomCode: "ABCD234567"
    });
    expect(room.id).toBe("room-1");
    expect(membershipCalls).toBe(1);
  });

  it("prevents unauthorized room updates", async () => {
    const repository = {
      findRoomById: async () => roomRow(),
      getMembership: async () => ({
        id: "member-1",
        room_id: "room-1",
        user_id: "participant-1",
        role: "participant",
        joined_at: Date.now(),
        last_seen_at: null,
        is_active: 1,
        display_name: "Participant",
        email: null,
        avatar_url: null
      })
    } as unknown as RoomRepository;
    await expect(
      new RoomService(repository).updateRoom("room-1", "participant-1", { name: "Updated" })
    ).rejects.toMatchObject<Partial<RoomServiceError>>({ code: "FORBIDDEN" });
  });

  it("prevents removal of the room owner", async () => {
    const ownerMembership = {
      id: "owner-member",
      room_id: "room-1",
      user_id: "owner-1",
      role: "owner",
      joined_at: Date.now(),
      last_seen_at: null,
      is_active: 1,
      display_name: "Owner",
      email: null,
      avatar_url: null
    };
    const repository = {
      findRoomById: async () => roomRow(),
      getMembership: async (_roomId: string, userId: string) =>
        userId === "owner-1" ? ownerMembership : ownerMembership
    } as unknown as RoomRepository;
    await expect(
      new RoomService(repository).removeParticipant("room-1", "owner-1", "owner-1")
    ).rejects.toMatchObject<Partial<RoomServiceError>>({
      code: "OWNER_REMOVAL_FORBIDDEN"
    });
  });

  it("rejects invalid or expired invitations", async () => {
    const repository = {
      findInvitation: async () => null
    } as unknown as RoomRepository;
    await expect(
      new RoomService(repository).joinRoom({
        userId: "participant-1",
        invitationToken: "0123456789012345678901234567890123456789"
      })
    ).rejects.toMatchObject<Partial<RoomServiceError>>({ code: "NOT_FOUND" });
  });
});
