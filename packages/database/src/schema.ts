import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestampNow = sql`(unixepoch() * 1000)`;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    authenticationProvider: text("authentication_provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    isGuest: integer("is_guest", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(timestampNow),
    updatedAt: integer("updated_at").notNull().default(timestampNow),
    deletedAt: integer("deleted_at")
  },
  (table) => [
    uniqueIndex("uq_users_auth_provider").on(table.authenticationProvider, table.providerUserId),
    uniqueIndex("uq_users_email").on(table.email),
    index("idx_users_deleted_at").on(table.deletedAt)
  ]
);

export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull().default(timestampNow),
    updatedAt: integer("updated_at").notNull().default(timestampNow)
  },
  (table) => [
    foreignKey({
      name: "fk_user_sessions_users",
      columns: [table.userId],
      foreignColumns: [users.id]
    }).onDelete("cascade"),
    uniqueIndex("uq_user_sessions_refresh_token_hash").on(table.refreshTokenHash),
    index("idx_user_sessions_user_id").on(table.userId),
    index("idx_user_sessions_expires_at").on(table.expiresAt),
    check(
      "ck_user_sessions_not_revoked_after_expiry",
      sql`${table.revokedAt} is null or ${table.revokedAt} <= ${table.expiresAt}`
    )
  ]
);

export const pokerRooms = sqliteTable(
  "poker_rooms",
  {
    id: text("id").primaryKey(),
    roomCode: text("room_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: text("owner_id").notNull(),
    settingsJson: text("settings_json").notNull().default("{}"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull().default(timestampNow),
    updatedAt: integer("updated_at").notNull().default(timestampNow),
    deletedAt: integer("deleted_at")
  },
  (table) => [
    foreignKey({
      name: "fk_poker_rooms_owner_users",
      columns: [table.ownerId],
      foreignColumns: [users.id]
    }).onDelete("restrict"),
    uniqueIndex("uq_poker_rooms_room_code").on(table.roomCode),
    index("idx_poker_rooms_owner_id").on(table.ownerId),
    index("idx_poker_rooms_is_active").on(table.isActive),
    index("idx_poker_rooms_deleted_at").on(table.deletedAt)
  ]
);

export const roomMembers = sqliteTable(
  "room_members",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    joinedAt: integer("joined_at").notNull().default(timestampNow),
    lastSeenAt: integer("last_seen_at"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true)
  },
  (table) => [
    foreignKey({
      name: "fk_room_members_poker_rooms",
      columns: [table.roomId],
      foreignColumns: [pokerRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_room_members_users",
      columns: [table.userId],
      foreignColumns: [users.id]
    }).onDelete("cascade"),
    uniqueIndex("uq_room_members_room_user").on(table.roomId, table.userId),
    index("idx_room_members_user_id").on(table.userId),
    check(
      "ck_room_members_role",
      sql`${table.role} in ('owner', 'moderator', 'participant', 'observer')`
    )
  ]
);

export const pokerSessions = sqliteTable(
  "poker_sessions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull().default(timestampNow),
    updatedAt: integer("updated_at").notNull().default(timestampNow)
  },
  (table) => [
    foreignKey({
      name: "fk_poker_sessions_poker_rooms",
      columns: [table.roomId],
      foreignColumns: [pokerRooms.id]
    }).onDelete("cascade"),
    uniqueIndex("uq_poker_sessions_id_room").on(table.id, table.roomId),
    index("idx_poker_sessions_room_id").on(table.roomId),
    index("idx_poker_sessions_status").on(table.status),
    check(
      "ck_poker_sessions_status",
      sql`${table.status} in ('draft', 'active', 'completed', 'cancelled')`
    )
  ]
);

export const pokerStories = sqliteTable(
  "poker_stories",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    acceptanceCriteria: text("acceptance_criteria"),
    ticketUrl: text("ticket_url"),
    displayOrder: integer("display_order").notNull(),
    status: text("status").notNull(),
    finalEstimate: text("final_estimate"),
    createdAt: integer("created_at").notNull().default(timestampNow),
    updatedAt: integer("updated_at").notNull().default(timestampNow),
    deletedAt: integer("deleted_at")
  },
  (table) => [
    foreignKey({
      name: "fk_poker_stories_poker_sessions",
      columns: [table.sessionId],
      foreignColumns: [pokerSessions.id]
    }).onDelete("cascade"),
    uniqueIndex("uq_poker_stories_id_session").on(table.id, table.sessionId),
    uniqueIndex("uq_poker_stories_session_order").on(table.sessionId, table.displayOrder),
    index("idx_poker_stories_session_id").on(table.sessionId),
    index("idx_poker_stories_status").on(table.status),
    index("idx_poker_stories_deleted_at").on(table.deletedAt),
    check("ck_poker_stories_display_order", sql`${table.displayOrder} >= 0`),
    check(
      "ck_poker_stories_status",
      sql`${table.status} in ('pending', 'voting', 'estimated', 'skipped', 'deleted')`
    )
  ]
);

