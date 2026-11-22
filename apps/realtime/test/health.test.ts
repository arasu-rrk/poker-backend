import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { RealtimeBindings } from "../src/types";

const bindings = {
  ENVIRONMENT: "development",
  REALTIME_ALLOWED_ORIGINS: "http://localhost:3000"
} as unknown as RealtimeBindings;

describe("Realtime Worker", () => {
  it("returns liveness status", async () => {
    const response = await worker.fetch(new Request("https://example.com/health"), bindings);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "planning-poker-realtime"
    });
  });

  it("rejects room HTTP requests without a WebSocket upgrade", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/rooms/test-room/ws"),
      bindings
    );
    expect(response.status).toBe(426);
  });
});
