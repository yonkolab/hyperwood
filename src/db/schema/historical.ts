import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const historicalExportScopeEnum = pgEnum('historical_export_scope', [
  'account_history',
]);

export const historicalExportStatusEnum = pgEnum('historical_export_status', [
  'completed',
]);

export const historicalExportFormatEnum = pgEnum('historical_export_format', [
  'json',
]);

export const historicalExportJobs = pgTable(
  'historical_export_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: historicalExportScopeEnum('scope').notNull(),
    status: historicalExportStatusEnum('status').notNull().default('completed'),
    format: historicalExportFormatEnum('format').notNull().default('json'),
    currency: varchar('currency', { length: 3 }).notNull(),
    artifact: jsonb('artifact')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('historical_export_jobs_user_id_idx').on(table.userId),
    index('historical_export_jobs_scope_idx').on(table.scope),
    index('historical_export_jobs_created_at_idx').on(table.createdAt),
  ],
);

export const historicalExportJobsRelations = relations(
  historicalExportJobs,
  ({ one }) => ({
    user: one(users, {
      fields: [historicalExportJobs.userId],
      references: [users.id],
    }),
  }),
);
