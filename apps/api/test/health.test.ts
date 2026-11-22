import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { ApiBindings } from "../src/types";

const bindings: ApiBindings = {
  ENVIRONMENT: "development",
  API_ALLOWED_ORIGINS: "http://localhost:3000",
  LOG_LEVEL: "error"
};

describe("API health endpoints", () => {
  it("returns liveness status", async () => {
    const response = await createApp().request("/health", {}, bindings);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "planning-poker-api"
    });
  });

  it("returns readiness status", async () => {
    const response = await createApp().request("/health/ready", {}, bindings);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ready",
      service: "planning-poker-api"
    });
  });

  it("adds a correlation ID", async () => {
    const response = await createApp().request(
      "/health",
      { headers: { "X-Correlation-ID": "test-correlation-id" } },
      bindings
    );
    expect(response.headers.get("x-correlation-id")).toBe("test-correlation-id");
  });
});
