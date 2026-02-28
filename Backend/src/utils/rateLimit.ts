// Per-user rate limiting with sliding window and failed-auth tracking.
// Uses an in-memory Map — resets on process restart.
// For multi-instance deployments, replace with Redis-backed counters.

interface WindowEntry {
  count: number;
  windowStart: number;
}

interface FailedAuthEntry {
  count: number;
  windowStart: number;
}

export interface RateLimitResult {
  /** Milliseconds until the window resets */
  retryAfterMs: number;
}

export interface UserRateLimiterOptions {
  /** Max requests allowed per window. Default: 100 */
  maxRequests?: number;
  /** Window size in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number;
  /** Max failed auth attempts before account lock. Default: 10 */
  maxFailedAuth?: number;
  /** Window for failed auth count in milliseconds. Default: 300_000 (5 minutes) */
  failedAuthWindowMs?: number;
}

export class UserRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxFailedAuth: number;
  private readonly failedAuthWindowMs: number;

  private windows = new Map<string, WindowEntry>();
  private failedAuth = new Map<string, FailedAuthEntry>();

  constructor(opts: UserRateLimiterOptions = {}) {
    this.maxRequests = opts.maxRequests ?? 100;
    this.windowMs = opts.windowMs ?? 60_000;
    this.maxFailedAuth = opts.maxFailedAuth ?? 10;
    this.failedAuthWindowMs = opts.failedAuthWindowMs ?? 300_000;
  }

  /**
   * Check whether userId has exceeded their per-user rate limit.
   * Returns null if allowed, or { retryAfterMs } if blocked.
   */
  check(userId: string): RateLimitResult | null {
    const now = Date.now();
    const entry = this.windows.get(userId);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      // New window
      this.windows.set(userId, { count: 1, windowStart: now });
      return null;
    }

    entry.count++;
    if (entry.count > this.maxRequests) {
      const retryAfterMs = this.windowMs - (now - entry.windowStart);
      return { retryAfterMs };
    }

    return null;
  }

  /** Record a failed authentication attempt for an identifier (email or userId). */
  recordFailedAuth(identifier: string): void {
    const now = Date.now();
    const entry = this.failedAuth.get(identifier);

    if (!entry || now - entry.windowStart >= this.failedAuthWindowMs) {
      this.failedAuth.set(identifier, { count: 1, windowStart: now });
    } else {
      entry.count++;
    }
  }

  /** Returns true if the account should be locked due to too many failed auth attempts. */
  isAccountLocked(identifier: string): boolean {
    const now = Date.now();
    const entry = this.failedAuth.get(identifier);
    if (!entry) return false;
    if (now - entry.windowStart >= this.failedAuthWindowMs) return false;
    return entry.count >= this.maxFailedAuth;
  }

  /** Get the current failed auth count for an identifier. */
  getFailedAuthCount(identifier: string): number {
    const now = Date.now();
    const entry = this.failedAuth.get(identifier);
    if (!entry || now - entry.windowStart >= this.failedAuthWindowMs) return 0;
    return entry.count;
  }

  /** Reset failed auth count after a successful authentication. */
  resetFailedAuth(identifier: string): void {
    this.failedAuth.delete(identifier);
  }

  /** Prune stale entries to prevent unbounded memory growth. Call periodically. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now - entry.windowStart >= this.windowMs) this.windows.delete(key);
    }
    for (const [key, entry] of this.failedAuth) {
      if (now - entry.windowStart >= this.failedAuthWindowMs) this.failedAuth.delete(key);
    }
  }
}

// Singleton instance used in the Apollo context
export const userRateLimiter = new UserRateLimiter();

// Prune stale entries every 10 minutes
setInterval(() => userRateLimiter.prune(), 10 * 60 * 1000).unref();
