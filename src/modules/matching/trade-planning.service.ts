import { AppError } from '../../lib/errors';
import type {
  MatchableOrder,
  OrderSide,
  OrderState,
  PendingTrade,
  TradeCollateralMove,
} from './types';

export class TradePlanningService {
  /**
   * Produce price-time-priority trades from currently active orders.
   *
   * Example:
   * `tradePlanningService.planTrades(activeOrders)`
   */
  planTrades(ordersToMatch: MatchableOrder[]) {
    const ordered = [...ordersToMatch].sort(
      (left, right) => left.createSequence - right.createSequence,
    );
    const stateByOrderId = new Map<string, OrderState>(
      ordered.map((order) => [
        order.id,
        {
          ...order,
          nextFilledQuantity: order.filledQuantity,
          nextReservedAmountMinor: order.reservedAmountMinor,
        },
      ]),
    );
    const restingBooks = {
      yes: {
        buy: [] as MatchableOrder[],
        sell: [] as MatchableOrder[],
      },
      no: {
        buy: [] as MatchableOrder[],
        sell: [] as MatchableOrder[],
      },
    };
    const trades: PendingTrade[] = [];

    for (const incoming of ordered) {
      const incomingState = stateByOrderId.get(incoming.id);

      if (!incomingState) {
        continue;
      }

      let incomingRemaining =
        incomingState.quantity - incomingState.nextFilledQuantity;

      if (incomingRemaining <= 0) {
        continue;
      }

      const oppositeBook =
        restingBooks[incoming.outcome][
          incoming.side === 'buy' ? 'sell' : 'buy'
        ];

      while (incomingRemaining > 0) {
        const maker = oppositeBook[0];

        if (!maker) {
          break;
        }

        const makerState = stateByOrderId.get(maker.id);

        if (!makerState) {
          oppositeBook.shift();
          continue;
        }

        const makerRemaining =
          makerState.quantity - makerState.nextFilledQuantity;

        if (makerRemaining <= 0) {
          oppositeBook.shift();
          continue;
        }

        if (!this.isCrossed(incomingState, makerState)) {
          break;
        }

        const tradeQuantity = Math.min(incomingRemaining, makerRemaining);

        makerState.nextFilledQuantity += tradeQuantity;
        incomingState.nextFilledQuantity += tradeQuantity;
        incomingRemaining -= tradeQuantity;

        const makerRemainingAfter =
          makerState.quantity - makerState.nextFilledQuantity;
        const takerRemainingAfter =
          incomingState.quantity - incomingState.nextFilledQuantity;

        trades.push({
          marketId: incomingState.marketId,
          makerOrderId: makerState.id,
          takerOrderId: incomingState.id,
          outcome: incomingState.outcome,
          priceBps: makerState.limitPriceBps,
          quantity: tradeQuantity,
          makerRemainingQuantity: makerRemainingAfter,
          takerRemainingQuantity: takerRemainingAfter,
          executedAt: new Date(),
        });

        if (makerRemainingAfter <= 0) {
          oppositeBook.shift();
        }
      }

      if (incomingRemaining > 0) {
        this.insertRestingOrder(
          restingBooks[incoming.outcome][incoming.side],
          incomingState,
        );
      }
    }

    return trades;
  }

