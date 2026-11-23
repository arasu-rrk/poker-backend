import type { Context } from "hono";
import { z } from "zod";
import {
  invitationRequestSchema,
  participantDisplayNameRequestSchema,
  participantRoleRequestSchema,
  roomCreateRequestSchema,
  roomJoinRequestSchema,
  roomUpdateRequestSchema
} from "@planning-poker/contracts";
import { verifyAccessToken } from "../auth/crypto";
import type { ApiBindings } from "../types";
import { RoomServiceError } from "./service";

type RoomContext = Context<{ Bindings: ApiBindings }>;

export async function getAuthenticatedUserId(context: RoomContext): Promise<string | null> {
  const authorization = context.req.header("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !context.env.JWT_SECRET) return null;
  const claims = await verifyAccessToken(context.env.JWT_SECRET, token).catch(() => null);
  return claims?.sub ?? null;
}

export function validationResponse(context: RoomContext, error: z.ZodError) {
  return context.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        correlationId: context.res.headers.get("x-correlation-id"),
        details: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code
        }))
      }
    },
    400
  );
}

export function roomErrorResponse(context: RoomContext, error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return context.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          correlationId: context.res.headers.get("x-correlation-id")
        }
      },
      401
    );
  }
  if (error instanceof RoomServiceError) {
    const status =
      error.code === "UNAUTHORIZED"
        ? 401
        : error.code === "FORBIDDEN" || error.code === "OWNER_REMOVAL_FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "CONFLICT"
              ? 409
              : 500;
    return context.json(
      {
        error: {
          code: error.code,
          message: error.message,
          correlationId: context.res.headers.get("x-correlation-id")
        }
      },
      status
    );
  }
  return context.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected room service error",
        correlationId: context.res.headers.get("x-correlation-id")
      }
    },
    500
  );
}

export const roomCreateRequest = roomCreateRequestSchema;
export const roomUpdateRequest = roomUpdateRequestSchema;
export const roomJoinRequest = roomJoinRequestSchema;
export const invitationRequest = invitationRequestSchema;
export const participantDisplayNameRequest = participantDisplayNameRequestSchema;
export const participantRoleRequest = participantRoleRequestSchema;
