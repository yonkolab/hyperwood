import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { orders } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { OrderCommandEventService } from './order-command-event.service';
import type { OrderLedgerReservationService } from './order-ledger-reservation.service';

export class OrderCancellationService {
  constructor(
    private readonly orderLedgerReservationService: OrderLedgerReservationService,
    private readonly orderCommandEventService: OrderCommandEventService,
  ) {}

  /**
   * Cancel one resting order and release its remaining reserve.
   *
   * Example:
   * `await orderCancellationService.cancelOrder({ userId, orderId })`
   */
  async cancelOrder(input: { userId: string; orderId: string }) {
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

      if (order.status === 'cancelled') {
        const existingCommand =
          await this.orderCommandEventService.findExistingMarketCommand(
            tx,
            order.id,
            'order_cancel',
          );

        return {
          order,
          alreadyCancelled: true,
          ...(existingCommand ? { marketCommand: existingCommand } : {}),
        };
      }

      if (
        order.status !== 'queued_for_matching' &&
        order.status !== 'partially_filled'
      ) {
        throw new AppError(
          409,
          'order_not_cancellable',
          `order ${order.id} is not eligible for cancellation from status ${order.status}`,
        );
      }

      const releaseAmountMinor = order.reservedAmountMinor;
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

      const updatedRows = await tx
        .update(orders)
        .set({
          status: 'cancelled',
          reservedAmountMinor: 0,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();
      const cancelledOrder = updatedRows[0];

      if (!cancelledOrder) {
        throw new AppError(
          500,
          'order_cancellation_failed',
          `failed to cancel order ${order.id}`,
        );
      }

      await this.orderLedgerReservationService.recordReservationTransfer(tx, {
        referenceType: 'order_release',
        referenceId: cancelledOrder.id,
        metadata: {
          marketId: cancelledOrder.marketId,
          reason: 'user_cancelled_order',
        },
        fromWalletAccountId: reservedWallet.id,
        toWalletAccountId: availableWallet.id,
        amountMinor: releaseAmountMinor,
        currency: cancelledOrder.currency,
      });

      const command = await this.orderCommandEventService.recordMarketCommand(
        tx,
        {
          marketId: cancelledOrder.marketId,
          orderId: cancelledOrder.id,
          commandType: 'order_cancel',
          metadata: {
            orderType: cancelledOrder.type,
            side: cancelledOrder.side,
            outcome: cancelledOrder.outcome,
            quantity: cancelledOrder.quantity,
            limitPriceBps: cancelledOrder.limitPriceBps,
            referencePriceBps: cancelledOrder.referencePriceBps,
            reservedAmountMinor: releaseAmountMinor,
            currency: cancelledOrder.currency,
            reason: 'user_cancelled_order',
          },
        },
      );

      return {
        order: cancelledOrder,
        alreadyCancelled: false,
        marketCommand: command,
      };
    });
  }
}
