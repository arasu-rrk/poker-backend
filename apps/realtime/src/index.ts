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

    const durableObjectId = env.ROOMS.idFromName(roomId);
    const stub = env.ROOMS.get(durableObjectId);
    return stub.fetch(request);
  }
};
