import { generateOpaqueToken, hashOpaqueToken } from "../auth/crypto";
import { ROOM_CONSTANTS } from "./constants";
import { RoomRepository, type RoomMemberRow, type RoomRow } from "./repository";

export class RoomServiceError extends Error {
  constructor(
    public readonly code:
      "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "OWNER_REMOVAL_FORBIDDEN",
    message: string
  ) {
    super(message);
  }
}

export class RoomService {
  constructor(private readonly repository: RoomRepository) {}

  async createRoom(input: {
    ownerId: string;
    name: string;
    description?: string | null;
    settings?: Record<string, unknown>;
  }) {
    const now = Date.now();
    const roomCode = await this.generateRoomCode();
    const roomId = crypto.randomUUID();
    await this.repository.createRoom({
      roomId,
      roomCode,
      name: input.name,
      description: input.description ?? null,
      ownerId: input.ownerId,
      settingsJson: JSON.stringify(
        input.settings ?? {
          deck: "fibonacci",
          allowSpecialValues: true,
          revealPolicy: "moderator"
        }
      ),
      now
    });
    const room = await this.repository.findRoomById(roomId);
    if (!room) throw new RoomServiceError("NOT_FOUND", "Room creation failed");
    return this.toRoom(room);
  }

  async listRooms(userId: string) {
    const rooms = await this.repository.listRoomsForUser(userId);
    return rooms.map((room) => this.toRoom(room));
  }

  async getRoom(roomId: string, userId: string) {
    const room = await this.repository.findRoomById(roomId);
    if (!room) throw new RoomServiceError("NOT_FOUND", "Room not found");
    await this.requireRoomAccess(room, userId);
    return this.toRoom(room);
  }

