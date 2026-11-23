export function validateOidcCallback(input: {
  provider: string | undefined;
  cookieState: string | undefined;
  returnedState: string | undefined;
  codeVerifier: string | undefined;
  code: string | undefined;
  providerError: string | undefined;
}):
  | { valid: true; provider: "google" | "microsoft" }
  | { valid: false; reason: "denied" | "invalid_state" } {
  if (input.providerError) return { valid: false, reason: "denied" };
  if (
    (input.provider !== "google" && input.provider !== "microsoft") ||
    !input.cookieState ||
    !input.codeVerifier ||
    !input.returnedState ||
    !input.code ||
    input.returnedState !== input.cookieState
  ) {
    return { valid: false, reason: "invalid_state" };
  }
  return { valid: true, provider: input.provider };
}
