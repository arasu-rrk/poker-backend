export const AUTHORIZATION_ROLES = {
  owner: "OWNER",
  moderator: "MODERATOR",
  participant: "PARTICIPANT",
  observer: "OBSERVER"
} as const;

export const AUTHORIZATION_PERMISSIONS = {
  roomManage: "ROOM_MANAGE",
  participantManage: "PARTICIPANT_MANAGE",
  sessionManage: "SESSION_MANAGE",
  storyManage: "STORY_MANAGE",
  vote: "VOTE",
  revealVotes: "REVEAL_VOTES",
  updateRoomSettings: "UPDATE_ROOM_SETTINGS"
} as const;

export type AuthorizationRole = (typeof AUTHORIZATION_ROLES)[keyof typeof AUTHORIZATION_ROLES];

export type Permission = (typeof AUTHORIZATION_PERMISSIONS)[keyof typeof AUTHORIZATION_PERMISSIONS];

const permissions: Record<AuthorizationRole, readonly Permission[]> = {
  [AUTHORIZATION_ROLES.owner]: [
    AUTHORIZATION_PERMISSIONS.roomManage,
    AUTHORIZATION_PERMISSIONS.participantManage,
    AUTHORIZATION_PERMISSIONS.sessionManage,
    AUTHORIZATION_PERMISSIONS.storyManage,
    AUTHORIZATION_PERMISSIONS.vote,
    AUTHORIZATION_PERMISSIONS.revealVotes,
    AUTHORIZATION_PERMISSIONS.updateRoomSettings
  ],
  [AUTHORIZATION_ROLES.moderator]: [
    AUTHORIZATION_PERMISSIONS.participantManage,
    AUTHORIZATION_PERMISSIONS.sessionManage,
    AUTHORIZATION_PERMISSIONS.storyManage,
    AUTHORIZATION_PERMISSIONS.vote,
    AUTHORIZATION_PERMISSIONS.revealVotes,
    AUTHORIZATION_PERMISSIONS.updateRoomSettings
  ],
  [AUTHORIZATION_ROLES.participant]: [AUTHORIZATION_PERMISSIONS.vote],
  [AUTHORIZATION_ROLES.observer]: []
};

export function normalizeRole(role: string): AuthorizationRole | null {
  const normalized = role.toUpperCase();
  if (
    normalized === AUTHORIZATION_ROLES.owner ||
    normalized === AUTHORIZATION_ROLES.moderator ||
    normalized === AUTHORIZATION_ROLES.participant ||
    normalized === AUTHORIZATION_ROLES.observer
  ) {
    return normalized;
  }
  return null;
}

export function hasPermission(role: AuthorizationRole, permission: Permission): boolean {
  return permissions[role].includes(permission);
}