export const votingRounds = sqliteTable(
  "voting_rounds",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id").notNull(),
    sessionId: text("session_id").notNull(),
    roundNumber: integer("round_number").notNull(),
    status: text("status").notNull(),
    revealedAt: integer("revealed_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull().default(timestampNow),
    updatedAt: integer("updated_at").notNull().default(timestampNow)
  },
  (table) => [
    foreignKey({
      name: "fk_voting_rounds_poker_stories",
      columns: [table.storyId, table.sessionId],
      foreignColumns: [pokerStories.id, pokerStories.sessionId]
    }).onDelete("cascade"),
    uniqueIndex("uq_voting_rounds_story_number").on(table.storyId, table.roundNumber),
    index("idx_voting_rounds_session_id").on(table.sessionId),
    index("idx_voting_rounds_status").on(table.status),
    check("ck_voting_rounds_round_number", sql`${table.roundNumber} >= 1`),
    check(
      "ck_voting_rounds_status",
      sql`${table.status} in ('open', 'revealed', 'completed', 'cancelled')`
    )
  ]
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    votingRoundId: text("voting_round_id").notNull(),
    userId: text("user_id").notNull(),
    voteType: text("vote_type").notNull(),
    numericValue: integer("numeric_value"),
    specialValue: text("special_value"),
    submittedAt: integer("submitted_at").notNull().default(timestampNow),
    updatedAt: integer("updated_at").notNull().default(timestampNow)
  },
  (table) => [
    foreignKey({
      name: "fk_votes_voting_rounds",
      columns: [table.votingRoundId],
      foreignColumns: [votingRounds.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_votes_users",
      columns: [table.userId],
      foreignColumns: [users.id]
    }).onDelete("cascade"),
    uniqueIndex("uq_votes_round_user").on(table.votingRoundId, table.userId),
    index("idx_votes_user_id").on(table.userId),
    check("ck_votes_vote_type", sql`${table.voteType} in ('numeric', 'special')`),
    check(
      "ck_votes_numeric_pair",
      sql`(${table.voteType} = 'numeric' and ${table.numericValue} is not null and ${table.specialValue} is null) or (${table.voteType} = 'special' and ${table.specialValue} is not null and ${table.numericValue} is null)`
    )
  ]
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull().default(timestampNow)
  },
  (table) => [
    foreignKey({
      name: "fk_audit_logs_poker_rooms",
      columns: [table.roomId],
      foreignColumns: [pokerRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_audit_logs_actor_users",
      columns: [table.actorUserId],
      foreignColumns: [users.id]
    }).onDelete("set null"),
    index("idx_audit_logs_room_created").on(table.roomId, table.createdAt),
    index("idx_audit_logs_actor_user_id").on(table.actorUserId),
    index("idx_audit_logs_entity").on(table.entityType, table.entityId)
  ]
);

export const connectionTickets = sqliteTable(
  "connection_tickets",
  {
    id: text("id").primaryKey(),
    ticketHash: text("ticket_hash").notNull(),
    roomId: text("room_id").notNull(),
    userId: text("user_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull().default(timestampNow)
  },
  (table) => [
    foreignKey({
      name: "fk_connection_tickets_poker_rooms",
      columns: [table.roomId],
      foreignColumns: [pokerRooms.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "fk_connection_tickets_users",
      columns: [table.userId],
      foreignColumns: [users.id]
    }).onDelete("cascade"),
    uniqueIndex("uq_connection_tickets_ticket_hash").on(table.ticketHash),
    index("idx_connection_tickets_room_id").on(table.roomId),
    index("idx_connection_tickets_user_id").on(table.userId),
    index("idx_connection_tickets_expires_at").on(table.expiresAt)
  ]
);
