import { SignJWT, jwtVerify } from "jose";

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  provider: "guest" | "google" | "microsoft";
  isGuest: boolean;
}

export async function createAccessToken(
  secret: string,
  claims: AccessTokenClaims,
  expiresInSeconds = 900
): Promise<string> {
  return new SignJWT({
    sid: claims.sid,
    provider: claims.provider,
    isGuest: claims.isGuest
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("planning-poker")
    .setAudience("planning-poker-api")
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(secret: string, token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: "planning-poker",
    audience: "planning-poker-api",
    algorithms: ["HS256"]
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    (payload.provider !== "guest" &&
      payload.provider !== "google" &&
      payload.provider !== "microsoft") ||
    typeof payload.isGuest !== "boolean"
  ) {
    throw new Error("INVALID_ACCESS_TOKEN_CLAIMS");
  }
  return {
    sub: payload.sub,
    sid: payload.sid,
    provider: payload.provider,
    isGuest: payload.isGuest
  };
}

export function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
