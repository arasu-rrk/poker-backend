export interface RealtimeBindings {
  ENVIRONMENT: "development" | "staging" | "production";
  REALTIME_ALLOWED_ORIGINS: string;
  ROOMS: DurableObjectNamespace;
  DB?: D1Database;
}
