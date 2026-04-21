import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { markets, orders } from '../../db/schema';
import { sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import type { ComplianceService } from '../compliance/service';
import type { ExchangeService } from '../exchange/service';
import type { OrderCommandEventService } from './order-command-event.service';
import type { OrderLedgerReservationService } from './order-ledger-reservation.service';
import type {
  CreateOrderInput,
  MarketCurrency,
  MarketStatus,
  OrderOutcome,
} from './types';

const MAX_ORDER_QUANTITY = 100_000;

export class OrderEntryService {
  constructor(
    private readonly complianceService: ComplianceService,
    private readonly exchangeService: ExchangeService,
    private readonly orderLedgerReservationService: OrderLedgerReservationService,
    private readonly orderCommandEventService: OrderCommandEventService,
  ) {}

  /**
   * Create one order, reserve its collateral, and emit the create command.
   *
   * Example:
   * `await orderEntryService.createOrder(input)`
   */
  async createOrder(input: CreateOrderInput) {
    const capabilityEvaluation =
      await this.complianceService.getCapabilityEvaluation(input.userId);

    if (!capabilityEvaluation.capabilities.trading.allowed) {
      throw new AppError(
        403,
        'trading_not_allowed',
        `trading not allowed: ${capabilityEvaluation.capabilities.trading.reasons.join(', ')}`,
      );
    }

    const requestHash = sha256Hex(
      JSON.stringify({
        marketId: input.marketId,
        type: input.type,
        side: input.side,
        outcome: input.outcome,
        quantity: input.quantity,
        limitPriceBps: input.limitPriceBps ?? null,
        selfTradePrevention: input.selfTradePrevention,
      }),
    );

    return db.transaction(async (tx) => {
      const marketRows = await tx
        .select({
          id: markets.id,
          status: markets.status,
          currency: markets.currency,
          yesPriceBps: markets.yesPriceBps,
          noPriceBps: markets.noPriceBps,
        })
        .from(markets)
        .where(eq(markets.id, input.marketId))
        .limit(1);
      const market = marketRows[0];

      if (!market) {
        throw new AppError(
          404,
          'market_not_found',
          `market was not found for id ${input.marketId}`,
        );
      }

      await this.orderCommandEventService.acquireMarketWriteLock(tx, market.id);

      const existingRows = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.userId, input.userId),
            eq(orders.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      const existingOrder = existingRows[0];

      if (existingOrder) {
        if (existingOrder.requestHash !== requestHash) {
          throw new AppError(
            409,
            'idempotency_key_conflict',
            `idempotency key ${input.idempotencyKey} was already used with a different payload`,
          );
        }

        const existingCommand =
          await this.orderCommandEventService.findExistingMarketCommand(
            tx,
            existingOrder.id,
            'order_create',
          );

        return {
          order: existingOrder,
          idempotentReplay: true,
          ...(existingCommand ? { marketCommand: existingCommand } : {}),
        };
      }

      this.assertOrderQuantity(input.quantity);
      await this.exchangeService.assertTradingOpen(tx);
      this.assertMarketTradable(market.status);

      const referencePriceBps =
        input.type === 'market'
          ? this.getMarketPriceBps(market, input.outcome)
          : this.assertLimitPrice(input.limitPriceBps);
      const reservedAmountMinor =
        this.orderLedgerReservationService.calculateReservedAmountMinor({
          side: input.side,
          quantity: input.quantity,
          referencePriceBps,
        });

      this.orderLedgerReservationService.assertReserveWithinLimit(
        reservedAmountMinor,
      );

      const orderCurrency: MarketCurrency = market.currency;
      const availableWallet =
        await this.orderLedgerReservationService.getOrCreateWalletAccount(tx, {
          ownerUserId: input.userId,
          type: 'user_cash',
          currency: orderCurrency,
        });
      const reservedWallet =
        await this.orderLedgerReservationService.getOrCreateWalletAccount(tx, {
          ownerUserId: input.userId,
          type: 'user_order_reserved',
          currency: orderCurrency,
        });
      const availableBalanceMinor =
        await this.orderLedgerReservationService.getWalletAccountBalance(
          tx,
          availableWallet.id,
        );

      if (availableBalanceMinor < reservedAmountMinor) {
        throw new AppError(
          409,
          'insufficient_available_balance',
          `insufficient available balance ${String(availableBalanceMinor)} for required collateral ${String(reservedAmountMinor)}`,
        );
      }

      const insertedRows = await tx
        .insert(orders)
        .values({
          userId: input.userId,
          marketId: input.marketId,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          type: input.type,
          side: input.side,
          outcome: input.outcome,
          status: 'queued_for_matching',
          quantity: input.quantity,
          limitPriceBps: input.limitPriceBps,
          referencePriceBps,
          reservedAmountMinor,
          currency: orderCurrency,
          selfTradePrevention: input.selfTradePrevention,
          updatedAt: new Date(),
        })
        .returning();
      const order = insertedRows[0];

      if (!order) {
        throw new AppError(
          500,
          'order_creation_failed',
          `failed to create order for market ${input.marketId}`,
        );
      }

      await this.orderLedgerReservationService.recordReservationTransfer(tx, {
        referenceType: 'order_reservation',
        referenceId: order.id,
        metadata: {
          marketId: order.marketId,
          orderType: order.type,
          side: order.side,
          outcome: order.outcome,
        },
        fromWalletAccountId: availableWallet.id,
        toWalletAccountId: reservedWallet.id,
        amountMinor: reservedAmountMinor,
        currency: orderCurrency,
      });

      const command = await this.orderCommandEventService.recordMarketCommand(
        tx,
        {
          marketId: market.id,
          orderId: order.id,
          commandType: 'order_create',
          metadata: {
            orderType: order.type,
            side: order.side,
            outcome: order.outcome,
            quantity: order.quantity,
            limitPriceBps: order.limitPriceBps,
            referencePriceBps: order.referencePriceBps,
            reservedAmountMinor: order.reservedAmountMinor,
            currency: order.currency,
          },
        },
      );

      return {
        order,
        idempotentReplay: false,
        marketCommand: command,
      };
    });
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

  private assertMarketTradable(status: MarketStatus) {
    if (status !== 'active') {
      throw new AppError(
        409,
        'market_not_tradable',
        `market is not active for trading, received status ${status}`,
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

  private getMarketPriceBps(
    market: {
      yesPriceBps: number;
      noPriceBps: number;
    },
    outcome: OrderOutcome,
  ) {
    const priceBps = outcome === 'yes' ? market.yesPriceBps : market.noPriceBps;

    if (priceBps <= 0 || priceBps >= 10000) {
      throw new AppError(
        409,
        'market_price_unavailable',
        `market order price is unavailable for outcome ${outcome} with price ${String(priceBps)}`,
      );
    }

    return priceBps;
  }
}
