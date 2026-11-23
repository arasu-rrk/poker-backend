export const AUTH_CONSTANTS = {
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlMs: 30 * 24 * 60 * 60 * 1000,
  connectionTicketTtlMs: 60 * 1000,
  oidcStateTtlSeconds: 10 * 60,
  opaqueTokenBytes: 32,
  refreshCookieMaxAgeSeconds: 30 * 24 * 60 * 60
} as const;

export const JWT_CONSTANTS = {
  algorithm: "HS256",
  issuer: "planning-poker",
  audience: "planning-poker-api",
  type: "JWT"
} as const;

export const AUTH_COOKIE_NAMES = {
  refreshToken: "refresh_token",
  oidcState: "oidc_state",
  oidcVerifier: "oidc_verifier",
  oidcProvider: "oidc_provider"
} as const;

export const AUTH_ERROR_CODES = {
  invalidAccessTokenClaims: "INVALID_ACCESS_TOKEN_CLAIMS",
  invalidRefreshToken: "INVALID_REFRESH_TOKEN",
  refreshReplayDetected: "REFRESH_REPLAY_DETECTED",
  oidcUserCreationFailed: "OIDC_USER_CREATION_FAILED",
  oidcSubjectMissing: "OIDC_SUBJECT_MISSING",
  roomNotFound: "ROOM_NOT_FOUND",
  roomMembershipRequired: "ROOM_MEMBERSHIP_REQUIRED",
  jwtSecretNotConfigured: "JWT_SECRET_NOT_CONFIGURED",
  databaseNotConfigured: "DATABASE_NOT_CONFIGURED"
} as const;
