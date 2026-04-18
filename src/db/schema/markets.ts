import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const marketStatusEnum = pgEnum("market_status", [
  "draft",
  "scheduled",
  "active",
  "halted",
  "trading_closed",
  "awaiting_resolution",
  "settled",
  "cancelled",
  "disputed",
  "voided",
]);

export const marketEvents = pgTable(
  "market_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 128 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: text("summary"),
    category: varchar("category", { length: 64 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("market_events_slug_unique").on(table.slug),
    index("market_events_category_idx").on(table.category),
  ],
);

export const markets = pgTable(
  "markets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => marketEvents.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 128 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: text("summary"),
    status: marketStatusEnum("status").notNull().default("draft"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    resolutionRules: text("resolution_rules").notNull(),
    resolutionSources: jsonb("resolution_sources")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    yesPriceBps: integer("yes_price_bps").notNull().default(5000),
    noPriceBps: integer("no_price_bps").notNull().default(5000),
    volumeUsdMinor: bigint("volume_usd_minor", { mode: "number" }).notNull().default(0),
    lastCommandSequence: bigint("last_command_sequence", { mode: "number" })
      .notNull()
      .default(0),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    resolvesAt: timestamp("resolves_at", { withTimezone: true }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("markets_slug_unique").on(table.slug),
    index("markets_event_id_idx").on(table.eventId),
    index("markets_status_idx").on(table.status),
    index("markets_volume_usd_minor_idx").on(table.volumeUsdMinor),
    index("markets_closes_at_idx").on(table.closesAt),
  ],
);

export const marketEventsRelations = relations(marketEvents, ({ many }) => ({
  markets: many(markets),
}));

export const marketsRelations = relations(markets, ({ one }) => ({
  event: one(marketEvents, {
    fields: [markets.eventId],
    references: [marketEvents.id],
  }),
}));
