import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  apiErrorSchema,
  authenticationSchema,
  correlationIdSchema,
  hiddenVotingStateSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  paginationSchema,
  participantSchema,
  pokerSessionSchema,
  publicRoomSnapshotSchema,
  revealedVotingStateSchema,
  roomMemberSchema,
  roomSchema,
  roomSettingsSchema,
  storySchema,
  successResponseSchema,
  userSchema,
  voteSchema,
  votingResultsSchema,
  votingRoundSchema
} from "../src/schemas";
import {
  joinRoomPayloadSchema,
  selectVotePayloadSchema,
  websocketCommandSchema,
  websocketEventSchema,
  websocketMessageSchema
} from "../src/protocol";
import { createOpenApiDocument } from "../src/openapi";
import type { WebSocketMessage } from "../src/protocol";

const id = "550e8400-e29b-41d4-a716-446655440000";
const timestamp = "2026-11-22T23:41:21.429Z";

const baseUser = {
  id,
  displayName: "Alice",
  email: "alice@example.com",
  avatarUrl: null,
  authenticationProvider: "github",
  isGuest: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null
};

describe("shared DTO schemas", () => {
  it("validates user and authentication contracts", () => {
    expect(userSchema.parse(baseUser).displayName).toBe("Alice");
    expect(
      authenticationSchema.parse({
        type: "authenticated",
        accessToken: "access",
        refreshToken: "refresh",
        user: baseUser
      }).type
    ).toBe("authenticated");
  });

  it("validates room, member, participant, session and story contracts", () => {
    const settings = roomSettingsSchema.parse({
      deck: "fibonacci",
      allowSpecialValues: true
    });
    const room = roomSchema.parse({
      id,
      roomCode: "SPRINT-1",
      name: "Sprint Planning",
      description: null,
      ownerId: id,
      settings,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null
    });
    expect(room.roomCode).toBe("SPRINT-1");

    expect(
      roomMemberSchema.parse({
        id,
        roomId: id,
        userId: id,
        role: "participant",
        joinedAt: timestamp,
        lastSeenAt: null,
        isActive: true
      }).role
    ).toBe("participant");

    expect(
      participantSchema.parse({
        id,
        userId: id,
        displayName: "Alice",
        avatarUrl: null,
        role: "participant",
        isModerator: false,
        isConnected: true
      }).isConnected
    ).toBe(true);

    expect(
      pokerSessionSchema.parse({
        id,
        roomId: id,
        name: "Sprint 1",
        status: "active",
        startedAt: timestamp,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      }).status
    ).toBe("active");

    expect(
      storySchema.parse({
        id,
        sessionId: id,
        title: "Story",
        description: null,
        acceptanceCriteria: null,
        ticketUrl: null,
        displayOrder: 0,
        status: "pending",
        finalEstimate: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null
      }).displayOrder
    ).toBe(0);
  });

  it("validates rounds, votes and revealed results", () => {
    const round = votingRoundSchema.parse({
      id,
      storyId: id,
      sessionId: id,
      roundNumber: 1,
      status: "revealed",
      revealedAt: timestamp,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    expect(round.roundNumber).toBe(1);

    expect(
      voteSchema.parse({
        id,
        votingRoundId: id,
        userId: id,
        voteType: "special",
        numericValue: null,
        specialValue: "☕",
        submittedAt: timestamp,
        updatedAt: timestamp
      }).specialValue
    ).toBe("☕");

    expect(
      votingResultsSchema.parse({
        roundId: id,
        revealed: true,
        average: 5,
        minimum: 3,
        maximum: 8,
        distribution: { "3": 1, "5": 1, "8": 1 },
        votes: [
          {
            participantId: id,
            displayName: "Alice",
            voteType: "numeric",
            numericValue: 5,
            specialValue: null
          }
        ]
      }).average
    ).toBe(5);
  });

  it("validates API responses and pagination", () => {
    expect(successResponseSchema.parse({ data: { id } }).data).toEqual({ id });
    expect(
      apiErrorSchema.parse({
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        correlationId: "request-123",
        details: [{ path: ["name"], message: "Required", code: "invalid_type" }]
      }).code
    ).toBe("VALIDATION_ERROR");
    expect(
      paginationSchema.parse({
        page: 1,
        pageSize: 20,
        totalItems: 21,
        totalPages: 2
      }).totalPages
    ).toBe(2);

    expect(
      paginationQuerySchema.parse({
        page: "2",
        pageSize: "10",
        sortDirection: "desc"
      })
    ).toEqual({
      page: 2,
      pageSize: 10,
      sortDirection: "desc"
    });

    expect(
      paginatedResponseSchema(storySchema).parse({
        data: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }
      }).data
    ).toEqual([]);
  });

  it("provides type inference for DTO schemas", () => {
    type User = z.infer<typeof userSchema>;
    const inferredUser: User = baseUser;
    expect(inferredUser.id).toBe(id);

    type Message = WebSocketMessage<"JOIN_ROOM", { roomCode: string }>;
    const message: Message = {
      version: "1",
      type: "JOIN_ROOM",
      messageId: id,
      timestamp,
      payload: { roomCode: "SPRINT-1" }
    };
    expect(message.type).toBe("JOIN_ROOM");
  });
});

describe("API and WebSocket contracts", () => {
  it("accepts valid command envelopes", () => {
    expect(joinRoomPayloadSchema.parse({ roomCode: "SPRINT-1" }).roomCode).toBe("SPRINT-1");
    expect(
      selectVotePayloadSchema.parse({
        roundId: id,
        voteType: "numeric",
        numericValue: 5
      }).numericValue
    ).toBe(5);

    const command = {
      version: "1",
      type: "JOIN_ROOM",
      messageId: id,
      timestamp,
      payload: { roomCode: "SPRINT-1" }
    };
    expect(websocketCommandSchema.parse(command)).toMatchObject({ type: "JOIN_ROOM" });
    expect(websocketMessageSchema.parse(command)).toMatchObject({ type: "JOIN_ROOM" });
  });

  it("rejects invalid WebSocket versions and payloads", () => {
    expect(() =>
      websocketCommandSchema.parse({
        version: "2",
        type: "JOIN_ROOM",
        messageId: id,
        timestamp,
        payload: { roomCode: "SPRINT-1" }
      })
    ).toThrow();
    expect(() =>
      selectVotePayloadSchema.parse({
        roundId: id,
        voteType: "numeric",
        specialValue: "?"
      })
    ).toThrow();
  });

  it("validates event envelopes without exposing hidden values", () => {
    const event = {
      version: "1",
      type: "VOTE_SUBMITTED",
      messageId: id,
      timestamp,
      payload: { roundId: id, participantId: id, hasVoted: true }
    };
    expect(websocketEventSchema.parse(event)).toMatchObject({ type: "VOTE_SUBMITTED" });
  });

  it("creates an OpenAPI 3.1 document with reusable contract components", () => {
    const document = createOpenApiDocument();
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/health"]).toBeDefined();
    expect(document.components.schemas.Room).toBeDefined();
  });
});

describe("hidden vote privacy", () => {
  it("allows hidden state to contain only identity and has-voted status", () => {
    const hidden = hiddenVotingStateSchema.parse({
      roundId: id,
      status: "hidden",
      participants: [{ participantId: id, displayName: "Alice", hasVoted: true }],
      voteCount: 1,
      participantCount: 3
    });
    expect(hidden.participants[0]?.hasVoted).toBe(true);
  });

  it("rejects hidden vote values and requires revealed state for values", () => {
    expect(() =>
      hiddenVotingStateSchema.parse({
        roundId: id,
        status: "hidden",
        participants: [
          { participantId: id, displayName: "Alice", hasVoted: true, numericValue: 5 }
        ],
        voteCount: 1,
        participantCount: 1
      })
    ).toThrow();

    expect(
      revealedVotingStateSchema.parse({
        roundId: id,
        status: "revealed",
        votes: [
          {
            participantId: id,
            displayName: "Alice",
            voteType: "numeric",
            numericValue: 5,
            specialValue: null
          }
        ],
        voteCount: 1
      }).status
    ).toBe("revealed");
  });

  it("rejects unrevealed values in public room snapshots", () => {
    expect(() =>
      publicRoomSnapshotSchema.parse({
        room: {
          id,
          roomCode: "SPRINT-1",
          name: "Sprint",
          description: null,
          ownerId: id,
          settings: {
            deck: "fibonacci",
            allowSpecialValues: true,
            revealPolicy: "moderator"
          },
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null
        },
        session: null,
        story: null,
        round: null,
        participants: [],
        voting: {
          roundId: id,
          status: "hidden",
          participants: [
            { participantId: id, displayName: "Alice", hasVoted: true, numericValue: 5 }
          ],
          voteCount: 1,
          participantCount: 1
        }
      })
    ).toThrow();
  });

  it("trims and validates the correlation ID", () => {
    expect(correlationIdSchema.parse("  request-123  ")).toBe("request-123");
  });
});
