import type { Hono } from "hono";
import type { ApiBindings } from "../types";
import { requireAccessToken } from "../auth/middleware";
import { RoomRepository } from "./repository";
import { RoomService } from "./service";
import {
  getAuthenticatedUserId,
  invitationRequest,
  participantDisplayNameRequest,
  participantRoleRequest,
  roomCreateRequest,
  roomErrorResponse,
  roomJoinRequest,
  roomUpdateRequest,
  validationResponse
} from "./controller";

type RoomApp = Hono<{ Bindings: ApiBindings }>;

export function registerRoomRoutes(app: RoomApp): void {
  app.use("/api/v1/rooms*", requireAccessToken);

  app.post("/api/v1/rooms", async (context) => {
    const parsed = roomCreateRequest.safeParse(await context.req.json());
    if (!parsed.success) return validationResponse(context, parsed.error);
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    const service = new RoomService(new RoomRepository(context.env.DB));
    try {
      const room = await service.createRoom({
        ownerId: userId,
        name: parsed.data.name,
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.settings ? { settings: parsed.data.settings } : {})
      });
      return context.json({ data: room }, 201);
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.get("/api/v1/rooms", async (context) => {
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      const rooms = await new RoomService(new RoomRepository(context.env.DB)).listRooms(userId);
      return context.json({ data: rooms });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.get("/api/v1/rooms/:roomId", async (context) => {
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      const room = await new RoomService(new RoomRepository(context.env.DB)).getRoom(
        context.req.param("roomId"),
        userId
      );
      return context.json({ data: room });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.patch("/api/v1/rooms/:roomId", async (context) => {
    const parsed = roomUpdateRequest.safeParse(await context.req.json());
    if (!parsed.success) return validationResponse(context, parsed.error);
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      const room = await new RoomService(new RoomRepository(context.env.DB)).updateRoom(
        context.req.param("roomId"),
        userId,
        {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description }
            : {}),
          ...(parsed.data.settings !== undefined ? { settings: parsed.data.settings } : {})
        }
      );
      return context.json({ data: room });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.delete("/api/v1/rooms/:roomId", async (context) => {
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      await new RoomService(new RoomRepository(context.env.DB)).deleteRoom(
        context.req.param("roomId"),
        userId
      );
      return context.json({ data: { deleted: true } });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.post("/api/v1/rooms/join", async (context) => {
    const parsed = roomJoinRequest.safeParse(await context.req.json());
    if (!parsed.success) return validationResponse(context, parsed.error);
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      const room = await new RoomService(new RoomRepository(context.env.DB)).joinRoom({
        userId,
        ...(parsed.data.roomCode !== undefined ? { roomCode: parsed.data.roomCode } : {}),
        ...(parsed.data.invitationToken !== undefined
          ? { invitationToken: parsed.data.invitationToken }
          : {})
      });
      return context.json({ data: room });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.post("/api/v1/rooms/:roomId/invitations", async (context) => {
    const parsed = invitationRequest.safeParse(await context.req.json());
    if (!parsed.success) return validationResponse(context, parsed.error);
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      const invitation = await new RoomService(new RoomRepository(context.env.DB)).createInvitation(
        context.req.param("roomId"),
        userId,
        {
          ...(parsed.data.invitedEmail !== undefined
            ? { invitedEmail: parsed.data.invitedEmail }
            : {}),
          role: parsed.data.role,
          ...(parsed.data.expiresInSeconds !== undefined
            ? { expiresInSeconds: parsed.data.expiresInSeconds }
            : {})
        }
      );
      return context.json(
        {
          data: {
            invitationToken: invitation.invitationToken,
            expiresAt: new Date(invitation.expiresAt).toISOString()
          }
        },
        201
      );
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.get("/api/v1/rooms/:roomId/participants", async (context) => {
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      const participants = await new RoomService(
        new RoomRepository(context.env.DB)
      ).listParticipants(context.req.param("roomId"), userId);
      return context.json({ data: participants });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.patch("/api/v1/rooms/:roomId/participants/me", async (context) => {
    const parsed = participantDisplayNameRequest.safeParse(await context.req.json());
    if (!parsed.success) return validationResponse(context, parsed.error);
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      await new RoomService(new RoomRepository(context.env.DB)).updateParticipant(
        context.req.param("roomId"),
        userId,
        {
          displayName: parsed.data.displayName,
          ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {})
        }
      );
      return context.json({ data: { updated: true } });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.patch("/api/v1/rooms/:roomId/participants/:participantId/role", async (context) => {
    const parsed = participantRoleRequest.safeParse(await context.req.json());
    if (!parsed.success) return validationResponse(context, parsed.error);
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      await new RoomService(new RoomRepository(context.env.DB)).changeRole(
        context.req.param("roomId"),
        userId,
        context.req.param("participantId"),
        parsed.data.role
      );
      return context.json({ data: { updated: true } });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });

  app.delete("/api/v1/rooms/:roomId/participants/:participantId", async (context) => {
    if (!context.env.DB) return roomErrorResponse(context, new Error("Database not configured"));
    const userId = await getAuthenticatedUserId(context);
    if (!userId) return roomErrorResponse(context, new Error("Unauthorized"));
    try {
      await new RoomService(new RoomRepository(context.env.DB)).removeParticipant(
        context.req.param("roomId"),
        userId,
        context.req.param("participantId")
      );
      return context.json({ data: { removed: true } });
    } catch (error) {
      return roomErrorResponse(context, error);
    }
  });
}
