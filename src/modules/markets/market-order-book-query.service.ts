import { and, asc, eq, gt, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  asRecord,
  assertMarketExists,
  buildOutcomeBook,
  marketCommandEvents,
  orderOutcomeEnum,
  orderSideEnum,
  orders,
  orderTypeEnum,
  pickEnumValue,
  pickNullableNumber,
  pickNumber,
  pickString,
} from './market-workflow-support';
import type { OrderOutcome, OrderSide, OrderType } from './types';

export class MarketOrderBookQueryService {
  async getOrderBookSnapshot(marketId: string) {
    const market = await assertMarketExists(marketId);

    const rows = await db
      .select({
        outcome: orders.outcome,
        side: orders.side,
        priceBps: orders.limitPriceBps,
        totalQuantity: sql<string>`sum(${orders.quantity} - ${orders.filledQuantity})`,
        orderCount: sql<string>`count(*)`,
        latestOrderAt: sql<Date>`max(${orders.createdAt})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.marketId, marketId),
          or(
            eq(orders.status, 'queued_for_matching'),
            eq(orders.status, 'partially_filled'),
          ),
          eq(orders.type, 'limit'),
        ),
      )
      .groupBy(orders.outcome, orders.side, orders.limitPriceBps);

    const priceLevels = rows
      .filter(
        (row): row is typeof row & { priceBps: number } =>
          typeof row.priceBps === 'number',
      )
      .map((row) => ({
        outcome: row.outcome,
        side: row.side,
        priceBps: row.priceBps,
        totalQuantity: Number(row.totalQuantity),
        orderCount: Number(row.orderCount),
        latestOrderAt: row.latestOrderAt,
      }));

    return {
      marketId,
      snapshot: {
        asOf: new Date().toISOString(),
        sequence: market.lastCommandSequence,
        sequenceToken: `${marketId}:${market.lastCommandSequence}`,
        totalPriceLevels: priceLevels.length,
      },
      books: {
        yes: buildOutcomeBook(
          priceLevels.filter((level) => level.outcome === 'yes'),
        ),
        no: buildOutcomeBook(
          priceLevels.filter((level) => level.outcome === 'no'),
        ),
      },
    };
  }

  async getOrderBookDeltas(
    marketId: string,
    input: {
      afterSequence: number;
      limit: number;
    },
  ) {
    const market = await assertMarketExists(marketId);
    const pageSize = Math.min(input.limit, 500);

    const rows = await db
      .select({
        id: marketCommandEvents.id,
        sequence: marketCommandEvents.sequence,
        commandType: marketCommandEvents.commandType,
        metadata: marketCommandEvents.metadata,
        createdAt: marketCommandEvents.createdAt,
        orderId: orders.id,
        orderType: orders.type,
        side: orders.side,
        outcome: orders.outcome,
        quantity: orders.quantity,
        limitPriceBps: orders.limitPriceBps,
        referencePriceBps: orders.referencePriceBps,
        reservedAmountMinor: orders.reservedAmountMinor,
        currency: orders.currency,
      })
      .from(marketCommandEvents)
      .innerJoin(orders, eq(orders.id, marketCommandEvents.orderId))
      .where(
        and(
          eq(marketCommandEvents.marketId, marketId),
          gt(marketCommandEvents.sequence, input.afterSequence),
        ),
      )
      .orderBy(asc(marketCommandEvents.sequence))
      .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const pageRows = rows.slice(0, pageSize);
    const endingSequence = pageRows.at(-1)?.sequence ?? input.afterSequence;

    return {
      marketId,
      recovery: {
        requestedAfterSequence: input.afterSequence,
        latestSequence: market.lastCommandSequence,
        hasMore,
        nextAfterSequence: hasMore ? endingSequence : null,
        sequenceToken: `${marketId}:${market.lastCommandSequence}`,
      },
      deltas: pageRows.map((row) => {
        const metadata = asRecord(row.metadata);
        const orderType = pickEnumValue<OrderType>(
          metadata.orderType,
          row.orderType,
          orderTypeEnum.enumValues,
        );
        const side = pickEnumValue<OrderSide>(
          metadata.side,
          row.side,
          orderSideEnum.enumValues,
        );
        const outcome = pickEnumValue<OrderOutcome>(
          metadata.outcome,
          row.outcome,
          orderOutcomeEnum.enumValues,
        );
        const quantity = pickNumber(metadata.quantity, row.quantity);
        const limitPriceBps = pickNullableNumber(
          metadata.limitPriceBps,
          row.limitPriceBps,
        );
        const referencePriceBps = pickNumber(
          metadata.referencePriceBps,
          row.referencePriceBps,
        );
        const reservedAmountMinor = pickNumber(
          metadata.reservedAmountMinor,
          row.reservedAmountMinor,
        );
        const trade =
          row.commandType === 'match_execution'
            ? {
                tradeId: pickString(metadata.tradeId, ''),
                makerOrderId: pickString(metadata.makerOrderId, ''),
                takerOrderId: pickString(metadata.takerOrderId, row.orderId),
                outcome: pickEnumValue<OrderOutcome>(
                  metadata.outcome,
                  outcome,
                  orderOutcomeEnum.enumValues,
                ),
                priceBps: pickNumber(metadata.priceBps, referencePriceBps),
                quantity: pickNumber(metadata.quantity, quantity),
              }
            : null;
        const bookEffect =
          row.commandType === 'match_execution'
            ? pickString(metadata.bookEffect, 'trade')
            : orderType !== 'limit'
              ? 'none'
              : row.commandType === 'order_create'
                ? 'resting_add'
                : 'resting_remove';

        return {
          id: row.id,
          sequence: row.sequence,
          occurredAt: row.createdAt.toISOString(),
          commandType: row.commandType,
          bookEffect,
          affectsBook: bookEffect !== 'none',
          order: {
            id: row.orderId,
            type: orderType,
            side,
            outcome,
            quantity,
            limitPriceBps,
            referencePriceBps,
            reservedAmountMinor,
            currency: pickString(metadata.currency, row.currency),
            stateAtSequence:
              row.commandType === 'order_create'
                ? 'queued_for_matching'
                : row.commandType === 'order_cancel'
                  ? 'cancelled'
                  : pickNumber(metadata.takerRemainingQuantity, 0) === 0
                    ? 'filled'
                    : 'partially_filled',
          },
          ...(trade ? { trade } : {}),
          metadata,
        };
      }),
    };
  }
}
