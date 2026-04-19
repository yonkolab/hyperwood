import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { apiRateLimitEvents } from '../../db/schema';
import type { RateLimitScopeType } from '../../lib/rate-limit';

export class RateLimitEventService {
  async recordExceededEvent(input: {
    bucket: string;
    limit: number;
    metadata?: Record<string, unknown>;
    method: string;
    observedCount: number;
    path: string;
    requestIp?: string;
    scopeKey: string;
    scopeType: RateLimitScopeType;
    windowEndsAt: Date;
    windowStartedAt: Date;
  }) {
    await db
      .insert(apiRateLimitEvents)
      .values({
        bucket: input.bucket,
        scopeType: input.scopeType,
        scopeKey: input.scopeKey,
        method: input.method,
        path: input.path,
        limit: input.limit,
        observedCount: input.observedCount,
        requestIp: input.requestIp,
        windowStartedAt: input.windowStartedAt,
        windowEndsAt: input.windowEndsAt,
        metadata: input.metadata ?? {},
      })
      .onConflictDoNothing();
  }

  async listEvents(input: {
    bucket?: string;
    limit: number;
    path?: string;
    scopeKey?: string;
    scopeType?: string;
  }) {
    const conditions = [
      input.bucket ? eq(apiRateLimitEvents.bucket, input.bucket) : undefined,
      input.scopeType
        ? eq(apiRateLimitEvents.scopeType, input.scopeType)
        : undefined,
      input.scopeKey
        ? eq(apiRateLimitEvents.scopeKey, input.scopeKey)
        : undefined,
      input.path ? eq(apiRateLimitEvents.path, input.path) : undefined,
    ].filter((condition) => condition !== undefined);

    const query = db
      .select()
      .from(apiRateLimitEvents)
      .orderBy(desc(apiRateLimitEvents.createdAt))
      .limit(Math.min(input.limit, 100));

    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

    return rows.map((row) => ({
      id: row.id,
      bucket: row.bucket,
      scopeType: row.scopeType,
      scopeKey: row.scopeKey,
      method: row.method,
      path: row.path,
      limit: row.limit,
      observedCount: row.observedCount,
      requestIp: row.requestIp,
      windowStartedAt: row.windowStartedAt.toISOString(),
      windowEndsAt: row.windowEndsAt.toISOString(),
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
