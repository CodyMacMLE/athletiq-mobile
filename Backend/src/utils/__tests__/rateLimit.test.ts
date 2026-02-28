import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRateLimiter } from "../rateLimit.js";

describe("UserRateLimiter", () => {
  let limiter: UserRateLimiter;

  beforeEach(() => {
    // 5 requests per 1000ms window for fast testing
    limiter = new UserRateLimiter({ maxRequests: 5, windowMs: 1000 });
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("user_1")).toBeNull();
    }
  });

  it("blocks the 6th request and returns retryAfterMs", () => {
    for (let i = 0; i < 5; i++) limiter.check("user_1");
    const result = limiter.check("user_1");
    expect(result).not.toBeNull();
    expect(result!.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks different users independently", () => {
    for (let i = 0; i < 5; i++) limiter.check("user_1");
    // user_2 should not be blocked
    expect(limiter.check("user_2")).toBeNull();
  });

  it("resets count after the window expires", async () => {
    for (let i = 0; i < 5; i++) limiter.check("user_1");
    expect(limiter.check("user_1")).not.toBeNull(); // blocked

    await new Promise((r) => setTimeout(r, 1100)); // wait for window to expire
    expect(limiter.check("user_1")).toBeNull(); // should be allowed again
  });

  it("records a failed auth attempt", () => {
    limiter.recordFailedAuth("user_1");
    expect(limiter.getFailedAuthCount("user_1")).toBe(1);
  });

  it("detects locked account after 10 failures in 5 minutes", () => {
    for (let i = 0; i < 10; i++) limiter.recordFailedAuth("user_1");
    expect(limiter.isAccountLocked("user_1")).toBe(true);
  });

  it("does not lock account below 10 failures", () => {
    for (let i = 0; i < 9; i++) limiter.recordFailedAuth("user_1");
    expect(limiter.isAccountLocked("user_1")).toBe(false);
  });

  it("resets failed auth count on successful auth", () => {
    for (let i = 0; i < 5; i++) limiter.recordFailedAuth("user_1");
    limiter.resetFailedAuth("user_1");
    expect(limiter.getFailedAuthCount("user_1")).toBe(0);
  });
});
