import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export type ExchangeScheduleWindow = {
  closesAt: string;
  opensAt: string;
  weekday:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
};

export type ExchangeScheduleMaintenance = {
  endsAt: string;
  message: string;
  startsAt: string;
};

export const exchangeSchedules = pgTable(
  'exchange_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 160 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull(),
    weeklyWindows: jsonb('weekly_windows')
      .$type<ExchangeScheduleWindow[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    maintenanceWindows: jsonb('maintenance_windows')
      .$type<ExchangeScheduleMaintenance[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('exchange_schedules_updated_at_idx').on(table.updatedAt)],
);
