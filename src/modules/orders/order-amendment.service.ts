import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { markets, orders } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { ExchangeService } from '../exchange/service';
import type { OrderCommandEventService } from './order-command-event.service';
import type { OrderLedgerReservationService } from './order-ledger-reservation.service';

const MAX_ORDER_QUANTITY = 100_000;

export class OrderAmendmentService {
  constructor(
    private readonly exchangeService: ExchangeService,
    private readonly orderLedgerReservationService: OrderLedgerReservationService,
    private readonly orderCommandEventService: OrderCommandEventService,
  ) {}

  /**
   * Amend one resting limit order without changing the facade API.
   *
   * Example:
   * `await orderAmendmentService.amendOrder({ userId, orderId, quantity: 12 })`
   */
  async amendOrder(input: {
    userId: string;
    orderId: string;
    quantity?: number;
    limitPriceBps?: number;
  }) {
    return db.transaction(async (tx) => {
      const orderRows = await tx
        .select({
          id: orders.id,
          userId: orders.userId,
          marketId: orders.marketId,
        })
        .from(orders)
        .where(
          and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)),
        )
        .limit(1);
      const orderReference = orderRows[0];

      if (!orderReference) {
        throw new AppError(
          404,
          'order_not_found',
          `order was not found for id ${input.orderId}`,
        );
      }

      await this.orderCommandEventService.acquireMarketWriteLock(
        tx,
        orderReference.marketId,
      );

      const currentOrderRows = await tx
        .select()
        .from(orders)
        .where(
          and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)),
        )
        .limit(1);
      const order = currentOrderRows[0];

      if (!order) {
        throw new AppError(
          404,
          'order_not_found',
          `order was not found for id ${input.orderId}`,
        );
      }

      if (order.type !== 'limit') {
        throw new AppError(
          409,
          'order_not_amendable',
          `only resting limit orders can be amended, received type ${order.type}`,
        );
      }

      if (
        order.status !== 'queued_for_matching' &&
        order.status !== 'partially_filled'
      ) {
        throw new AppError(
          409,
          'order_not_amendable',
          `order ${order.id} is not eligible for amendment from status ${order.status}`,
        );
      }

      const marketRows = await tx
        .select({
          id: markets.id,
          status: markets.status,
        })
        .from(markets)
        .where(eq(markets.id, order.marketId))
        .limit(1);
      const market = marketRows[0];

      if (!market) {
        throw new AppError(
          404,
          'market_not_found',
          `market was not found for id ${order.marketId}`,
        );
      }

      await this.exchangeService.assertTradingOpen(tx);
      this.assertMarketTradable(market.status);

      if (input.quantity !== undefined) {
        this.assertAmendedQuantity(order, input.quantity);
      }

      const nextQuantity = input.quantity ?? order.quantity;
      const nextLimitPriceBps =
        input.limitPriceBps !== undefined
          ? this.assertLimitPrice(input.limitPriceBps)
          : order.limitPriceBps;

      if (!nextLimitPriceBps) {
        throw new AppError(
          500,
          'order_not_amendable',
          `resting limit order ${order.id} is missing limit price state`,
        );
      }

      if (
        nextQuantity === order.quantity &&
        nextLimitPriceBps === order.limitPriceBps
      ) {
        return {
          order,
          alreadyApplied: true,
        };
      }

      const nextRemainingQuantity = nextQuantity - order.filledQuantity;
      const nextReservedAmountMinor =
        this.orderLedgerReservationService.calculateReservedAmountMinor({
          side: order.side,
          quantity: nextRemainingQuantity,
          referencePriceBps: nextLimitPriceBps,
        });
      const reserveDeltaMinor =
        nextReservedAmountMinor - order.reservedAmountMinor;
      const availableWallet =
        await this.orderLedgerReservationService.getOrCreateWalletAccount(tx, {
          ownerUserId: input.userId,
          type: 'user_cash',
          currency: order.currency,
        });
      const reservedWallet =
        await this.orderLedgerReservationService.getOrCreateWalletAccount(tx, {
          ownerUserId: input.userId,
          type: 'user_order_reserved',
          currency: order.currency,
        });

      if (reserveDeltaMinor > 0) {
        const availableBalanceMinor =
          await this.orderLedgerReservationService.getWalletAccountBalance(
            tx,
            availableWallet.id,
          );

        if (availableBalanceMinor < reserveDeltaMinor) {
          throw new AppError(
            409,
            'insufficient_available_balance',
            `insufficient available balance ${String(availableBalanceMinor)} for amended collateral delta ${String(reserveDeltaMinor)}`,
          );
        }
      }

      const updatedRows = await tx
        .update(orders)
        .set({
          quantity: nextQuantity,
          limitPriceBps: nextLimitPriceBps,
          referencePriceBps: nextLimitPriceBps,
          reservedAmountMinor: nextReservedAmountMinor,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();
      const amendedOrder = updatedRows[0];

      if (!amendedOrder) {
        throw new AppError(
          500,
          'order_amendment_failed',
          `failed to amend order ${order.id}`,
        );
      }

      if (reserveDeltaMinor > 0) {
        await this.orderLedgerReservationService.recordReservationTransfer(tx, {
          referenceType: 'order_amendment',
          referenceId: amendedOrder.id,
          metadata: {
            marketId: amendedOrder.marketId,
            previousQuantity: order.quantity,
            amendedQuantity: amendedOrder.quantity,
            previousLimitPriceBps: order.limitPriceBps,
            amendedLimitPriceBps: amendedOrder.limitPriceBps,
            reserveDeltaMinor,
          },
          fromWalletAccountId: availableWallet.id,
          toWalletAccountId: reservedWallet.id,
          amountMinor: reserveDeltaMinor,
          currency: amendedOrder.currency,
        });
      }

      if (reserveDeltaMinor < 0) {
        await this.orderLedgerReservationService.recordReservationTransfer(tx, {
          referenceType: 'order_amendment',
          referenceId: amendedOrder.id,
          metadata: {
            marketId: amendedOrder.marketId,
            previousQuantity: order.quantity,
            amendedQuantity: amendedOrder.quantity,
            previousLimitPriceBps: order.limitPriceBps,
            amendedLimitPriceBps: amendedOrder.limitPriceBps,
            reserveDeltaMinor,
          },
          fromWalletAccountId: reservedWallet.id,
          toWalletAccountId: availableWallet.id,
          amountMinor: Math.abs(reserveDeltaMinor),
          currency: amendedOrder.currency,
        });
      }

      const command = await this.orderCommandEventService.recordMarketCommand(
        tx,
        {
          marketId: amendedOrder.marketId,
          orderId: amendedOrder.id,
          commandType: 'order_amend',
          metadata: {
            previousQuantity: order.quantity,
            amendedQuantity: amendedOrder.quantity,
            filledQuantity: amendedOrder.filledQuantity,
            previousLimitPriceBps: order.limitPriceBps,
            amendedLimitPriceBps: amendedOrder.limitPriceBps,
            previousReservedAmountMinor: order.reservedAmountMinor,
            amendedReservedAmountMinor: amendedOrder.reservedAmountMinor,
            reserveDeltaMinor,
            currency: amendedOrder.currency,
          },
        },
      );

      return {
        order: amendedOrder,
        alreadyApplied: false,
        marketCommand: command,
      };
    });
  }

  private assertMarketTradable(status: string) {
    if (status !== 'active') {
      throw new AppError(
        409,
        'market_not_tradable',
        `market is not active for trading, received status ${status}`,
      );
    }
  }

  private assertAmendedQuantity(
    order: typeof orders.$inferSelect,
    amendedQuantity: number,
  ) {
    this.assertOrderQuantity(amendedQuantity);

    if (amendedQuantity > order.quantity) {
      throw new AppError(
        409,
        'order_quantity_increase_not_supported',
        `order quantity increases are not supported, received ${String(amendedQuantity)} for current quantity ${String(order.quantity)}`,
      );
    }

    if (amendedQuantity <= order.filledQuantity) {
      throw new AppError(
        409,
        'order_quantity_below_filled',
        `amended quantity ${String(amendedQuantity)} must remain above already filled quantity ${String(order.filledQuantity)}`,
      );
    }
  }

  private assertOrderQuantity(quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(
        400,
        'invalid_quantity',
        `quantity must be a positive integer, received ${String(quantity)}`,
      );
    }

    if (quantity > MAX_ORDER_QUANTITY) {
      throw new AppError(
        400,
        'order_quantity_limit_exceeded',
        `quantity ${String(quantity)} exceeds the maximum supported order size ${String(MAX_ORDER_QUANTITY)}`,
      );
    }
  }

  private assertLimitPrice(limitPriceBps: number | undefined) {
    if (!Number.isInteger(limitPriceBps) || !limitPriceBps) {
      throw new AppError(
        400,
        'invalid_limit_price',
        `limit price is required for limit orders, received ${String(limitPriceBps)}`,
      );
    }

    if (limitPriceBps <= 0 || limitPriceBps >= 10000) {
      throw new AppError(
        400,
        'invalid_limit_price',
        `limit price must be between 1 and 9999, received ${String(limitPriceBps)}`,
      );
    }

    return limitPriceBps;
  }
}
