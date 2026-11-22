export class PlanningPokerRoom implements DurableObject {
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();
    server.send(JSON.stringify({ type: "connection.ready" }));
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}
