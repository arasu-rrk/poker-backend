import { SignJWT, jwtVerify } from "jose";
import { AUTH_CONSTANTS, AUTH_ERROR_CODES, JWT_CONSTANTS } from "./constants";

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  provider: "guest" | "google" | "microsoft";
  isGuest: boolean;
}

export async function createAccessToken(
  secret: string,
  claims: AccessTokenClaims,
  expiresInSeconds = AUTH_CONSTANTS.accessTokenTtlSeconds
): Promise<string> {
  return new SignJWT({
    sid: claims.sid,
    provider: claims.provider,
    isGuest: claims.isGuest
  })
    .setProtectedHeader({ alg: JWT_CONSTANTS.algorithm, typ: JWT_CONSTANTS.type })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer(JWT_CONSTANTS.issuer)
    .setAudience(JWT_CONSTANTS.audience)
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(secret: string, token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: JWT_CONSTANTS.issuer,
    audience: JWT_CONSTANTS.audience,
    algorithms: [JWT_CONSTANTS.algorithm]
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    (payload.provider !== "guest" &&
      payload.provider !== "google" &&
      payload.provider !== "microsoft") ||
    typeof payload.isGuest !== "boolean"
  ) {
    throw new Error(AUTH_ERROR_CODES.invalidAccessTokenClaims);
  }
  return {
    sub: payload.sub,
    sid: payload.sid,
    provider: payload.provider,
    isGuest: payload.isGuest
  };
}

export function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(AUTH_CONSTANTS.opaqueTokenBytes));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
