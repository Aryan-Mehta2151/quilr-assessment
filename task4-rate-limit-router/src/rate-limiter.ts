import type { Database } from "better-sqlite3";

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  limitTokens: number;
}

export class SlidingWindowRateLimiter {
  private readonly deleteStale: import("better-sqlite3").Statement;
  private readonly sumUsage: import("better-sqlite3").Statement;
  private readonly insertUsage: import("better-sqlite3").Statement;

  constructor(
    private readonly db: Database,
    private readonly limitTokens = 50_000,
    private readonly windowMs = 60_000
  ) {
    this.deleteStale = db.prepare(`DELETE FROM token_usage WHERE tenant_key = ? AND requested_at < ?`);
    this.sumUsage = db.prepare(
      `SELECT COALESCE(SUM(tokens), 0) AS total FROM token_usage WHERE tenant_key = ? AND requested_at >= ?`
    );
    this.insertUsage = db.prepare(`INSERT INTO token_usage (tenant_key, tokens, requested_at) VALUES (?, ?, ?)`);
  }

  tryConsume(tenantKey: string, tokens: number, now = Date.now()): RateLimitResult {
    const windowStart = now - this.windowMs;

    const run = this.db.transaction(() => {
      this.deleteStale.run(tenantKey, windowStart);
      const { total } = this.sumUsage.get(tenantKey, windowStart) as { total: number };

      if (total + tokens > this.limitTokens) {
        return { allowed: false, remainingTokens: Math.max(0, this.limitTokens - total), limitTokens: this.limitTokens };
      }

      this.insertUsage.run(tenantKey, tokens, now);
      return { allowed: true, remainingTokens: this.limitTokens - total - tokens, limitTokens: this.limitTokens };
    });

    return run();
  }
}
