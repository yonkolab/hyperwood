import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

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
