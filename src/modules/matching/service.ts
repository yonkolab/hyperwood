import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { marketTrades, orders } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { ExchangeService } from '../exchange/service';
import { MarketMatchCommandService } from './market-match-command.service';
import { MatchSettlementLedgerService } from './match-settlement-ledger.service';
import { MatchableOrderQueryService } from './matchable-order-query.service';
import { TradePlanningService } from './trade-planning.service';

export class MatchingService {
  private readonly exchangeService = new ExchangeService();
  private readonly matchableOrderQueryService =
    new MatchableOrderQueryService();
  private readonly tradePlanningService = new TradePlanningService();
  private readonly matchSettlementLedgerService =
    new MatchSettlementLedgerService();
  private readonly marketMatchCommandService = new MarketMatchCommandService();

  async runLimitOrderMatching(marketId: string) {
    return db.transaction(async (tx) => {
      const market =
        await this.matchableOrderQueryService.assertMarketMatchable(
          tx,
          marketId,
        );
      await this.exchangeService.assertTradingOpen(tx);

      await this.matchableOrderQueryService.acquireMarketWriteLock(
        tx,
        market.id,
      );

      const activeOrders =
        await this.matchableOrderQueryService.loadMatchableOrders(
          tx,
          market.id,
        );
      const plannedTrades = this.tradePlanningService.planTrades(activeOrders);

      if (plannedTrades.length === 0) {
        return {
          marketId,
          summary: {
            matchedTradeCount: 0,
            touchedOrderCount: 0,
            latestSequence: market.lastCommandSequence,
          },
          trades: [],
          orders: [],
        };
      }

      const insertedTrades = await tx
        .insert(marketTrades)
        .values(
          plannedTrades.map((trade) => ({
            marketId: trade.marketId,
            makerOrderId: trade.makerOrderId,
            takerOrderId: trade.takerOrderId,
            outcome: trade.outcome,
            priceBps: trade.priceBps,
            quantity: trade.quantity,
            executedAt: trade.executedAt,
          })),
        )
        .returning();

      const { nextStates, collateralMoves } =
        this.tradePlanningService.applyTradesToStates(
          activeOrders,
          plannedTrades,
        );

      for (let index = 0; index < insertedTrades.length; index += 1) {
        const trade = insertedTrades[index];
        const plannedTrade = plannedTrades[index];
        const moveSet = collateralMoves[index];

        if (!trade || !plannedTrade || !moveSet) {
          throw new AppError(
            500,
            'trade_persistence_failed',
            `failed to persist matched trade at index ${String(index)}`,
          );
        }

        await this.matchSettlementLedgerService.recordCollateralReclassification(
          tx,
          {
            tradeId: trade.id,
            marketId: plannedTrade.marketId,
            executedAt: plannedTrade.executedAt,
            moves: moveSet.filter(
              (move) =>
                move.positionCollateralMinor > 0 || move.cashReleaseMinor > 0,
            ),
          },
        );
      }

      const touchedOrders = nextStates.filter(
        (order) =>
          order.nextFilledQuantity !== order.filledQuantity ||
          order.nextReservedAmountMinor !== order.reservedAmountMinor,
      );

      const updatedOrders = [];

      for (const order of touchedOrders) {
        const remainingQuantity = order.quantity - order.nextFilledQuantity;
        const nextStatus =
          remainingQuantity === 0
            ? 'filled'
            : order.nextFilledQuantity > 0
              ? 'partially_filled'
              : 'queued_for_matching';

        const updatedRows = await tx
          .update(orders)
          .set({
            filledQuantity: order.nextFilledQuantity,
            reservedAmountMinor: order.nextReservedAmountMinor,
            status: nextStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id))
          .returning();
        const updatedOrder = updatedRows[0];

        if (!updatedOrder) {
          throw new AppError(
            500,
            'order_match_update_failed',
            `failed to update matched order ${order.id}`,
          );
        }

        updatedOrders.push(updatedOrder);
      }

      const commandEvents = [];

      for (let index = 0; index < insertedTrades.length; index += 1) {
        const trade = insertedTrades[index];
        const plannedTrade = plannedTrades[index];

        if (!trade || !plannedTrade) {
          throw new AppError(
            500,
            'trade_persistence_failed',
            `failed to persist matched trade command at index ${String(index)}`,
          );
        }

        const command =
          await this.marketMatchCommandService.recordMarketCommand(tx, {
            marketId: market.id,
            orderId: plannedTrade.takerOrderId,
            metadata: {
              tradeId: trade.id,
              makerOrderId: plannedTrade.makerOrderId,
              takerOrderId: plannedTrade.takerOrderId,
              outcome: plannedTrade.outcome,
              priceBps: plannedTrade.priceBps,
              quantity: plannedTrade.quantity,
              makerRemainingQuantity: plannedTrade.makerRemainingQuantity,
              takerRemainingQuantity: plannedTrade.takerRemainingQuantity,
              bookEffect: 'trade',
            },
          });

        commandEvents.push(command);
      }

      return {
        marketId,
        summary: {
          matchedTradeCount: insertedTrades.length,
          touchedOrderCount: touchedOrders.length,
          latestSequence:
            commandEvents.at(-1)?.sequence ?? market.lastCommandSequence,
        },
        trades: insertedTrades,
        orders: updatedOrders,
      };
    });
  }
}
