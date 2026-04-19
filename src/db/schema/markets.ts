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
import { users } from "./users";

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

export const marketCurrencyEnum = pgEnum("market_currency", ["USD", "BRL"]);

export const marketResolutionOutcomeEnum = pgEnum("market_resolution_outcome", [
  "yes",
  "no",
  "void",
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
    currency: marketCurrencyEnum("currency").notNull().default("USD"),
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

export const marketResolutions = pgTable(
  "market_resolutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    outcome: marketResolutionOutcomeEnum("outcome").notNull(),
    evidenceSummary: text("evidence_summary").notNull(),
    evidenceSources: jsonb("evidence_sources")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    approvedBy: varchar("approved_by", { length: 128 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("market_resolutions_market_id_unique").on(table.marketId),
    index("market_resolutions_outcome_idx").on(table.outcome),
  ],
);

export const marketSettlements = pgTable(
  "market_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    resolutionId: uuid("resolution_id")
      .notNull()
      .references(() => marketResolutions.id, { onDelete: "cascade" }),
    outcome: marketResolutionOutcomeEnum("outcome").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
    totalPayoutMinor: bigint("total_payout_minor", { mode: "number" }).notNull().default(0),
    affectedUserCount: integer("affected_user_count").notNull().default(0),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("market_settlements_market_id_unique").on(table.marketId),
    uniqueIndex("market_settlements_resolution_id_unique").on(table.resolutionId),
    index("market_settlements_settled_at_idx").on(table.settledAt),
  ],
);

export const marketStatusTransitions = pgTable(
  "market_status_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    fromStatus: marketStatusEnum("from_status"),
    toStatus: marketStatusEnum("to_status").notNull(),
    reason: text("reason").notNull(),
    changedBy: varchar("changed_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_status_transitions_market_id_idx").on(table.marketId, table.createdAt),
  ],
);

export const marketSettlementPayouts = pgTable(
  "market_settlement_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => marketSettlements.id, { onDelete: "cascade" }),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outcome: marketResolutionOutcomeEnum("outcome").notNull(),
    quantity: integer("quantity").notNull(),
    costBasisMinor: bigint("cost_basis_minor", { mode: "number" }).notNull(),
    payoutMinor: bigint("payout_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_settlement_payouts_settlement_id_idx").on(table.settlementId),
    index("market_settlement_payouts_market_user_idx").on(table.marketId, table.userId),
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

export const marketStatusTransitionsRelations = relations(
  marketStatusTransitions,
  ({ one }) => ({
    market: one(markets, {
      fields: [marketStatusTransitions.marketId],
      references: [markets.id],
    }),
  }),
);

export const marketResolutionsRelations = relations(marketResolutions, ({ one }) => ({
  market: one(markets, {
    fields: [marketResolutions.marketId],
    references: [markets.id],
  }),
}));

export const marketSettlementsRelations = relations(marketSettlements, ({ one, many }) => ({
  market: one(markets, {
    fields: [marketSettlements.marketId],
    references: [markets.id],
  }),
  resolution: one(marketResolutions, {
    fields: [marketSettlements.resolutionId],
    references: [marketResolutions.id],
  }),
  payouts: many(marketSettlementPayouts),
}));

export const marketSettlementPayoutsRelations = relations(
  marketSettlementPayouts,
  ({ one }) => ({
    settlement: one(marketSettlements, {
      fields: [marketSettlementPayouts.settlementId],
      references: [marketSettlements.id],
    }),
    market: one(markets, {
      fields: [marketSettlementPayouts.marketId],
      references: [markets.id],
    }),
  }),
);
