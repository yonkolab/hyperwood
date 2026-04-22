import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
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
} from 'drizzle-orm/pg-core';
import { markets } from './markets';
import { users } from './users';

export const orderTypeEnum = pgEnum('order_type', ['limit', 'market']);
export const orderSideEnum = pgEnum('order_side', ['buy', 'sell']);
export const orderOutcomeEnum = pgEnum('order_outcome', ['yes', 'no']);
export const orderStatusEnum = pgEnum('order_status', [
  'queued_for_matching',
  'partially_filled',
  'filled',
  'cancelled',
]);
export const selfTradePreventionEnum = pgEnum('self_trade_prevention', [
  'decrement_and_cancel',
  'cancel_oldest',
  'cancel_newest',
]);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    marketId: uuid('market_id')
      .notNull()
      .references(() => markets.id, { onDelete: 'cascade' }),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    requestHash: text('request_hash').notNull(),
    type: orderTypeEnum('type').notNull(),
    side: orderSideEnum('side').notNull(),
    outcome: orderOutcomeEnum('outcome').notNull(),
    status: orderStatusEnum('status').notNull().default('queued_for_matching'),
    quantity: integer('quantity').notNull(),
    filledQuantity: integer('filled_quantity').notNull().default(0),
    limitPriceBps: integer('limit_price_bps'),
    referencePriceBps: integer('reference_price_bps').notNull(),
    reservedAmountMinor: bigint('reserved_amount_minor', {
      mode: 'number',
    }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    selfTradePrevention: selfTradePreventionEnum('self_trade_prevention')
      .notNull()
      .default('decrement_and_cancel'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('orders_user_id_idx').on(table.userId),
    index('orders_market_id_idx').on(table.marketId),
    index('orders_user_status_idx').on(table.userId, table.status),
    uniqueIndex('orders_user_idempotency_key_unique').on(
      table.userId,
      table.idempotencyKey,
    ),
  ],
);

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [orders.marketId],
    references: [markets.id],
  }),
}));
