import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { markets } from "./markets";
import { orders } from "./orders";

export const marketCommandTypeEnum = pgEnum("market_command_type", [
  "order_create",
  "order_cancel",
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
