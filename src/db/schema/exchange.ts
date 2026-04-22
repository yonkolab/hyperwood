import { sql } from 'drizzle-orm';
import {
  index,
  integer,
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

export const exchangeFeeSchedules = pgTable(
  'exchange_fee_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 160 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    makerFeeBps: integer('maker_fee_bps').notNull(),
    takerFeeBps: integer('taker_fee_bps').notNull(),
    effectiveFrom: timestamp('effective_from', {
      withTimezone: true,
    }).notNull(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('exchange_fee_schedules_currency_idx').on(table.currency),
    index('exchange_fee_schedules_effective_from_idx').on(table.effectiveFrom),
  ],
);
