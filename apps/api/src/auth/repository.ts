export interface StoredUser {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  authentication_provider: string;
  provider_user_id: string;
  is_guest: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export class AuthRepository {
  constructor(private readonly database: D1Database) {}

  async findUserByProvider(provider: string, providerUserId: string): Promise<StoredUser | null> {
    return this.database
      .prepare(
        `select id, display_name, email, avatar_url, authentication_provider,
                provider_user_id, is_guest, created_at, updated_at, deleted_at
         from users
         where authentication_provider = ?1 and provider_user_id = ?2 and deleted_at is null`
      )
      .bind(provider, providerUserId)
      .first<StoredUser>();
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    return this.database
      .prepare(
        `select id, display_name, email, avatar_url, authentication_provider,
                provider_user_id, is_guest, created_at, updated_at, deleted_at
         from users where id = ?1 and deleted_at is null`
      )
      .bind(userId)
      .first<StoredUser>();
  }

  async createUser(input: {
    id: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
    provider: string;
    providerUserId: string;
    isGuest: boolean;
  }): Promise<void> {
    await this.database
      .prepare(
        `insert into users (
           id, display_name, email, avatar_url, authentication_provider,
           provider_user_id, is_guest
         ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(
        input.id,
        input.displayName,
        input.email,
        input.avatarUrl,
        input.provider,
        input.providerUserId,
        input.isGuest ? 1 : 0
      )
      .run();
  }

  async createSession(input: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: number;
  }): Promise<void> {
    await this.database
      .prepare(
        `insert into user_sessions (
           id, user_id, refresh_token_hash, expires_at
         ) values (?1, ?2, ?3, ?4)`
      )
      .bind(input.id, input.userId, input.refreshTokenHash, input.expiresAt)
      .run();
  }

  async findSessionByRefreshHash(refreshTokenHash: string): Promise<{
    id: string;
    user_id: string;
    expires_at: number;
    revoked_at: number | null;
  } | null> {
    return this.database
      .prepare(
        `select id, user_id, expires_at, revoked_at
         from user_sessions
         where refresh_token_hash = ?1`
      )
      .bind(refreshTokenHash)
      .first();
  }

  async revokeSession(sessionId: string, revokedAt: number): Promise<void> {
    await this.database
      .prepare(
        `update user_sessions set revoked_at = ?1, updated_at = ?1
         where id = ?2 and revoked_at is null`
      )
      .bind(revokedAt, sessionId)
      .run();
  }

  async revokeAllUserSessions(userId: string, revokedAt: number): Promise<void> {
    await this.database
      .prepare(
        `update user_sessions set revoked_at = ?1, updated_at = ?1
         where user_id = ?2 and revoked_at is null`
      )
      .bind(revokedAt, userId)
      .run();
  }

  async rotateRefreshSession(input: {
    oldSessionId: string;
    newSessionId: string;
    userId: string;
    newRefreshTokenHash: string;
    expiresAt: number;
    revokedAt: number;
  }): Promise<boolean> {
    const statements = [
      this.database
        .prepare(
          `update user_sessions set revoked_at = ?1, updated_at = ?1
           where id = ?2 and revoked_at is null`
        )
        .bind(input.revokedAt, input.oldSessionId),
      this.database
        .prepare(
          `insert into user_sessions (
             id, user_id, refresh_token_hash, expires_at
           ) values (?1, ?2, ?3, ?4)`
        )
        .bind(input.newSessionId, input.userId, input.newRefreshTokenHash, input.expiresAt)
    ];
    const results = await this.database.batch(statements);
    return results[0]?.success === true && results[1]?.success === true;
  }

  async findRoomMembership(
    roomId: string,
    userId: string
  ): Promise<{ role: string; is_active: number } | null> {
    return this.database
      .prepare(
        `select role, is_active
         from room_members
         where room_id = ?1 and user_id = ?2 and is_active = 1`
      )
      .bind(roomId, userId)
      .first();
  }

  async findRoomOwner(roomId: string): Promise<{ owner_id: string } | null> {
    return this.database
      .prepare(`select owner_id from poker_rooms where id = ?1 and deleted_at is null`)
      .bind(roomId)
      .first();
  }

  async createConnectionTicket(input: {
    id: string;
    ticketHash: string;
    roomId: string;
    userId: string;
    expiresAt: number;
  }): Promise<void> {
    await this.database
      .prepare(
        `insert into connection_tickets (
           id, ticket_hash, room_id, user_id, expires_at
         ) values (?1, ?2, ?3, ?4, ?5)`
      )
      .bind(input.id, input.ticketHash, input.roomId, input.userId, input.expiresAt)
      .run();
  }

  async consumeConnectionTicket(
    ticketHash: string,
    now: number
  ): Promise<{ room_id: string; user_id: string } | null> {
    const ticket = await this.database
      .prepare(
        `select room_id, user_id, expires_at, used_at, revoked_at
         from connection_tickets
         where ticket_hash = ?1`
      )
      .bind(ticketHash)
      .first<{
        room_id: string;
        user_id: string;
        expires_at: number;
        used_at: number | null;
        revoked_at: number | null;
      }>();
    if (
      !ticket ||
      ticket.used_at !== null ||
      ticket.revoked_at !== null ||
      ticket.expires_at <= now
    ) {
      return null;
    }
    const result = await this.database
      .prepare(
        `update connection_tickets set used_at = ?1
         where ticket_hash = ?2 and used_at is null and revoked_at is null`
      )
      .bind(now, ticketHash)
      .run();
    return result.success ? { room_id: ticket.room_id, user_id: ticket.user_id } : null;
  }
}
