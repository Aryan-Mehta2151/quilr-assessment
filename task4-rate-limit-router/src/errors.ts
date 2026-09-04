export type GatewayErrorCode = "RATE_LIMITED" | "UPSTREAM_ERROR" | "UPSTREAM_UNAVAILABLE";

export interface GatewayError {
  code: GatewayErrorCode;
  message: string;
}

export const ERROR_MESSAGES: Record<GatewayErrorCode, string> = {
  RATE_LIMITED: "Token rate limit exceeded for this API key. Please retry later.",
  UPSTREAM_ERROR: "The completion request failed. Please try again.",
  UPSTREAM_UNAVAILABLE: "The completion service is temporarily unavailable. Please try again shortly.",
};

export function gatewayError(code: GatewayErrorCode): GatewayError {
  return { code, message: ERROR_MESSAGES[code] };
}