  /**
   * Apply planned trades onto in-memory order states and collateral moves.
   *
   * Example:
   * `tradePlanningService.applyTradesToStates(activeOrders, plannedTrades)`
   */
  applyTradesToStates(ordersToMatch: MatchableOrder[], trades: PendingTrade[]) {
    const stateByOrderId = new Map<string, OrderState>(
      ordersToMatch.map((order) => [
        order.id,
        {
          ...order,
          nextFilledQuantity: order.filledQuantity,
          nextReservedAmountMinor: order.reservedAmountMinor,
        },
      ]),
    );
    const collateralMoves: TradeCollateralMove[][] = [];

    for (const trade of trades) {
      const maker = stateByOrderId.get(trade.makerOrderId);
      const taker = stateByOrderId.get(trade.takerOrderId);

      if (!maker || !taker) {
        throw new AppError(
          500,
          'trade_state_failed',
          `matched trade references missing order: maker=${trade.makerOrderId}, taker=${trade.takerOrderId}`,
        );
      }

      maker.nextFilledQuantity += trade.quantity;
      taker.nextFilledQuantity += trade.quantity;

      const makerMove = this.consumeOrderReserve(
        maker,
        trade.quantity,
        trade.priceBps,
      );
      const takerMove = this.consumeOrderReserve(
        taker,
        trade.quantity,
        trade.priceBps,
      );

      collateralMoves.push([makerMove, takerMove]);
    }

    return {
      nextStates: Array.from(stateByOrderId.values()),
      collateralMoves,
    };
  }

  private isCrossed(
    incoming: Pick<MatchableOrder, 'side' | 'limitPriceBps'>,
    maker: Pick<MatchableOrder, 'side' | 'limitPriceBps'>,
  ) {
    if (incoming.side === maker.side) {
      return false;
    }

    return incoming.side === 'buy'
      ? incoming.limitPriceBps >= maker.limitPriceBps
      : incoming.limitPriceBps <= maker.limitPriceBps;
  }

  private insertRestingOrder(book: MatchableOrder[], order: MatchableOrder) {
    book.push(order);
    book.sort((left, right) => {
      if (left.side === 'buy' && right.side === 'buy') {
        return (
          right.limitPriceBps - left.limitPriceBps ||
          left.createSequence - right.createSequence
        );
      }

      if (left.side === 'sell' && right.side === 'sell') {
        return (
          left.limitPriceBps - right.limitPriceBps ||
          left.createSequence - right.createSequence
        );
      }

      return left.createSequence - right.createSequence;
    });
  }

  private consumeOrderReserve(
    order: OrderState,
    tradeQuantity: number,
    executionPriceBps: number,
  ): TradeCollateralMove {
    const currentRemainingQuantity =
      order.quantity - order.nextFilledQuantity + tradeQuantity;
    const remainingQuantityAfter = order.quantity - order.nextFilledQuantity;
    const nextRemainingReserve = this.calculateReserveAmountMinor({
      side: order.side,
      quantity: remainingQuantityAfter,
      priceBps: order.referencePriceBps,
    });
    const reserveConsumedMinor = Math.max(
      0,
      order.nextReservedAmountMinor - nextRemainingReserve,
    );
    const theoreticalPositionCollateralMinor = this.calculateReserveAmountMinor(
      {
        side: order.side,
        quantity: tradeQuantity,
        priceBps:
          order.side === 'buy' ? executionPriceBps : 10000 - executionPriceBps,
        useDirectExposureBps: true,
      },
    );
    const positionCollateralMinor = Math.min(
      reserveConsumedMinor,
      theoreticalPositionCollateralMinor,
    );
    const cashReleaseMinor = reserveConsumedMinor - positionCollateralMinor;

    if (currentRemainingQuantity <= 0) {
      throw new AppError(
        500,
        'invalid_match_state',
        `order ${order.id} has no remaining quantity to match`,
      );
    }

    order.nextReservedAmountMinor = nextRemainingReserve;

    return {
      orderId: order.id,
      userId: order.userId,
      currency: order.currency,
      reserveConsumedMinor,
      positionCollateralMinor,
      cashReleaseMinor,
    };
  }

  private calculateReserveAmountMinor(input: {
    side: OrderSide;
    quantity: number;
    priceBps: number;
    useDirectExposureBps?: boolean;
  }) {
    if (input.quantity <= 0) {
      return 0;
    }

    const exposureBps = input.useDirectExposureBps
      ? input.priceBps
      : input.side === 'buy'
        ? input.priceBps
        : 10000 - input.priceBps;

    return Math.ceil((input.quantity * exposureBps) / 100);
  }
}
