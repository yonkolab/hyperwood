import { and, eq, sql } from 'drizzle-orm';
import { marketCommandEvents, markets } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { DbExecutor, MarketCommandType } from './types';

export class OrderCommandEventService {
  /**
   * Serialize writes on one market inside the current transaction.
   *
   * Example:
   * `await orderCommandEventService.acquireMarketWriteLock(tx, marketId)`
   */
  async acquireMarketWriteLock(executor: DbExecutor, marketId: string) {
    await executor.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${marketId}, 0))`,
    );
  }

  /**
   * Advance the market sequence and persist one market command event.
   *
   * Example:
   * `await orderCommandEventService.recordMarketCommand(tx, { marketId, orderId, commandType: 'order_create' })`
   */
  async recordMarketCommand(
    executor: DbExecutor,
    input: {
      marketId: string;
      orderId: string;
      commandType: MarketCommandType;
      metadata?: Record<string, unknown>;
    },
  ) {
    const updatedMarketRows = await executor
      .update(markets)
      .set({
        lastCommandSequence: sql`${markets.lastCommandSequence} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(markets.id, input.marketId))
      .returning({
        lastCommandSequence: markets.lastCommandSequence,
      });
    const updatedMarket = updatedMarketRows[0];

    if (!updatedMarket) {
      throw new AppError(
        500,
        'market_sequence_failed',
        `failed to advance market sequence for market ${input.marketId}`,
      );
    }

    const commandRows = await executor
      .insert(marketCommandEvents)
      .values({
        marketId: input.marketId,
        orderId: input.orderId,
        sequence: updatedMarket.lastCommandSequence,
        commandType: input.commandType,
        metadata: input.metadata ?? {},
      })
      .returning();
    const command = commandRows[0];

    if (!command) {
      throw new AppError(
        500,
        'market_command_failed',
        `failed to record market command ${input.commandType} for order ${input.orderId}`,
      );
    }

    return command;
  }

  /**
   * Return an existing market command for idempotent replay flows.
   *
   * Example:
   * `await orderCommandEventService.findExistingMarketCommand(tx, orderId, 'order_cancel')`
   */
  async findExistingMarketCommand(
    executor: DbExecutor,
    orderId: string,
    commandType: MarketCommandType,
  ) {
    const rows = await executor
      .select()
      .from(marketCommandEvents)
      .where(
        and(
          eq(marketCommandEvents.orderId, orderId),
          eq(marketCommandEvents.commandType, commandType),
        ),
      )
      .limit(1);

    return rows[0];
  }
}
