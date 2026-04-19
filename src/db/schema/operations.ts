import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const operationsAlertSeverityEnum = pgEnum('operations_alert_severity', [
  'warning',
  'critical',
]);

export const operationsAlertStatusEnum = pgEnum('operations_alert_status', [
  'open',
  'acknowledged',
  'resolved',
]);

export const adminAuditEvents = pgTable(
  'admin_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: varchar('action', { length: 128 }).notNull(),
    actor: varchar('actor', { length: 128 }),
    targetType: varchar('target_type', { length: 64 }).notNull(),
    targetId: varchar('target_id', { length: 255 }).notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('admin_audit_events_action_idx').on(table.action),
    index('admin_audit_events_target_idx').on(table.targetType, table.targetId),
    index('admin_audit_events_created_at_idx').on(table.createdAt),
  ],
);

export const operationsAlerts = pgTable(
  'operations_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: varchar('category', { length: 64 }).notNull(),
    severity: operationsAlertSeverityEnum('severity').notNull(),
    status: operationsAlertStatusEnum('status').notNull().default('open'),
    sourceType: varchar('source_type', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 255 }).notNull(),
    message: varchar('message', { length: 512 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('operations_alerts_source_unique').on(
      table.sourceType,
      table.sourceId,
    ),
    index('operations_alerts_status_idx').on(table.status),
    index('operations_alerts_severity_idx').on(table.severity),
    index('operations_alerts_category_idx').on(table.category),
    index('operations_alerts_created_at_idx').on(table.createdAt),
  ],
);

export const apiRateLimitEvents = pgTable(
  'api_rate_limit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bucket: varchar('bucket', { length: 64 }).notNull(),
    scopeType: varchar('scope_type', { length: 32 }).notNull(),
    scopeKey: varchar('scope_key', { length: 255 }).notNull(),
    method: varchar('method', { length: 16 }).notNull(),
    path: varchar('path', { length: 255 }).notNull(),
    limit: integer('limit').notNull(),
    observedCount: integer('observed_count').notNull(),
    requestIp: varchar('request_ip', { length: 64 }),
    windowStartedAt: timestamp('window_started_at', {
      withTimezone: true,
    }).notNull(),
    windowEndsAt: timestamp('window_ends_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('api_rate_limit_events_window_unique').on(
      table.bucket,
      table.scopeType,
      table.scopeKey,
      table.method,
      table.path,
      table.windowStartedAt,
    ),
    index('api_rate_limit_events_created_at_idx').on(table.createdAt),
    index('api_rate_limit_events_scope_idx').on(
      table.scopeType,
      table.scopeKey,
    ),
    index('api_rate_limit_events_path_idx').on(table.path),
  ],
);
