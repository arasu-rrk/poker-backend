export interface RoomRow {
  id: string;
  room_code: string;
  name: string;
  description: string | null;
  owner_id: string;
  settings_json: string;
  is_active: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface RoomMemberRow {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  joined_at: number;
  last_seen_at: number | null;
  is_active: number;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
}

export class RoomRepository {
  constructor(private readonly database: D1Database) {}

  async findRoomById(roomId: string): Promise<RoomRow | null> {
    return this.database
      .prepare(
        `select id, room_code, name, description, owner_id, settings_json, is_active,
                created_at, updated_at, deleted_at
         from poker_rooms where id = ?1 and deleted_at is null`
      )
      .bind(roomId)
      .first<RoomRow>();
  }

  async findRoomByCode(roomCode: string): Promise<RoomRow | null> {
    return this.database
      .prepare(
        `select id, room_code, name, description, owner_id, settings_json, is_active,
                created_at, updated_at, deleted_at
         from poker_rooms where room_code = ?1 and deleted_at is null`
      )
      .bind(roomCode)
      .first<RoomRow>();
  }

  async roomCodeExists(roomCode: string): Promise<boolean> {
    const result = await this.database
      .prepare(`select id from poker_rooms where room_code = ?1`)
      .bind(roomCode)
      .first<{ id: string }>();
    return result !== null;
  }

  async createRoom(input: {
    roomId: string;
    roomCode: string;
    name: string;
    description: string | null;
    ownerId: string;
    settingsJson: string;
    now: number;
  }): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `insert into poker_rooms (
               id, room_code, name, description, owner_id, settings_json,
               is_active, created_at, updated_at
             ) values (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)`
        )
        .bind(
          input.roomId,
          input.roomCode,
          input.name,
          input.description,
          input.ownerId,
          input.settingsJson,
          input.now
        ),
      this.database
        .prepare(
          `insert into room_members (
               id, room_id, user_id, role, joined_at, last_seen_at, is_active
             ) values (?1, ?2, ?3, 'owner', ?4, ?4, 1)`
        )
        .bind(crypto.randomUUID(), input.roomId, input.ownerId, input.now),
      this.database
        .prepare(
          `insert into audit_logs (
               id, room_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
             ) values (?1, ?2, ?3, 'room.created', 'room', ?2, '{}', ?4)`
        )
        .bind(crypto.randomUUID(), input.roomId, input.ownerId, input.now)
    ]);
  }

  async listRoomsForUser(userId: string): Promise<RoomRow[]> {
    const result = await this.database
      .prepare(
        `select r.id, r.room_code, r.name, r.description, r.owner_id, r.settings_json,
                r.is_active, r.created_at, r.updated_at, r.deleted_at
         from poker_rooms r
         join room_members m on m.room_id = r.id
         where m.user_id = ?1 and m.is_active = 1 and r.deleted_at is null
         order by r.updated_at desc`
      )
      .bind(userId)
      .all<RoomRow>();
    return result.results;
  }

  async getMembership(roomId: string, userId: string): Promise<RoomMemberRow | null> {
    return this.database
      .prepare(
        `select m.id, m.room_id, m.user_id, m.role, m.joined_at, m.last_seen_at,
                m.is_active, u.display_name, u.email, u.avatar_url
         from room_members m
         join users u on u.id = m.user_id
         where m.room_id = ?1 and m.user_id = ?2 and m.is_active = 1`
      )
      .bind(roomId, userId)
      .first<RoomMemberRow>();
  }

  async addMembership(input: {
    roomId: string;
    userId: string;
    role: "moderator" | "participant" | "observer";
    now: number;
  }): Promise<boolean> {
    const existing = await this.database
      .prepare(`select id from room_members where room_id = ?1 and user_id = ?2`)
      .bind(input.roomId, input.userId)
      .first<{ id: string }>();
    if (existing) {
      await this.database
        .prepare(
          `update room_members set is_active = 1, last_seen_at = ?1
           where room_id = ?2 and user_id = ?3`
        )
        .bind(input.now, input.roomId, input.userId)
        .run();
      return false;
    }
    await this.database.batch([
      this.database
        .prepare(
          `insert into room_members (
               id, room_id, user_id, role, joined_at, last_seen_at, is_active
             ) values (?1, ?2, ?3, ?4, ?5, ?5, 1)`
        )
        .bind(crypto.randomUUID(), input.roomId, input.userId, input.role, input.now),
      this.database
        .prepare(
          `insert into audit_logs (
               id, room_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
             ) values (?1, ?2, ?3, 'participant.joined', 'participant', ?3, '{}', ?4)`
        )
        .bind(crypto.randomUUID(), input.roomId, input.userId, input.now)
    ]);
    return true;
  }

  async updateRoom(input: {
    roomId: string;
    name?: string;
    description?: string | null;
    settingsJson?: string;
    actorUserId: string;
    now: number;
  }): Promise<void> {
    const setClauses: string[] = [];
    const values: Array<string | number | null> = [];
    let index = 1;
    if (input.name !== undefined) {
      setClauses.push(`name = ?${index++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      setClauses.push(`description = ?${index++}`);
      values.push(input.description);
    }
    if (input.settingsJson !== undefined) {
      setClauses.push(`settings_json = ?${index++}`);
      values.push(input.settingsJson);
    }
    setClauses.push(`updated_at = ?${index++}`);
    values.push(input.now);
    values.push(input.roomId);

    await this.database.batch([
      this.database
        .prepare(`update poker_rooms set ${setClauses.join(", ")} where id = ?${index}`)
        .bind(...values),
      this.database
        .prepare(
          `insert into audit_logs (
               id, room_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
             ) values (?1, ?2, ?3, 'room.updated', 'room', ?2, '{}', ?4)`
        )
        .bind(crypto.randomUUID(), input.roomId, input.actorUserId, input.now)
    ]);
  }

  async archiveRoom(roomId: string, actorUserId: string, now: number): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `update poker_rooms set is_active = 0, deleted_at = ?1, updated_at = ?1
             where id = ?2`
        )
        .bind(now, roomId),
      this.database
        .prepare(
          `update room_members set is_active = 0
             where room_id = ?1`
        )
        .bind(roomId),
      this.database
        .prepare(
          `insert into audit_logs (
               id, room_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
             ) values (?1, ?2, ?3, 'room.deleted', 'room', ?2, '{}', ?4)`
        )
        .bind(crypto.randomUUID(), roomId, actorUserId, now)
    ]);
  }

  async listParticipants(roomId: string): Promise<RoomMemberRow[]> {
    const result = await this.database
      .prepare(
        `select m.id, m.room_id, m.user_id, m.role, m.joined_at, m.last_seen_at,
                m.is_active, u.display_name, u.email, u.avatar_url
         from room_members m
         join users u on u.id = m.user_id
         where m.room_id = ?1 and m.is_active = 1
         order by m.joined_at asc`
      )
      .bind(roomId)
      .all<RoomMemberRow>();
    return result.results;
  }

  async updateParticipant(
    roomId: string,
    userId: string,
    input: { displayName?: string; avatarUrl?: string | null; now: number }
  ): Promise<void> {
    if (input.displayName !== undefined) {
      await this.database
        .prepare(
          `update users set display_name = ?1, updated_at = ?2
           where id = ?3`
        )
        .bind(input.displayName, input.now, userId)
        .run();
    }
    if (input.avatarUrl !== undefined) {
      await this.database
        .prepare(
          `update users set avatar_url = ?1, updated_at = ?2
           where id = ?3`
        )
        .bind(input.avatarUrl, input.now, userId)
        .run();
    }
    await this.database
      .prepare(
        `update room_members set last_seen_at = ?1
         where room_id = ?2 and user_id = ?3`
      )
      .bind(input.now, roomId, userId)
      .run();
  }

  async changeRole(input: {
    roomId: string;
    participantId: string;
    role: "moderator" | "participant" | "observer";
    actorUserId: string;
    now: number;
  }): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(`update room_members set role = ?1 where room_id = ?2 and user_id = ?3`)
        .bind(input.role, input.roomId, input.participantId),
      this.database
        .prepare(
          `insert into audit_logs (
               id, room_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
             ) values (?1, ?2, ?3, 'participant.role_changed', 'participant', ?4, ?5, ?6)`
        )
        .bind(
          crypto.randomUUID(),
          input.roomId,
          input.actorUserId,
          input.participantId,
          JSON.stringify({ role: input.role }),
          input.now
        )
    ]);
  }

  async removeParticipant(input: {
    roomId: string;
    participantId: string;
    actorUserId: string;
    now: number;
  }): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `update room_members set is_active = 0
             where room_id = ?1 and user_id = ?2`
        )
        .bind(input.roomId, input.participantId),
      this.database
        .prepare(
          `insert into audit_logs (
               id, room_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
             ) values (?1, ?2, ?3, 'participant.removed', 'participant', ?4, '{}', ?5)`
        )
        .bind(crypto.randomUUID(), input.roomId, input.actorUserId, input.participantId, input.now)
    ]);
  }

  async createInvitation(input: {
    id: string;
    roomId: string;
    inviterUserId: string;
    invitedEmail: string | null;
    role: "moderator" | "participant" | "observer";
    tokenHash: string;
    expiresAt: number;
  }): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `insert into room_invitations (
             id, room_id, inviter_user_id, invited_email, invited_role,
             invitation_token_hash, expires_at
           ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(
          input.id,
          input.roomId,
          input.inviterUserId,
          input.invitedEmail,
          input.role,
          input.tokenHash,
          input.expiresAt
        ),
      this.database
        .prepare(
          `insert into audit_logs (
             id, room_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
           ) values (?1, ?2, ?3, 'invitation.created', 'invitation', ?1, '{}', ?4)`
        )
        .bind(crypto.randomUUID(), input.roomId, input.inviterUserId, Date.now())
    ]);
  }

  async findInvitation(
    tokenHash: string,
    now: number
  ): Promise<{
    id: string;
    room_id: string;
    invited_role: "moderator" | "participant" | "observer";
  } | null> {
    return this.database
      .prepare(
        `select id, room_id, invited_role
         from room_invitations
         where invitation_token_hash = ?1
           and accepted_at is null
           and revoked_at is null
           and expires_at > ?2`
      )
      .bind(tokenHash, now)
      .first();
  }

  async acceptInvitation(
    invitationId: string,
    roomId: string,
    userId: string,
    role: "moderator" | "participant" | "observer",
    now: number
  ): Promise<boolean> {
    const accepted = await this.database
      .prepare(
        `update room_invitations set accepted_at = ?1
         where id = ?2 and room_id = ?3 and accepted_at is null and revoked_at is null`
      )
      .bind(now, invitationId, roomId)
      .run();
    if (!accepted.success) return false;
    await this.addMembership({ roomId, userId, role, now });
    return true;
  }
}
