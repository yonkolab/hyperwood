import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { marketCommandEvents, markets, orders } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { DbExecutor } from './types';

export class MatchableOrderQueryService {
  /**
   * Load and validate one market before matching starts.
   *
   * Example:
   * `await matchableOrderQueryService.assertMarketMatchable(tx, marketId)`
   */
  async assertMarketMatchable(executor: DbExecutor, marketId: string) {
    const [market] = await executor
      .select({
        id: markets.id,
        status: markets.status,
        lastCommandSequence: markets.lastCommandSequence,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      throw new AppError(
        404,
        'market_not_found',
        `market was not found for id ${marketId}`,
      );
    }

    if (market.status !== 'active') {
      throw new AppError(
        409,
        'market_not_matchable',
        `market ${marketId} is not active for matching, received status ${market.status}`,
      );
    }

    return market;
  }

  /**
   * Load all currently matchable limit orders with their authoritative priority.
   *
   * Example:
   * `await matchableOrderQueryService.loadMatchableOrders(tx, marketId)`
   */
  async loadMatchableOrders(executor: DbExecutor, marketId: string) {
    const orderRows = await executor
      .select({
        id: orders.id,
        userId: orders.userId,
        marketId: orders.marketId,
        outcome: orders.outcome,
        side: orders.side,
        quantity: orders.quantity,
        filledQuantity: orders.filledQuantity,
        limitPriceBps: orders.limitPriceBps,
        referencePriceBps: orders.referencePriceBps,
        reservedAmountMinor: orders.reservedAmountMinor,
        currency: orders.currency,
        status: orders.status,
      })
      .from(orders)
      .where(
        and(
          eq(orders.marketId, marketId),
          inArray(orders.status, ['queued_for_matching', 'partially_filled']),
          eq(orders.type, 'limit'),
        ),
      );

    if (orderRows.length === 0) {
      return [];
    }

    const createCommandRows = await executor
      .select({
        orderId: marketCommandEvents.orderId,
        sequence: marketCommandEvents.sequence,
      })
      .from(marketCommandEvents)
      .where(
        and(
          eq(marketCommandEvents.marketId, marketId),
          eq(marketCommandEvents.commandType, 'order_create'),
          inArray(
            marketCommandEvents.orderId,
            orderRows.map((order) => order.id),
          ),
        ),
      )
      .orderBy(asc(marketCommandEvents.sequence));

    const createSequenceByOrderId = new Map(
      createCommandRows.map((row) => [row.orderId, row.sequence]),
    );

    return orderRows.map((order) => {
      const createSequence = createSequenceByOrderId.get(order.id);

      if (typeof createSequence !== 'number') {
        throw new AppError(
          500,
          'order_priority_missing',
          `missing authoritative create sequence for active order ${order.id}`,
        );
      }

      if (typeof order.limitPriceBps !== 'number') {
        throw new AppError(
          500,
          'invalid_order_state',
          `limit order ${order.id} is missing limit price`,
        );
      }

      if (
        order.status !== 'queued_for_matching' &&
        order.status !== 'partially_filled'
      ) {
        throw new AppError(
          500,
          'invalid_order_state',
          `order ${order.id} is not matchable from status ${order.status}`,
        );
      }

      return {
        ...order,
        limitPriceBps: order.limitPriceBps,
        status: order.status,
        createSequence,
      };
    });
  }

  /**
   * Serialize writes for one market inside the matching transaction.
   *
   * Example:
   * `await matchableOrderQueryService.acquireMarketWriteLock(tx, marketId)`
   */
  async acquireMarketWriteLock(executor: DbExecutor, marketId: string) {
    await executor.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${marketId}, 0))`,
    );
  }
}
