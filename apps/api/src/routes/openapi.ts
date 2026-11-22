import type { Hono } from "hono";
import { createOpenApiDocument } from "@planning-poker/contracts";
import type { ApiBindings } from "../types";

export function registerOpenApiRoute(app: Hono<{ Bindings: ApiBindings }>): void {
  app.get("/openapi.json", (context) => context.json(createOpenApiDocument()));
}
