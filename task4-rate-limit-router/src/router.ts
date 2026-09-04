import { SlidingWindowRateLimiter } from "./rate-limiter.js";
import { gatewayError, type GatewayError } from "./errors.js";

export interface CompletionRequest {
  tenantKey: string;
  estimatedTokens: number;
  payload: Record<string, unknown>;
}

export type CompletionResult =
  | { ok: true; text: string; tokens: number; provider: string }
  | { ok: false; error: GatewayError };

interface ProviderCallResult {
  ok: boolean;
  retryable?: boolean;
  text?: string;
  tokens?: number;
  provider?: string;
}

export class ModelRouter {
  constructor(
    private readonly rateLimiter: SlidingWindowRateLimiter,
    private readonly primaryUrl: string,
    private readonly secondaryUrl: string,
    private readonly timeoutMs = 3000
  ) {}

  async route(req: CompletionRequest): Promise<CompletionResult> {
    const limit = this.rateLimiter.tryConsume(req.tenantKey, req.estimatedTokens);
    if (!limit.allowed) {
      return { ok: false, error: gatewayError("RATE_LIMITED") };
    }

    const primary = await this.callProvider(this.primaryUrl, req);
    if (primary.ok) {
      return { ok: true, text: primary.text!, tokens: primary.tokens!, provider: primary.provider! };
    }

    if (!primary.retryable) {
      return { ok: false, error: gatewayError("UPSTREAM_ERROR") };
    }

    const secondary = await this.callProvider(this.secondaryUrl, req);
    if (secondary.ok) {
      return { ok: true, text: secondary.text!, tokens: secondary.tokens!, provider: secondary.provider! };
    }

    return { ok: false, error: gatewayError("UPSTREAM_UNAVAILABLE") };
  }

  private async callProvider(url: string, req: CompletionRequest): Promise<ProviderCallResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.payload),
        signal: controller.signal,
      });

      if (res.status === 429) return { ok: false, retryable: true };
      if (!res.ok) return { ok: false, retryable: false };

      const body = (await res.json()) as { text: string; tokens: number; provider: string };
      return { ok: true, text: body.text, tokens: body.tokens, provider: body.provider };
    } catch {
      return { ok: false, retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }
}
