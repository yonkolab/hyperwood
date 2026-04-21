import { eq, sql } from 'drizzle-orm';
import { marketCommandEvents, markets } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { DbExecutor } from './types';

export class MarketMatchCommandService {
  /**
   * Advance one market sequence and persist one match execution command.
   *
   * Example:
   * `await marketMatchCommandService.recordMarketCommand(tx, { marketId, orderId, metadata })`
   */
  async recordMarketCommand(
    executor: DbExecutor,
    input: {
      marketId: string;
      orderId: string;
      metadata: Record<string, unknown>;
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
        commandType: 'match_execution',
        metadata: input.metadata,
      })
      .returning();
    const command = commandRows[0];

    if (!command) {
      throw new AppError(
        500,
        'market_command_failed',
        `failed to record match execution command for order ${input.orderId}`,
      );
    }

    return command;
  }
}
