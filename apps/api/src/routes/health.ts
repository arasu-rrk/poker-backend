import type { Hono } from "hono";
import type { ApiBindings } from "../types";

export function registerHealthRoutes(app: Hono<{ Bindings: ApiBindings }>): void {
  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "planning-poker-api"
    })
  );

  app.get("/health/ready", (context) =>
    context.json({
      status: "ready",
      service: "planning-poker-api",
      database: context.env.DB ? "configured" : "not_configured"
    })
  );
}
