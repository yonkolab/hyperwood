import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { markets } from "./markets";
import { orders, orderOutcomeEnum } from "./orders";

export const marketCommandTypeEnum = pgEnum("market_command_type", [
  "order_create",
  "order_cancel",
  "match_execution",
]);

export const marketCommandEvents = pgTable(
  "market_command_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    commandType: marketCommandTypeEnum("command_type").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_command_events_market_id_idx").on(table.marketId),
    index("market_command_events_order_id_idx").on(table.orderId),
    uniqueIndex("market_command_events_market_sequence_unique").on(
      table.marketId,
      table.sequence,
    ),
  ],
);

export const marketTrades = pgTable(
  "market_trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    makerOrderId: uuid("maker_order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    takerOrderId: uuid("taker_order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    outcome: orderOutcomeEnum("outcome").notNull(),
    priceBps: integer("price_bps").notNull(),
    quantity: integer("quantity").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_trades_market_id_idx").on(table.marketId, table.executedAt),
    index("market_trades_maker_order_id_idx").on(table.makerOrderId),
    index("market_trades_taker_order_id_idx").on(table.takerOrderId),
  ],
);
