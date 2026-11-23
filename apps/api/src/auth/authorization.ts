export type AuthorizationRole = "OWNER" | "MODERATOR" | "PARTICIPANT" | "OBSERVER";

export type Permission =
  | "ROOM_MANAGE"
  | "PARTICIPANT_MANAGE"
  | "SESSION_MANAGE"
  | "STORY_MANAGE"
  | "VOTE"
  | "REVEAL_VOTES"
  | "UPDATE_ROOM_SETTINGS";

const permissions: Record<AuthorizationRole, readonly Permission[]> = {
  OWNER: [
    "ROOM_MANAGE",
    "PARTICIPANT_MANAGE",
    "SESSION_MANAGE",
    "STORY_MANAGE",
    "VOTE",
    "REVEAL_VOTES",
    "UPDATE_ROOM_SETTINGS"
  ],
  MODERATOR: [
    "PARTICIPANT_MANAGE",
    "SESSION_MANAGE",
    "STORY_MANAGE",
    "VOTE",
    "REVEAL_VOTES",
    "UPDATE_ROOM_SETTINGS"
  ],
  PARTICIPANT: ["VOTE"],
  OBSERVER: []
};

export function normalizeRole(role: string): AuthorizationRole | null {
  const normalized = role.toUpperCase();
  if (
    normalized === "OWNER" ||
    normalized === "MODERATOR" ||
    normalized === "PARTICIPANT" ||
    normalized === "OBSERVER"
  ) {
    return normalized;
  }
  return null;
}

export function hasPermission(role: AuthorizationRole, permission: Permission): boolean {
  return permissions[role].includes(permission);
}
