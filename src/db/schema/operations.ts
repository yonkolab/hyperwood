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

export const transactionalEmailStatusEnum = pgEnum(
  'transactional_email_status',
  ['development_override', 'queued', 'failed'],
);

export const transactionalEmailFeedbackStatusEnum = pgEnum(
  'transactional_email_feedback_status',
  [
    'sent',
    'delivered',
    'deferred',
    'soft_bounced',
    'hard_bounced',
    'complained',
  ],
);

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

export const transactionalEmailAttempts = pgTable(
  'transactional_email_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    messageType: varchar('message_type', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 32 }),
    sourceType: varchar('source_type', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 255 }).notNull(),
    status: transactionalEmailStatusEnum('status').notNull(),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    errorCode: varchar('error_code', { length: 128 }),
    errorMessage: varchar('error_message', { length: 512 }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('transactional_email_attempts_user_id_idx').on(table.userId),
    index('transactional_email_attempts_recipient_idx').on(
      table.recipientEmail,
    ),
    index('transactional_email_attempts_message_type_idx').on(
      table.messageType,
    ),
    index('transactional_email_attempts_source_idx').on(
      table.sourceType,
      table.sourceId,
    ),
    index('transactional_email_attempts_status_idx').on(table.status),
    index('transactional_email_attempts_created_at_idx').on(table.createdAt),
  ],
);

export const transactionalEmailFeedbackEvents = pgTable(
  'transactional_email_feedback_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 32 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    status: transactionalEmailFeedbackStatusEnum('status').notNull(),
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    recipientEmail: varchar('recipient_email', { length: 255 }),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('transactional_email_feedback_events_provider_unique').on(
      table.provider,
      table.providerEventId,
      table.eventType,
    ),
    index('transactional_email_feedback_events_message_idx').on(
      table.providerMessageId,
    ),
    index('transactional_email_feedback_events_recipient_idx').on(
      table.recipientEmail,
    ),
    index('transactional_email_feedback_events_status_idx').on(table.status),
    index('transactional_email_feedback_events_occurred_at_idx').on(
      table.occurredAt,
    ),
  ],
);

export const suppressedEmailRecipients = pgTable(
  'suppressed_email_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    reason: varchar('reason', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 32 }).notNull(),
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    sourceType: varchar('source_type', { length: 64 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('suppressed_email_recipients_active_unique').on(table.email),
    index('suppressed_email_recipients_reason_idx').on(table.reason),
    index('suppressed_email_recipients_created_at_idx').on(table.createdAt),
  ],
);
