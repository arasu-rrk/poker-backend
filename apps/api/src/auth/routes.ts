import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Google, MicrosoftEntraId, generateCodeVerifier, generateState } from "arctic";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { guestAuthenticationRequestSchema, logoutRequestSchema } from "@planning-poker/contracts";
import type { ApiBindings } from "../types";
import { AuthRepository } from "./repository";
import { AuthService } from "./service";
import { requireAccessToken } from "./middleware";
import { verifyAccessToken } from "./crypto";
import { AUTH_CONSTANTS, AUTH_COOKIE_NAMES, AUTH_ERROR_CODES } from "./constants";
import { validateOidcCallback } from "./oidc";

type AuthApp = Hono<{ Bindings: ApiBindings }>;

function allowedOrigin(context: Context<{ Bindings: ApiBindings }>): boolean {
  const origin = context.req.header("Origin");
  if (!origin) return true;
  const allowlist = (context.env.API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowlist.includes(origin);
}

function setRefreshCookie(
  context: Context<{ Bindings: ApiBindings }>,
  refreshToken: string,
  expiresAt: number
): void {
  setCookie(context, AUTH_COOKIE_NAMES.refreshToken, refreshToken, {
    httpOnly: true,
    secure: context.env.ENVIRONMENT !== "development",
    sameSite: "Lax",
    path: "/api/v1/auth",
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  });
}

function authResponse(
  context: Context<{ Bindings: ApiBindings }>,
  result: Awaited<ReturnType<AuthService["authenticateGuest"]>> & { refreshToken: string }
) {
  setRefreshCookie(context, result.refreshToken, result.expiresAt);
  return context.json(
    {
      data: {
        accessToken: result.accessToken,
        expiresAt: new Date(result.expiresAt).toISOString(),
        user: {
          id: result.user.id,
          displayName: result.user.display_name,
          email: result.user.email,
          avatarUrl: result.user.avatar_url,
          authenticationProvider: result.user.authentication_provider,
          isGuest: Boolean(result.user.is_guest)
        }
      }
    },
    200
  );
}

export function registerAuthRoutes(app: AuthApp): void {
  app.post("/api/v1/auth/guest", async (context) => {
    if (!allowedOrigin(context)) {
      return context.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Origin is not allowed",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        403
      );
    }
    if (!context.env.DB) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Database is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }
    if (!context.env.JWT_SECRET) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Authentication is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }
    const parsed = guestAuthenticationRequestSchema.safeParse(await context.req.json());
    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid guest authentication request",
            correlationId: context.res.headers.get("x-correlation-id"),
            details: parsed.error.issues.map((issue) => ({
              path: issue.path,
              message: issue.message,
              code: issue.code
            }))
          }
        },
        400
      );
    }
    const service = new AuthService(new AuthRepository(context.env.DB), context.env.JWT_SECRET);
    const result = await service.authenticateGuest(parsed.data.displayName);
    return authResponse(context, result);
  });

  app.get("/api/v1/auth/login", async (context) => {
    const provider = context.req.query("provider") ?? "google";
    if (provider !== "google" && provider !== "microsoft") {
      return context.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Unsupported OIDC provider",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        400
      );
    }
    const callbackUrl =
      context.env.AUTH_CALLBACK_URL ?? new URL("/api/v1/auth/callback", context.req.url).toString();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    setCookie(context, AUTH_COOKIE_NAMES.oidcState, state, {
      httpOnly: true,
      secure: context.env.ENVIRONMENT !== "development",
      sameSite: "Lax",
      path: "/api/v1/auth/callback",
      maxAge: AUTH_CONSTANTS.oidcStateTtlSeconds
    });
    setCookie(context, AUTH_COOKIE_NAMES.oidcVerifier, codeVerifier, {
      httpOnly: true,
      secure: context.env.ENVIRONMENT !== "development",
      sameSite: "Lax",
      path: "/api/v1/auth/callback",
      maxAge: AUTH_CONSTANTS.oidcStateTtlSeconds
    });
    setCookie(context, AUTH_COOKIE_NAMES.oidcProvider, provider, {
      httpOnly: true,
      secure: context.env.ENVIRONMENT !== "development",
      sameSite: "Lax",
      path: "/api/v1/auth/callback",
      maxAge: AUTH_CONSTANTS.oidcStateTtlSeconds
    });

    if (provider === "google") {
      if (!context.env.GOOGLE_OIDC_CLIENT_ID || !context.env.GOOGLE_OIDC_CLIENT_SECRET) {
        return context.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "Google OIDC is not configured",
              correlationId: context.res.headers.get("x-correlation-id")
            }
          },
          500
        );
      }
      const google = new Google(
        context.env.GOOGLE_OIDC_CLIENT_ID,
        context.env.GOOGLE_OIDC_CLIENT_SECRET,
        callbackUrl
      );
      return context.redirect(
        google
          .createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"])
          .toString()
      );
    }

    if (!context.env.MICROSOFT_OIDC_CLIENT_ID) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Microsoft OIDC is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }
    const microsoft = new MicrosoftEntraId(
      context.env.MICROSOFT_OIDC_TENANT ?? "common",
      context.env.MICROSOFT_OIDC_CLIENT_ID,
      context.env.MICROSOFT_OIDC_CLIENT_SECRET ?? null,
      callbackUrl
    );
    return context.redirect(
      microsoft
        .createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"])
        .toString()
    );
  });

  app.get("/api/v1/auth/callback", async (context) => {
    const provider = getCookie(context, AUTH_COOKIE_NAMES.oidcProvider);
    const state = getCookie(context, AUTH_COOKIE_NAMES.oidcState);
    const codeVerifier = getCookie(context, AUTH_COOKIE_NAMES.oidcVerifier);
    const returnedState = context.req.query("state");
    const code = context.req.query("code");
    const error = context.req.query("error");

    deleteCookie(context, AUTH_COOKIE_NAMES.oidcProvider, { path: "/api/v1/auth/callback" });
    deleteCookie(context, AUTH_COOKIE_NAMES.oidcState, { path: "/api/v1/auth/callback" });
    deleteCookie(context, AUTH_COOKIE_NAMES.oidcVerifier, { path: "/api/v1/auth/callback" });

    const callbackValidation = validateOidcCallback({
      provider,
      cookieState: state,
      returnedState,
      codeVerifier,
      code,
      providerError: error
    });
    if (!callbackValidation.valid) {
      const unauthorizedMessage =
        callbackValidation.reason === "denied"
          ? "OIDC authorization was denied"
          : "OIDC state validation failed";
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: unauthorizedMessage,
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
    const oidcProvider = callbackValidation.provider;
    if (!code || !codeVerifier) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "OIDC callback validation failed",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
    if (!context.env.DB || !context.env.JWT_SECRET) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Authentication is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }

    const callbackUrl =
      context.env.AUTH_CALLBACK_URL ?? new URL("/api/v1/auth/callback", context.req.url).toString();
    let idToken: string;
    try {
      if (oidcProvider === "google") {
        if (!context.env.GOOGLE_OIDC_CLIENT_ID || !context.env.GOOGLE_OIDC_CLIENT_SECRET) {
          throw new Error("GOOGLE_OIDC_NOT_CONFIGURED");
        }
        const googleClientId = context.env.GOOGLE_OIDC_CLIENT_ID;
        const googleClientSecret = context.env.GOOGLE_OIDC_CLIENT_SECRET;
        if (!googleClientId || !googleClientSecret) {
          throw new Error("GOOGLE_OIDC_NOT_CONFIGURED");
        }
        const google = new Google(googleClientId, googleClientSecret, callbackUrl);
        const tokens = await google.validateAuthorizationCode(code, codeVerifier);
        idToken = tokens.idToken();
      } else {
        if (!context.env.MICROSOFT_OIDC_CLIENT_ID) {
          throw new Error("MICROSOFT_OIDC_NOT_CONFIGURED");
        }
        const microsoftClientId = context.env.MICROSOFT_OIDC_CLIENT_ID;
        if (!microsoftClientId) {
          throw new Error("MICROSOFT_OIDC_NOT_CONFIGURED");
        }
        const microsoft = new MicrosoftEntraId(
          context.env.MICROSOFT_OIDC_TENANT ?? "common",
          microsoftClientId,
          context.env.MICROSOFT_OIDC_CLIENT_SECRET ?? null,
          callbackUrl
        );
        const tokens = await microsoft.validateAuthorizationCode(code, codeVerifier);
        idToken = tokens.idToken();
      }

      let payload: Record<string, unknown>;
      if (oidcProvider === "google") {
        const googleClientId = context.env.GOOGLE_OIDC_CLIENT_ID;
        if (!googleClientId) throw new Error("GOOGLE_OIDC_NOT_CONFIGURED");
        const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
        const verified = await jwtVerify(idToken, jwks, {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: googleClientId
        });
        payload = verified.payload;
      } else {
        const tenant = context.env.MICROSOFT_OIDC_TENANT ?? "common";
        const microsoftClientId = context.env.MICROSOFT_OIDC_CLIENT_ID;
        if (!microsoftClientId) throw new Error("MICROSOFT_OIDC_NOT_CONFIGURED");
        const jwks = createRemoteJWKSet(
          new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`)
        );
        const verified = await jwtVerify(idToken, jwks, {
          issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
          audience: microsoftClientId
        });
        payload = verified.payload;
      }

      const providerUserId = typeof payload.sub === "string" ? payload.sub : null;
      const displayName =
        typeof payload.name === "string"
          ? payload.name
          : typeof payload.preferred_username === "string"
            ? payload.preferred_username
            : "Planning Poker User";
      const email =
        typeof payload.email === "string"
          ? payload.email
          : typeof payload.preferred_username === "string"
            ? payload.preferred_username
            : null;
      const avatarUrl = typeof payload.picture === "string" ? payload.picture : null;
      if (!providerUserId) throw new Error("OIDC_SUBJECT_MISSING");

      const service = new AuthService(new AuthRepository(context.env.DB), context.env.JWT_SECRET);
      const result = await service.authenticateOidcUser({
        provider: oidcProvider,
        providerUserId,
        displayName,
        email,
        avatarUrl
      });
      return authResponse(context, result);
    } catch {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "OIDC callback validation failed",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
  });

  app.post("/api/v1/auth/refresh", async (context) => {
    if (!allowedOrigin(context)) {
      return context.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Origin is not allowed",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        403
      );
    }
    if (!context.env.DB || !context.env.JWT_SECRET) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Authentication is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }
    let bodyRefreshToken: string | undefined;
    const contentType = context.req.header("Content-Type");
    if (contentType?.includes("application/json")) {
      const body = z
        .object({ refreshToken: z.string().optional() })
        .safeParse(await context.req.json());
      if (body.success) bodyRefreshToken = body.data.refreshToken;
    }
    const refreshToken = bodyRefreshToken ?? getCookie(context, AUTH_COOKIE_NAMES.refreshToken);
    if (!refreshToken) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Refresh token is required",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
    try {
      const jwtSecret = context.env.JWT_SECRET;
      if (!jwtSecret) throw new Error(AUTH_ERROR_CODES.jwtSecretNotConfigured);
      const service = new AuthService(new AuthRepository(context.env.DB), jwtSecret);
      const result = await service.refresh(refreshToken);
      return authResponse(context, result);
    } catch (error) {
      const replayed =
        error instanceof Error && error.message === AUTH_ERROR_CODES.refreshReplayDetected;
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: replayed
              ? "Refresh token replay detected"
              : "Refresh token is invalid or expired",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
  });

  app.post("/api/v1/auth/logout", async (context) => {
    if (!allowedOrigin(context)) {
      return context.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Origin is not allowed",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        403
      );
    }
    if (!context.env.DB || !context.env.JWT_SECRET) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Authentication is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }
    const parsed = logoutRequestSchema.safeParse(await context.req.json().catch(() => ({})));
    const refreshToken = getCookie(context, AUTH_COOKIE_NAMES.refreshToken);
    const service = new AuthService(new AuthRepository(context.env.DB), context.env.JWT_SECRET);
    await service.logout(refreshToken ?? null, parsed.success && parsed.data.revokeAllSessions);
    deleteCookie(context, AUTH_COOKIE_NAMES.refreshToken, { path: "/api/v1/auth" });
    return context.json({ data: { loggedOut: true } });
  });

  app.get("/api/v1/auth/me", requireAccessToken, async (context) => {
    if (!context.env.DB) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Database is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }
    const authorization = context.req.header("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const claims = await verifyAccessToken(context.env.JWT_SECRET ?? "", token).catch(() => null);
    if (!claims) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Access token is invalid",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
    const user = await new AuthRepository(context.env.DB).findUserById(claims.sub);
    if (!user) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "User session is no longer active",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
    return context.json({
      data: {
        id: user.id,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        authenticationProvider: user.authentication_provider,
        isGuest: Boolean(user.is_guest)
      }
    });
  });

  app.post("/api/v1/rooms/:roomId/connection-ticket", requireAccessToken, async (context) => {
    if (!context.env.DB || !context.env.JWT_SECRET) {
      return context.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Authentication is not configured",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        500
      );
    }
    const roomId = context.req.param("roomId");
    if (!roomId || !z.uuid().safeParse(roomId).success) {
      return context.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Room not found",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        404
      );
    }
    const authorization = context.req.header("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const claims = await verifyAccessToken(context.env.JWT_SECRET, token).catch(() => null);
    if (!claims) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Access token is invalid",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        401
      );
    }
    try {
      const jwtSecret = context.env.JWT_SECRET;
      if (!jwtSecret) throw new Error(AUTH_ERROR_CODES.jwtSecretNotConfigured);
      const service = new AuthService(new AuthRepository(context.env.DB), jwtSecret);
      const ticket = await service.createConnectionTicket(roomId, claims.sub);
      return context.json({
        data: {
          ticket: ticket.ticket,
          expiresAt: new Date(ticket.expiresAt).toISOString(),
          roomId
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === AUTH_ERROR_CODES.roomNotFound) {
        return context.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Room not found",
              correlationId: context.res.headers.get("x-correlation-id")
            }
          },
          404
        );
      }
      return context.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Room membership is required",
            correlationId: context.res.headers.get("x-correlation-id")
          }
        },
        403
      );
    }
  });
}
