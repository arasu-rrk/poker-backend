import { PlanningPokerRoom } from "./room";
import type { RealtimeBindings } from "./types";

export { PlanningPokerRoom };

export default {
  async fetch(request: Request, env: RealtimeBindings): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "planning-poker-realtime"
      });
    }

    const roomMatch = /^\/rooms\/([^/]+)\/ws$/.exec(url.pathname);
    if (!roomMatch) {
      return Response.json(
        { error: "NOT_FOUND", message: "Room route not found" },
        { status: 404 }
      );
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json(
        { error: "WEBSOCKET_REQUIRED", message: "A WebSocket upgrade is required" },
        { status: 426 }
      );
    }

    const roomId = decodeURIComponent(roomMatch[1] ?? "");
    if (!roomId) {
      return Response.json(
        { error: "INVALID_ROOM", message: "Room ID is required" },
        { status: 400 }
      );
    }
    const ticket = new URL(request.url).searchParams.get("ticket");
    if (!ticket) {
      return Response.json(
        {
          error: "CONNECTION_TICKET_REQUIRED",
          message: "A single-use connection ticket is required"
        },
        { status: 401 }
      );
    }
    if (!env.DB) {
      return Response.json(
        { error: "DATABASE_NOT_CONFIGURED", message: "Realtime authentication is unavailable" },
        { status: 503 }
      );
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticket));
    const ticketHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    const storedTicket = await env.DB.prepare(
      `select room_id, user_id, expires_at, used_at, revoked_at
       from connection_tickets where ticket_hash = ?1`
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
      !storedTicket ||
      storedTicket.room_id !== roomId ||
      storedTicket.used_at !== null ||
      storedTicket.revoked_at !== null ||
      storedTicket.expires_at <= Date.now()
    ) {
      return Response.json(
        { error: "INVALID_CONNECTION_TICKET", message: "Ticket is invalid or expired" },
        { status: 401 }
      );
    }
    const consumed = await env.DB.prepare(
      `update connection_tickets set used_at = ?1
       where ticket_hash = ?2 and used_at is null and revoked_at is null`
    )
      .bind(Date.now(), ticketHash)
      .run();
    if (!consumed.success) {
      return Response.json(
        { error: "CONNECTION_TICKET_REPLAY", message: "Ticket has already been used" },
        { status: 401 }
      );
    }

    const durableObjectId = env.ROOMS.idFromName(roomId);
    const stub = env.ROOMS.get(durableObjectId);
    return stub.fetch(request);
  }
};
