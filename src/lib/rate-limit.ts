export type RateLimitScopeType = 'api_key' | 'email' | 'ip';

type RateLimitBucketState = {
  count: number;
  resetAtMs: number;
  exceededEventRecorded: boolean;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  observedCount: number;
  resetAt: Date;
  shouldRecordExceededEvent: boolean;
  windowStartedAt: Date;
};

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucketState>();

  evaluate(input: {
    bucket: string;
    limit: number;
    now?: Date;
    scopeKey: string;
    scopeType: RateLimitScopeType;
    windowSeconds: number;
  }): RateLimitDecision {
    const nowMs = input.now?.getTime() ?? Date.now();
    const bucketKey = `${input.bucket}:${input.scopeType}:${input.scopeKey}`;
    const resetAtMs = nowMs + input.windowSeconds * 1000;
    let state = this.buckets.get(bucketKey);

    if (!state || nowMs >= state.resetAtMs) {
      state = {
        count: 0,
        resetAtMs,
        exceededEventRecorded: false,
      };
      this.buckets.set(bucketKey, state);
    }

    state.count += 1;

    const allowed = state.count <= input.limit;
    const shouldRecordExceededEvent = !allowed && !state.exceededEventRecorded;

    if (shouldRecordExceededEvent) {
      state.exceededEventRecorded = true;
    }

    return {
      allowed,
      limit: input.limit,
      remaining: Math.max(input.limit - state.count, 0),
      observedCount: state.count,
      resetAt: new Date(state.resetAtMs),
      shouldRecordExceededEvent,
      windowStartedAt: new Date(state.resetAtMs - input.windowSeconds * 1000),
    };
  }
}
