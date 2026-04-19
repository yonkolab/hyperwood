import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { operationsAlerts } from '../../db/schema';

type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class OperationsAlertService {
  async createAlert(
    input: {
      category: string;
      severity: 'warning' | 'critical';
      sourceType: string;
      sourceId: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
    executor: DbExecutor = db,
  ) {
    const rows = await executor
      .insert(operationsAlerts)
      .values({
        category: input.category,
        severity: input.severity,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        message: input.message,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    return rows[0] ?? null;
  }

  async listAlerts(input: {
    limit: number;
    category?: string;
    severity?: 'warning' | 'critical';
    status?: 'open' | 'acknowledged' | 'resolved';
    sourceType?: string;
  }) {
    const rows = await db
      .select()
      .from(operationsAlerts)
      .where(
        and(
          input.category
            ? eq(operationsAlerts.category, input.category)
            : undefined,
          input.severity
            ? eq(operationsAlerts.severity, input.severity)
            : undefined,
          input.status ? eq(operationsAlerts.status, input.status) : undefined,
          input.sourceType
            ? eq(operationsAlerts.sourceType, input.sourceType)
            : undefined,
        ),
      )
      .orderBy(desc(operationsAlerts.createdAt))
      .limit(Math.min(input.limit, 100));

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      severity: row.severity,
      status: row.status,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      message: row.message,
      metadata: this.asRecord(row.metadata),
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
