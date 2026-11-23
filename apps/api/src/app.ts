import { Hono } from "hono";
import { cors } from "hono/cors";
import { createCorrelationId } from "./correlation";
import { structuredLog } from "./logger";
import { registerHealthRoutes } from "./routes/health";
import { registerOpenApiRoute } from "./routes/openapi";
import { registerAuthRoutes } from "./auth/routes";
import { registerRoomRoutes } from "./rooms/routes";
import type { ApiBindings } from "./types";
export function createApp() {
  const app = new Hono<{ Bindings: ApiBindings }>();

  app.use("*", async (context, next) => {
    const correlationId = createCorrelationId(context.req.raw);
    const startedAt = Date.now();
    context.header("x-correlation-id", correlationId);

    const allowedOrigins = (context.env.API_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (allowedOrigins.length > 0) {
      await cors({
        origin: allowedOrigins,
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
        exposeHeaders: ["X-Correlation-ID"],
        credentials: true
      })(context, next);
    } else {
      await next();
    }

    structuredLog(context.env.LOG_LEVEL ?? "info", "http_request", {
      correlationId,
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Date.now() - startedAt
    });
  });

  registerHealthRoutes(app);
  registerOpenApiRoute(app);
  registerAuthRoutes(app);
  registerRoomRoutes(app);

  app.notFound((context) =>
    context.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "The requested route was not found",
          correlationId: context.res.headers.get("x-correlation-id")
        }
      },
      404
    )
  );

  app.onError((error, context) => {
    const correlationId = context.res.headers.get("x-correlation-id");
    structuredLog("error", "unhandled_error", {
      correlationId: correlationId ?? "unknown",
      error: error.message
    });
    return context.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          correlationId
        }
      },
      500
    );
  });

  return app;
}
