export const ROOM_CONSTANTS = {
  roomCodeLength: 10,
  invitationDefaultTtlMs: 7 * 24 * 60 * 60 * 1000,
  participantOnlineWindowMs: 2 * 60 * 1000
} as const;

export const ROOM_ERROR_CODES = {
  invalidRequest: "VALIDATION_ERROR",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  notFound: "NOT_FOUND",
  conflict: "CONFLICT",
  ownerRemovalForbidden: "OWNER_REMOVAL_FORBIDDEN"
} as const;
