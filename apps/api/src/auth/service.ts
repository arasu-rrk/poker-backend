import { createAccessToken, generateOpaqueToken, hashOpaqueToken } from "./crypto";
import { AuthRepository, type StoredUser } from "./repository";
import { AUTH_CONSTANTS, AUTH_ERROR_CODES } from "./constants";

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: StoredUser;
  sessionId: string;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtSecret: string
  ) {}

  async authenticateGuest(displayName: string): Promise<AuthResult> {
    const userId = crypto.randomUUID();
    const providerUserId = crypto.randomUUID();
    await this.repository.createUser({
      id: userId,
      displayName,
      email: null,
      avatarUrl: null,
      provider: "guest",
      providerUserId,
      isGuest: true
    });
    const user = await this.repository.findUserById(userId);
    if (!user) throw new Error("USER_CREATION_FAILED");
    return this.createSession(user);
  }

  async authenticateOidcUser(input: {
    provider: "google" | "microsoft";
    providerUserId: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
  }): Promise<AuthResult> {
    let user = await this.repository.findUserByProvider(input.provider, input.providerUserId);
    if (!user) {
      await this.repository.createUser({
        id: crypto.randomUUID(),
        displayName: input.displayName,
        email: input.email,
        avatarUrl: input.avatarUrl,
        provider: input.provider,
        providerUserId: input.providerUserId,
        isGuest: false
      });
      user = await this.repository.findUserByProvider(input.provider, input.providerUserId);
    }
    if (!user) throw new Error("OIDC_USER_CREATION_FAILED");
    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const refreshHash = await hashOpaqueToken(refreshToken);
    const session = await this.repository.findSessionByRefreshHash(refreshHash);
    const now = Date.now();
    if (!session || session.revoked_at !== null || session.expires_at <= now) {
      throw new Error(AUTH_ERROR_CODES.invalidRefreshToken);
    }

    const user = await this.repository.findUserById(session.user_id);
    if (!user) throw new Error(AUTH_ERROR_CODES.invalidRefreshToken);

    const newRefreshToken = generateOpaqueToken();
    const newRefreshHash = await hashOpaqueToken(newRefreshToken);
    const newSessionId = crypto.randomUUID();
    const expiresAt = now + AUTH_CONSTANTS.refreshTokenTtlMs;
    const rotated = await this.repository.rotateRefreshSession({
      oldSessionId: session.id,
      newSessionId,
      userId: session.user_id,
      newRefreshTokenHash: newRefreshHash,
      expiresAt,
      revokedAt: now
    });
    if (!rotated) throw new Error(AUTH_ERROR_CODES.refreshReplayDetected);

    const accessToken = await createAccessToken(
      this.jwtSecret,
      {
        sub: user.id,
        sid: newSessionId,
        provider: user.authentication_provider as "guest" | "google" | "microsoft",
        isGuest: Boolean(user.is_guest)
      },
      AUTH_CONSTANTS.accessTokenTtlSeconds
    );
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      user,
      sessionId: newSessionId
    };
  }

  async logout(refreshToken: string | null, revokeAll = false): Promise<string | null> {
    if (revokeAll && refreshToken) {
      const session = await this.repository.findSessionByRefreshHash(
        await hashOpaqueToken(refreshToken)
      );
      if (!session) return null;
      await this.repository.revokeAllUserSessions(session.user_id, Date.now());
      return session.user_id;
    }
    if (!refreshToken) return null;
    const session = await this.repository.findSessionByRefreshHash(
      await hashOpaqueToken(refreshToken)
    );
    if (!session) return null;
    await this.repository.revokeSession(session.id, Date.now());
    return session.user_id;
  }

  async createConnectionTicket(
    roomId: string,
    userId: string
  ): Promise<{ ticket: string; expiresAt: number }> {
    const room = await this.repository.findRoomOwner(roomId);
    if (!room) throw new Error(AUTH_ERROR_CODES.roomNotFound);
    const membership = await this.repository.findRoomMembership(roomId, userId);
    if (!membership && room.owner_id !== userId) {
      throw new Error(AUTH_ERROR_CODES.roomMembershipRequired);
    }

    const ticket = generateOpaqueToken();
    const ticketHash = await hashOpaqueToken(ticket);
    const expiresAt = Date.now() + AUTH_CONSTANTS.connectionTicketTtlMs;
    await this.repository.createConnectionTicket({
      id: crypto.randomUUID(),
      ticketHash,
      roomId,
      userId,
      expiresAt
    });
    return { ticket, expiresAt };
  }

  async consumeConnectionTicket(
    ticket: string
  ): Promise<{ roomId: string; userId: string } | null> {
    const result = await this.repository.consumeConnectionTicket(
      await hashOpaqueToken(ticket),
      Date.now()
    );
    return result ? { roomId: result.room_id, userId: result.user_id } : null;
  }

  private async createSession(user: StoredUser): Promise<AuthResult> {
    const refreshToken = generateOpaqueToken();
    const refreshHash = await hashOpaqueToken(refreshToken);
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + AUTH_CONSTANTS.refreshTokenTtlMs;
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: refreshHash,
      expiresAt
    });
    const accessToken = await createAccessToken(
      this.jwtSecret,
      {
        sub: user.id,
        sid: sessionId,
        provider: user.authentication_provider as "guest" | "google" | "microsoft",
        isGuest: Boolean(user.is_guest)
      },
      AUTH_CONSTANTS.accessTokenTtlSeconds
    );
    return { accessToken, refreshToken, expiresAt, user, sessionId };
  }
}
