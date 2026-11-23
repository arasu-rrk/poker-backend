export type EnvironmentName = "development" | "staging" | "production";

export interface ApiBindings {
  ENVIRONMENT: EnvironmentName;
  API_ALLOWED_ORIGINS: string;
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";
  JWT_SECRET: string;
  GOOGLE_OIDC_CLIENT_ID?: string;
  GOOGLE_OIDC_CLIENT_SECRET?: string;
  MICROSOFT_OIDC_CLIENT_ID?: string;
  MICROSOFT_OIDC_CLIENT_SECRET?: string;
  MICROSOFT_OIDC_TENANT?: string;
  AUTH_CALLBACK_URL?: string;
  DB?: D1Database;
}
