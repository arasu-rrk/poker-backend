import { describe, expect, it } from "vitest";
import { correlationIdSchema } from "../src/schemas";

describe("shared contracts", () => {
  it("validates correlation IDs", () => {
    expect(correlationIdSchema.parse("  request-123  ")).toBe("request-123");
  });
});
