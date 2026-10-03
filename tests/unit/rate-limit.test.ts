import { describe, expect, it } from "vitest";
import { TokenBucketLimiter } from "@/lib/rate-limit/bucket";

describe("TokenBucketLimiter", () => {
  it("allows `capacity` requests, then blocks", () => {
    const b = new TokenBucketLimiter(5, 600_000);
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(b.take("a", t).ok).toBe(true);
    const blocked = b.take("a", t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("reports remaining tokens", () => {
    const b = new TokenBucketLimiter(3, 60_000);
    expect(b.take("a", 0).remaining).toBe(2);
    expect(b.take("a", 0).remaining).toBe(1);
    expect(b.take("a", 0).remaining).toBe(0);
  });

  it("refills over time (one token every window/capacity)", () => {
    const b = new TokenBucketLimiter(5, 600_000); // 1 token / 2 min
    for (let i = 0; i < 5; i++) b.take("a", 0);
    expect(b.take("a", 60_000).ok).toBe(false);
    expect(b.take("a", 120_000).ok).toBe(true);
    expect(b.take("a", 120_000).ok).toBe(false);
  });

  it("never refills beyond capacity", () => {
    const b = new TokenBucketLimiter(2, 1000);
    b.take("a", 0);
    for (let i = 0; i < 2; i++) expect(b.take("a", 1_000_000).ok).toBe(true);
    expect(b.take("a", 1_000_000).ok).toBe(false);
  });

  it("keeps separate buckets per key", () => {
    const b = new TokenBucketLimiter(1, 60_000);
    expect(b.take("a", 0).ok).toBe(true);
    expect(b.take("a", 0).ok).toBe(false);
    expect(b.take("b", 0).ok).toBe(true);
  });

  it("evicts fully refilled keys so memory stays bounded", () => {
    const b = new TokenBucketLimiter(1, 1000, 10);
    for (let i = 0; i < 10; i++) b.take(`k${i}`, 0);
    b.take("trigger", 5000); // all earlier keys are long refilled
    // @ts-expect-error reading private state for the assertion
    expect(b.entries.size).toBeLessThan(10);
  });
});
