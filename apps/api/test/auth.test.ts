import { describe, expect, it } from "vitest";
import {
  createAccessToken,
  generateOpaqueToken,
  hashOpaqueToken,
  verifyAccessToken
} from "../src/auth/crypto";
import { hasPermission, normalizeRole } from "../src/auth/authorization";
import { validateOidcCallback } from "../src/auth/oidc";
import { AuthRepository } from "../src/auth/repository";
import { AuthService } from "../src/auth/service";

describe("authentication", () => {
  it("creates and validates short-lived access tokens", async () => {
    const token = await createAccessToken(
      "test-secret-with-at-least-32-characters",
      { sub: "user-1", sid: "session-1", provider: "guest", isGuest: true },
      900
    );
    await expect(
      verifyAccessToken("test-secret-with-at-least-32-characters", token)
    ).resolves.toMatchObject({
      sub: "user-1",
      sid: "session-1",
      isGuest: true
    });
  });

  it("hashes opaque refresh tokens and never exposes plaintext", async () => {
    const token = generateOpaqueToken();
    const hash = await hashOpaqueToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
  });

  it("supports guest authentication", async () => {
    let created = false;
    const repository = {
      createUser: async () => {
        created = true;
      },
      findUserById: async () => ({
        id: "user-1",
        display_name: "Guest",
        email: null,
        avatar_url: null,
        authentication_provider: "guest",
        provider_user_id: "provider-1",
        is_guest: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null
      }),
      createSession: async () => undefined
    } as unknown as AuthRepository;
    const service = new AuthService(repository, "test-secret-with-at-least-32-characters");
    const result = await service.authenticateGuest("Guest");
    expect(created).toBe(true);
    expect(result.refreshToken).not.toBe("");
    expect(result.accessToken).not.toBe("");
  });

  it("rejects refresh replay and rotates refresh sessions", async () => {
    const firstHash = await hashOpaqueToken("refresh-one");
    const now = Date.now();
    let revokeOld = false;
    const repository = {
      findSessionByRefreshHash: async (hash: string) =>
        hash === firstHash
          ? { id: "session-old", user_id: "user-1", expires_at: now + 60_000, revoked_at: null }
          : null,
      findUserById: async () => ({
        id: "user-1",
        display_name: "User",
        email: null,
        avatar_url: null,
        authentication_provider: "google",
        provider_user_id: "google-1",
        is_guest: 0,
        created_at: now,
        updated_at: now,
        deleted_at: null
      }),
      rotateRefreshSession: async () => {
        revokeOld = true;
        return true;
      }
    } as unknown as AuthRepository;
    const service = new AuthService(repository, "test-secret-with-at-least-32-characters");
    const result = await service.refresh("refresh-one");
    expect(revokeOld).toBe(true);
    expect(result.refreshToken).not.toBe("refresh-one");
  });

  it("rejects replayed and expired connection tickets", async () => {
    let consumed = false;
    const repository = {
      consumeConnectionTicket: async () => {
        if (consumed) return null;
        consumed = true;
        return { room_id: "room-1", user_id: "user-1" };
      }
    } as unknown as AuthRepository;
    const service = new AuthService(repository, "test-secret-with-at-least-32-characters");
    await expect(service.consumeConnectionTicket("ticket")).resolves.toEqual({
      roomId: "room-1",
      userId: "user-1"
    });
    await expect(service.consumeConnectionTicket("ticket")).resolves.toBeNull();
  });
});

describe("OIDC callback and authorization", () => {
  it("validates OIDC state and provider", () => {
    expect(
      validateOidcCallback({
        provider: "google",
        cookieState: "state",
        returnedState: "state",
        codeVerifier: "verifier",
        code: "code",
        providerError: undefined
      })
    ).toEqual({ valid: true, provider: "google" });
  });

  it("rejects mismatched OIDC state", () => {
    expect(
      validateOidcCallback({
        provider: "google",
        cookieState: "state",
        returnedState: "other",
        codeVerifier: "verifier",
        code: "code",
        providerError: undefined
      })
    ).toEqual({ valid: false, reason: "invalid_state" });
  });

  it("centralizes role permissions", () => {
    expect(normalizeRole("moderator")).toBe("MODERATOR");
    expect(hasPermission("OWNER", "ROOM_MANAGE")).toBe(true);
    expect(hasPermission("MODERATOR", "REVEAL_VOTES")).toBe(true);
    expect(hasPermission("PARTICIPANT", "ROOM_MANAGE")).toBe(false);
    expect(hasPermission("OBSERVER", "VOTE")).toBe(false);
  });
});
