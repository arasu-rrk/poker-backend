import type { Context, Next } from "hono";
import type { ApiBindings } from "../types";
import { verifyAccessToken } from "./crypto";

export async function requireAccessToken(
  context: Context<{ Bindings: ApiBindings }>,
  next: Next
): Promise<Response | void> {
  const authorization = context.req.header("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  if (!token) {
    return context.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Access token is required",
          correlationId: context.res.headers.get("x-correlation-id")
        }
      },
      401
    );
  }
  try {
    const secret = context.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET_NOT_CONFIGURED");
    const claims = await verifyAccessToken(secret, token);
    void claims;
    await next();
  } catch {
    return context.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Access token is invalid or expired",
          correlationId: context.res.headers.get("x-correlation-id")
        }
      },
      401
    );
  }
}
