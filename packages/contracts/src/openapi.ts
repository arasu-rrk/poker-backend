import { z } from "zod";
import {
  apiErrorSchema,
  errorResponseSchema,
  paginatedResponseSchema,
  paginationSchema,
  pokerSessionSchema,
  publicRoomSnapshotSchema,
  roomSchema,
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
