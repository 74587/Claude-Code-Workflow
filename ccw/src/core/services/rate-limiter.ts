export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

interface BucketState {
  tokens: number;
  resetAt: number;
}

/**
 * Simple fixed-window token bucket (in-memory).
 * Good enough for local dashboard usage; not suitable for multi-process deployments.
 */
export class RateLimiter {
  private buckets = new Map<string, BucketState>();
  private limit: number;
  private windowMs: number;

  constructor(opts: { limit: number; windowMs: number }) {
    this.limit = Math.max(0, opts.limit);
    this.windowMs = Math.max(1, opts.windowMs);
  }

  consume(key: string, cost: number = 1): RateLimitResult {
    const now = Date.now();
    const safeCost = Math.max(0, Math.floor(cost));
    const existing = this.buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + this.windowMs;
      const nextTokens = this.limit - safeCost;
      const ok = nextTokens >= 0;
      const tokens = ok ? nextTokens : this.limit;
      this.buckets.set(key, { tokens, resetAt });
      return { ok, remaining: Math.max(0, ok ? tokens : 0), resetAt };
    }

    const nextTokens = existing.tokens - safeCost;
    if (nextTokens < 0) {
      return { ok: false, remaining: Math.max(0, existing.tokens), resetAt: existing.resetAt };
    }

    existing.tokens = nextTokens;
    return { ok: true, remaining: nextTokens, resetAt: existing.resetAt };
  }
}

