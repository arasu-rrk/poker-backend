export type EnvironmentName = "development" | "staging" | "production";

export interface ApiBindings {
  ENVIRONMENT: EnvironmentName;
  API_ALLOWED_ORIGINS: string;
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";
  DB?: D1Database;
}