  async updateRoom(
    roomId: string,
    actorUserId: string,
    input: { name?: string; description?: string | null; settings?: Record<string, unknown> }
  ) {
    const room = await this.requireManageRoom(roomId, actorUserId);
    await this.repository.updateRoom({
      roomId,
      actorUserId,
      now: Date.now(),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.settings !== undefined ? { settingsJson: JSON.stringify(input.settings) } : {})
    });
    const updated = await this.repository.findRoomById(room.id);
    if (!updated) throw new RoomServiceError("NOT_FOUND", "Room not found");
    return this.toRoom(updated);
  }

  async deleteRoom(roomId: string, actorUserId: string) {
    const room = await this.requireManageRoom(roomId, actorUserId);
    const membership = await this.repository.getMembership(roomId, actorUserId);
    if (room.owner_id !== actorUserId || membership?.role !== "owner") {
      throw new RoomServiceError("FORBIDDEN", "Only the room owner can delete the room");
    }
    await this.repository.archiveRoom(roomId, actorUserId, Date.now());
  }

  async joinRoom(input: { userId: string; roomCode?: string; invitationToken?: string }) {
    let room: RoomRow | null = null;
    let role: "moderator" | "participant" | "observer" = "participant";

    if (input.roomCode) {
      room = await this.repository.findRoomByCode(input.roomCode);
    } else if (input.invitationToken) {
      const now = Date.now();
      const invitation = await this.repository.findInvitation(
        await hashOpaqueToken(input.invitationToken),
        now
      );
      if (!invitation) {
        throw new RoomServiceError("NOT_FOUND", "Invitation is invalid or expired");
      }
      room = await this.repository.findRoomById(invitation.room_id);
      role = invitation.invited_role;
      if (!room) throw new RoomServiceError("NOT_FOUND", "Room not found");
      await this.repository.acceptInvitation(
        invitation.id,
        invitation.room_id,
        input.userId,
        role,
        now
      );
      return this.toRoom(room);
    }

    if (!room) throw new RoomServiceError("NOT_FOUND", "Room not found");
    await this.repository.addMembership({
      roomId: room.id,
      userId: input.userId,
      role,
      now: Date.now()
    });
    return this.toRoom(room);
  }

  async createInvitation(
    roomId: string,
    actorUserId: string,
    input: {
      invitedEmail?: string;
      role?: "moderator" | "participant" | "observer";
      expiresInSeconds?: number;
    }
  ) {
    const membership = await this.requireRoomAccessByMember(roomId, actorUserId);
    const role = membership.role.toLowerCase();
    if (role !== "owner" && role !== "moderator") {
      throw new RoomServiceError("FORBIDDEN", "Only owners and moderators can invite participants");
    }

    const token = generateOpaqueToken();
    const tokenHash = await hashOpaqueToken(token);
    const ttl = input.expiresInSeconds
      ? input.expiresInSeconds * 1000
      : ROOM_CONSTANTS.invitationDefaultTtlMs;
    const expiresAt = Date.now() + ttl;
    await this.repository.createInvitation({
      id: crypto.randomUUID(),
      roomId,
      inviterUserId: actorUserId,
      invitedEmail: input.invitedEmail ?? null,
      role: input.role ?? "participant",
      tokenHash,
      expiresAt
    });
    return { invitationToken: token, expiresAt };
  }

  async listParticipants(roomId: string, actorUserId: string) {
    await this.requireRoomAccessByMember(roomId, actorUserId);
    const participants = await this.repository.listParticipants(roomId);
    return participants.map((participant) => this.toParticipant(participant));
  }

  async updateParticipant(
    roomId: string,
    actorUserId: string,
    input: { displayName: string; avatarUrl?: string | null }
  ) {
    await this.requireRoomAccessByMember(roomId, actorUserId);
    await this.repository.updateParticipant(roomId, actorUserId, {
      displayName: input.displayName,
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      now: Date.now()
    });
  }

  async changeRole(
    roomId: string,
    actorUserId: string,
    participantId: string,
    role: "moderator" | "participant" | "observer"
  ) {
    const membership = await this.requireRoomAccessByMember(roomId, actorUserId);
    const actorRole = membership.role.toLowerCase();
    if (actorRole !== "owner" && actorRole !== "moderator") {
      throw new RoomServiceError("FORBIDDEN", "Only owners and moderators can change roles");
    }
    const target = await this.repository.getMembership(roomId, participantId);
    if (!target) throw new RoomServiceError("NOT_FOUND", "Participant not found");
    if (target.role.toLowerCase() === "owner") {
      throw new RoomServiceError(
        "OWNER_REMOVAL_FORBIDDEN",
        "Owner role changes require a valid ownership-transfer process"
      );
    }
    await this.repository.changeRole({
      roomId,
      participantId,
      role,
      actorUserId,
      now: Date.now()
    });
  }

  async removeParticipant(roomId: string, actorUserId: string, participantId: string) {
    const membership = await this.requireRoomAccessByMember(roomId, actorUserId);
    const actorRole = membership.role.toLowerCase();
    const target = await this.repository.getMembership(roomId, participantId);
    if (!target) throw new RoomServiceError("NOT_FOUND", "Participant not found");
    if (target.role.toLowerCase() === "owner") {
      throw new RoomServiceError("OWNER_REMOVAL_FORBIDDEN", "The room owner cannot be removed");
    }
    if (actorUserId !== participantId && actorRole !== "owner" && actorRole !== "moderator") {
      throw new RoomServiceError("FORBIDDEN", "Only owners and moderators can remove participants");
    }
    await this.repository.removeParticipant({
      roomId,
      participantId,
      actorUserId,
      now: Date.now()
    });
  }

  private async requireManageRoom(roomId: string, userId: string) {
    const room = await this.repository.findRoomById(roomId);
    if (!room) throw new RoomServiceError("NOT_FOUND", "Room not found");
    const membership = await this.requireRoomAccessByMember(roomId, userId);
    const role = membership.role.toLowerCase();
    if (role !== "owner" && role !== "moderator") {
      throw new RoomServiceError("FORBIDDEN", "Room management permission required");
    }
    return room;
  }

  private async requireRoomAccess(room: RoomRow, userId: string) {
    if (room.owner_id === userId) return;
    const membership = await this.repository.getMembership(room.id, userId);
    if (!membership) throw new RoomServiceError("FORBIDDEN", "Room membership required");
  }

  private async requireRoomAccessByMember(roomId: string, userId: string) {
    const room = await this.repository.findRoomById(roomId);
    if (!room) throw new RoomServiceError("NOT_FOUND", "Room not found");
    await this.requireRoomAccess(room, userId);
    const membership = await this.repository.getMembership(roomId, userId);
    if (!membership) {
      throw new RoomServiceError("FORBIDDEN", "Room membership required");
    }
    return membership;
  }

  private async generateRoomCode(): Promise<string> {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CONSTANTS.roomCodeLength));
      const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
      if (!(await this.repository.roomCodeExists(code))) return code;
    }
    throw new RoomServiceError("CONFLICT", "Unable to generate a unique room code");
  }

  private toRoom(room: RoomRow) {
    let settings: Record<string, unknown>;
    try {
      settings = JSON.parse(room.settings_json) as Record<string, unknown>;
    } catch {
      settings = {};
    }
    return {
      id: room.id,
      roomCode: room.room_code,
      name: room.name,
      description: room.description,
      ownerId: room.owner_id,
      settings,
      isActive: Boolean(room.is_active),
      createdAt: new Date(room.created_at).toISOString(),
      updatedAt: new Date(room.updated_at).toISOString(),
      deletedAt: room.deleted_at ? new Date(room.deleted_at).toISOString() : null
    };
  }

  private toParticipant(participant: RoomMemberRow) {
    const now = Date.now();
    const lastSeen = participant.last_seen_at;
    const isConnected =
      participant.is_active === 1 &&
      lastSeen !== null &&
      now - lastSeen <= ROOM_CONSTANTS.participantOnlineWindowMs;
    return {
      id: participant.id,
      userId: participant.user_id,
      displayName: participant.display_name,
      avatarUrl: participant.avatar_url,
      role: participant.role,
      isModerator:
        participant.role.toLowerCase() === "moderator" ||
        participant.role.toLowerCase() === "owner",
      isConnected
    };
  }
}
