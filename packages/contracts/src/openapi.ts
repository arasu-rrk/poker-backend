import { z } from "zod";
import {
  apiErrorSchema,
  errorResponseSchema,
  invitationRequestSchema,
  participantDisplayNameRequestSchema,
  participantRoleRequestSchema,
  paginatedResponseSchema,
  paginationSchema,
  pokerSessionSchema,
  publicRoomSnapshotSchema,
  roomCreateRequestSchema,
  roomJoinRequestSchema,
  roomSchema,
  roomUpdateRequestSchema,
  storySchema,
  successResponseSchema,
  userSchema,
  votingResultsSchema
} from "./schemas";

type JsonSchema = Record<string, unknown>;

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
  };
  jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema";
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, JsonSchema>;
  };
}

function toJsonSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema) as JsonSchema;
}

export function createOpenApiDocument(): OpenApiDocument {
  const schemas: Record<string, JsonSchema> = {
    User: toJsonSchema(userSchema),
    Room: toJsonSchema(roomSchema),
    RoomCreateRequest: toJsonSchema(roomCreateRequestSchema),
    RoomUpdateRequest: toJsonSchema(roomUpdateRequestSchema),
    RoomJoinRequest: toJsonSchema(roomJoinRequestSchema),
    InvitationRequest: toJsonSchema(invitationRequestSchema),
    ParticipantDisplayNameRequest: toJsonSchema(participantDisplayNameRequestSchema),
    ParticipantRoleRequest: toJsonSchema(participantRoleRequestSchema),
    PokerSession: toJsonSchema(pokerSessionSchema),
    Story: toJsonSchema(storySchema),
    PublicRoomSnapshot: toJsonSchema(publicRoomSnapshotSchema),
    VotingResults: toJsonSchema(votingResultsSchema),
    Pagination: toJsonSchema(paginationSchema),
    PaginatedItems: toJsonSchema(paginatedResponseSchema(storySchema)),
    ApiError: toJsonSchema(apiErrorSchema),
    SuccessResponse: toJsonSchema(successResponseSchema),
    ErrorResponse: toJsonSchema(errorResponseSchema)
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Planning Poker API",
      version: "1.0.0"
    },
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    paths: {
      "/health": {
        get: {
          operationId: "getHealth",
          summary: "Worker liveness",
          responses: {
            "200": {
              description: "Worker is alive",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["status", "service"],
                    properties: {
                      status: { type: "string", const: "ok" },
                      service: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/health/ready": {
        get: {
          operationId: "getReadiness",
          summary: "Worker and database readiness",
          responses: {
            "200": {
              description: "Worker is ready",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["status", "service", "database"],
                    properties: {
                      status: { type: "string", const: "ready" },
                      service: { type: "string" },
                      database: { type: "string", enum: ["configured", "not_configured"] }
                    }
                  },
                  "/api/v1/rooms": {
                    get: {
                      operationId: "listRooms",
                      responses: { "200": { description: "Rooms for the authenticated user" } }
                    },
                    post: {
                      operationId: "createRoom",
                      requestBody: {
                        required: true,
                        content: {
                          "application/json": {
                            schema: { $ref: "#/components/schemas/RoomCreateRequest" }
                          }
                        }
                      },
                      responses: { "201": { description: "Room created" } }
                    }
                  },
                  "/api/v1/rooms/join": {
                    post: {
                      operationId: "joinRoom",
                      requestBody: {
                        required: true,
                        content: {
                          "application/json": {
                            schema: { $ref: "#/components/schemas/RoomJoinRequest" }
                          }
                        }
                      },
                      responses: { "200": { description: "Joined room" } }
                    }
                  },
                  "/api/v1/rooms/{roomId}": {
                    get: {
                      operationId: "getRoom",
                      parameters: [
                        { name: "roomId", in: "path", required: true, schema: { type: "string" } }
                      ],
                      responses: { "200": { description: "Room details" } }
                    },
                    patch: {
                      operationId: "updateRoom",
                      requestBody: {
                        required: true,
                        content: {
                          "application/json": {
                            schema: { $ref: "#/components/schemas/RoomUpdateRequest" }
                          }
                        }
                      },
                      responses: { "200": { description: "Room updated" } }
                    },
                    delete: {
                      operationId: "deleteRoom",
                      responses: { "200": { description: "Room archived" } }
                    }
                  },
                  "/api/v1/rooms/{roomId}/invitations": {
                    post: {
                      operationId: "createRoomInvitation",
                      requestBody: {
                        required: true,
                        content: {
                          "application/json": {
                            schema: { $ref: "#/components/schemas/InvitationRequest" }
                          }
                        }
                      },
                      responses: { "201": { description: "Invitation created" } }
                    }
                  },
                  "/api/v1/rooms/{roomId}/participants": {
                    get: {
                      operationId: "listRoomParticipants",
                      responses: { "200": { description: "Room participants" } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas
    }
  };
}
