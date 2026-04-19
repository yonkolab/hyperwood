import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { adminAuditEvents } from "../../db/schema";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AdminAuditService {
  async recordEvent(
    input: {
      action: string;
      actor?: string;
      targetType: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
    executor: DbExecutor = db,
  ) {
    const rows = await executor
      .insert(adminAuditEvents)
      .values({
        action: input.action,
        actor: input.actor,
        targetType: input.targetType,
        targetId: input.targetId,
        payload: input.payload ?? {},
      })
      .returning();

    return rows[0] ?? null;
  }

  async listEvents(input: {
    limit: number;
    targetType?: string;
    targetId?: string;
    action?: string;
  }) {
    const rows = await db
      .select()
      .from(adminAuditEvents)
      .where(
        and(
          input.targetType ? eq(adminAuditEvents.targetType, input.targetType) : undefined,
          input.targetId ? eq(adminAuditEvents.targetId, input.targetId) : undefined,
          input.action ? eq(adminAuditEvents.action, input.action) : undefined,
        ),
      )
      .orderBy(desc(adminAuditEvents.createdAt))
      .limit(Math.min(input.limit, 100));

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      targetType: row.targetType,
      targetId: row.targetId,
      payload: this.asRecord(row.payload),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
