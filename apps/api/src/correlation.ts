export function createCorrelationId(request: Request): string {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  if (supplied) return supplied.slice(0, 128);
  return crypto.randomUUID();
}
