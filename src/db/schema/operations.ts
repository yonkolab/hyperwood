import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: varchar("action", { length: 128 }).notNull(),
    actor: varchar("actor", { length: 128 }),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: varchar("target_id", { length: 255 }).notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_audit_events_action_idx").on(table.action),
    index("admin_audit_events_target_idx").on(table.targetType, table.targetId),
    index("admin_audit_events_created_at_idx").on(table.createdAt),
  ],
);
