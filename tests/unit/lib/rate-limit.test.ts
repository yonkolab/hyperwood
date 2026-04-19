import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "../../../src/lib/rate-limit";

describe("InMemoryRateLimiter", () => {
  it("records only the first exceeded request in a window", () => {
    const limiter = new InMemoryRateLimiter();
    const now = new Date("2026-04-19T03:00:00.000Z");

    const first = limiter.evaluate({
      bucket: "auth_external",
      limit: 2,
      now,
      scopeKey: "user@example.com",
      scopeType: "email",
      windowSeconds: 60,
    });
    const second = limiter.evaluate({
      bucket: "auth_external",
      limit: 2,
      now,
      scopeKey: "user@example.com",
      scopeType: "email",
      windowSeconds: 60,
    });
    const third = limiter.evaluate({
      bucket: "auth_external",
      limit: 2,
      now,
      scopeKey: "user@example.com",
      scopeType: "email",
      windowSeconds: 60,
    });
    const fourth = limiter.evaluate({
      bucket: "auth_external",
      limit: 2,
      now,
      scopeKey: "user@example.com",
      scopeType: "email",
      windowSeconds: 60,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.shouldRecordExceededEvent).toBe(true);
    expect(fourth.allowed).toBe(false);
    expect(fourth.shouldRecordExceededEvent).toBe(false);
  });
});
