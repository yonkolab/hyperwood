import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  ledgerEntries,
  ledgerTransactions,
  marketCommandEvents,
  marketCommandTypeEnum,
  markets,
  orders,
  walletAccounts,
  marketStatusEnum,
  orderOutcomeEnum,
  orderSideEnum,
  orderTypeEnum,
  selfTradePreventionEnum,
  walletAccountTypeEnum,
} from "../../db/schema";
import { sha256Hex } from "../../lib/crypto";
import { AppError } from "../../lib/errors";
import { ComplianceService } from "../compliance/service";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type OrderType = (typeof orderTypeEnum.enumValues)[number];
type OrderSide = (typeof orderSideEnum.enumValues)[number];
type OrderOutcome = (typeof orderOutcomeEnum.enumValues)[number];
type WalletAccountType = (typeof walletAccountTypeEnum.enumValues)[number];
type SelfTradePrevention = (typeof selfTradePreventionEnum.enumValues)[number];
type MarketStatus = (typeof marketStatusEnum.enumValues)[number];
type MarketCommandType = (typeof marketCommandTypeEnum.enumValues)[number];

type CreateOrderInput = {
  userId: string;
  marketId: string;
  idempotencyKey: string;
  type: OrderType;
  side: OrderSide;
  outcome: OrderOutcome;
  quantity: number;
  limitPriceBps?: number;
  selfTradePrevention: SelfTradePrevention;
};

const ORDER_CURRENCY = "USD";
const MAX_ORDER_QUANTITY = 100_000;
const MAX_ORDER_RESERVE_MINOR = 10_000_000;

export class OrdersService {
  private readonly complianceService = new ComplianceService();

  async createOrder(input: CreateOrderInput) {
    const capabilityEvaluation = await this.complianceService.getCapabilityEvaluation(input.userId);

    if (!capabilityEvaluation.capabilities.trading.allowed) {
      throw new AppError(
        403,
        "trading_not_allowed",
        `trading not allowed: ${capabilityEvaluation.capabilities.trading.reasons.join(", ")}`,
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
          yesPriceBps: markets.yesPriceBps,
          noPriceBps: markets.noPriceBps,
        })
        .from(markets)
        .where(eq(markets.id, input.marketId))
        .limit(1);

      const market = marketRows[0];

      if (!market) {
        throw new AppError(404, "market_not_found", "market was not found");
      }

      await this.acquireMarketWriteLock(tx, market.id);
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
            "idempotency_key_conflict",
            "idempotency key was already used with a different payload",
          );
        }

        const existingCommand = await this.findExistingMarketCommand(
          tx,
          existingOrder.id,
          "order_create",
        );

        return {
          order: existingOrder,
          idempotentReplay: true,
          ...(existingCommand ? { marketCommand: existingCommand } : {}),
        };
      }

      this.assertOrderQuantity(input.quantity);
      this.assertMarketTradable(market.status);

      const referencePriceBps =
        input.type === "market"
          ? this.getMarketPriceBps(market, input.outcome)
          : this.assertLimitPrice(input.limitPriceBps);

      const reservedAmountMinor = this.calculateReservedAmountMinor({
        side: input.side,
        quantity: input.quantity,
        referencePriceBps,
      });

      if (reservedAmountMinor > MAX_ORDER_RESERVE_MINOR) {
        throw new AppError(
          400,
          "order_exposure_limit_exceeded",
          "order exceeds the maximum supported exposure",
        );
      }

      const availableWallet = await this.getOrCreateWalletAccount(tx, {
        ownerUserId: input.userId,
        type: "user_cash",
        currency: ORDER_CURRENCY,
      });
      const reservedWallet = await this.getOrCreateWalletAccount(tx, {
        ownerUserId: input.userId,
        type: "user_order_reserved",
        currency: ORDER_CURRENCY,
      });

      const availableBalanceMinor = await this.getWalletAccountBalance(tx, availableWallet.id);

      if (availableBalanceMinor < reservedAmountMinor) {
        throw new AppError(
          409,
          "insufficient_available_balance",
          "insufficient available balance for order collateral",
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
          status: "queued_for_matching",
          quantity: input.quantity,
          limitPriceBps: input.limitPriceBps,
          referencePriceBps,
          reservedAmountMinor,
          currency: ORDER_CURRENCY,
          selfTradePrevention: input.selfTradePrevention,
          updatedAt: new Date(),
        })
        .returning();

      const order = insertedRows[0];

      if (!order) {
        throw new AppError(500, "order_creation_failed", "failed to create order");
      }

      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: "order_reservation",
          referenceId: order.id,
          metadata: {
            marketId: order.marketId,
            orderType: order.type,
            side: order.side,
            outcome: order.outcome,
          },
        })
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          "ledger_transaction_failed",
          "failed to create ledger transaction",
        );
      }

      await tx.insert(ledgerEntries).values([
        {
          transactionId: transaction.id,
          walletAccountId: availableWallet.id,
          side: "debit",
          amountMinor: reservedAmountMinor,
          currency: ORDER_CURRENCY,
        },
        {
          transactionId: transaction.id,
          walletAccountId: reservedWallet.id,
          side: "credit",
          amountMinor: reservedAmountMinor,
          currency: ORDER_CURRENCY,
        },
      ]);

      const command = await this.recordMarketCommand(tx, {
        marketId: market.id,
        orderId: order.id,
        commandType: "order_create",
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
      });

      return {
        order,
        idempotentReplay: false,
        marketCommand: command,
      };
    });
  }

  async cancelOrder(input: { userId: string; orderId: string }) {
    return db.transaction(async (tx) => {
      const orderRows = await tx
        .select({
          id: orders.id,
          userId: orders.userId,
          marketId: orders.marketId,
        })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)))
        .limit(1);

      const orderReference = orderRows[0];

      if (!orderReference) {
        throw new AppError(404, "order_not_found", "order was not found");
      }

      await this.acquireMarketWriteLock(tx, orderReference.marketId);

      const currentOrderRows = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)))
        .limit(1);

      const order = currentOrderRows[0];

      if (!order) {
        throw new AppError(404, "order_not_found", "order was not found");
      }

      if (order.status === "cancelled") {
        const existingCommand = await this.findExistingMarketCommand(
          tx,
          order.id,
          "order_cancel",
        );

        return {
          order,
          alreadyCancelled: true,
          ...(existingCommand ? { marketCommand: existingCommand } : {}),
        };
      }

      if (
        order.status !== "queued_for_matching" &&
        order.status !== "partially_filled"
      ) {
        throw new AppError(
          409,
          "order_not_cancellable",
          "order is not eligible for cancellation",
        );
      }

      const releaseAmountMinor = order.reservedAmountMinor;

      const availableWallet = await this.getOrCreateWalletAccount(tx, {
        ownerUserId: input.userId,
        type: "user_cash",
        currency: order.currency,
      });
      const reservedWallet = await this.getOrCreateWalletAccount(tx, {
        ownerUserId: input.userId,
        type: "user_order_reserved",
        currency: order.currency,
      });

      const updatedRows = await tx
        .update(orders)
        .set({
          status: "cancelled",
          reservedAmountMinor: 0,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();

      const cancelledOrder = updatedRows[0];

      if (!cancelledOrder) {
        throw new AppError(500, "order_cancellation_failed", "failed to cancel order");
      }

      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: "order_release",
          referenceId: cancelledOrder.id,
          metadata: {
            marketId: cancelledOrder.marketId,
            reason: "user_cancelled_order",
          },
        })
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          "ledger_transaction_failed",
          "failed to create ledger transaction",
        );
      }

      await tx.insert(ledgerEntries).values([
        {
          transactionId: transaction.id,
          walletAccountId: reservedWallet.id,
          side: "debit",
          amountMinor: releaseAmountMinor,
          currency: cancelledOrder.currency,
        },
        {
          transactionId: transaction.id,
          walletAccountId: availableWallet.id,
          side: "credit",
          amountMinor: releaseAmountMinor,
          currency: cancelledOrder.currency,
        },
      ]);

      const command = await this.recordMarketCommand(tx, {
        marketId: cancelledOrder.marketId,
        orderId: cancelledOrder.id,
        commandType: "order_cancel",
        metadata: {
          orderType: cancelledOrder.type,
          side: cancelledOrder.side,
          outcome: cancelledOrder.outcome,
          quantity: cancelledOrder.quantity,
          limitPriceBps: cancelledOrder.limitPriceBps,
          referencePriceBps: cancelledOrder.referencePriceBps,
          reservedAmountMinor: releaseAmountMinor,
          currency: cancelledOrder.currency,
          reason: "user_cancelled_order",
        },
      });

      return {
        order: cancelledOrder,
        alreadyCancelled: false,
        marketCommand: command,
      };
    });
  }

  private assertOrderQuantity(quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(400, "invalid_quantity", "quantity must be a positive integer");
    }

    if (quantity > MAX_ORDER_QUANTITY) {
      throw new AppError(
        400,
        "order_quantity_limit_exceeded",
        "quantity exceeds the maximum supported order size",
      );
    }
  }

  private assertMarketTradable(status: MarketStatus) {
    if (status !== "active") {
      throw new AppError(409, "market_not_tradable", "market is not active for trading");
    }
  }

  private assertLimitPrice(limitPriceBps: number | undefined) {
    if (!Number.isInteger(limitPriceBps) || !limitPriceBps) {
      throw new AppError(400, "invalid_limit_price", "limit price is required for limit orders");
    }

    if (limitPriceBps <= 0 || limitPriceBps >= 10000) {
      throw new AppError(400, "invalid_limit_price", "limit price must be between 1 and 9999");
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
    const priceBps = outcome === "yes" ? market.yesPriceBps : market.noPriceBps;

    if (priceBps <= 0 || priceBps >= 10000) {
      throw new AppError(
        409,
        "market_price_unavailable",
        "market order price is unavailable for this market",
      );
    }

    return priceBps;
  }

  private calculateReservedAmountMinor(input: {
    side: OrderSide;
    quantity: number;
    referencePriceBps: number;
  }) {
    const exposureBps =
      input.side === "buy" ? input.referencePriceBps : 10000 - input.referencePriceBps;

    if (exposureBps <= 0 || exposureBps >= 10000) {
      throw new AppError(400, "invalid_exposure", "order exposure is invalid");
    }

    return Math.ceil((input.quantity * exposureBps) / 100);
  }

  private async getWalletAccountBalance(executor: DbExecutor, walletAccountId: string) {
    const balanceRows = await executor
      .select({
        balanceMinor: sql<string>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletAccountId, walletAccountId));

    return Number(balanceRows[0]?.balanceMinor ?? 0);
  }

  private async acquireMarketWriteLock(executor: DbExecutor, marketId: string) {
    await executor.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${marketId}, 0))`,
    );
  }

  private async recordMarketCommand(
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
      throw new AppError(500, "market_sequence_failed", "failed to advance market sequence");
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
      throw new AppError(500, "market_command_failed", "failed to record market command");
    }

    return command;
  }

  private async findExistingMarketCommand(
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

  private async getOrCreateWalletAccount(
    executor: DbExecutor,
    input: {
      ownerUserId: string | null;
      type: WalletAccountType;
      currency: string;
    },
  ) {
    const whereClause =
      input.ownerUserId === null
        ? and(
            eq(walletAccounts.type, input.type),
            eq(walletAccounts.currency, input.currency),
            sql`${walletAccounts.ownerUserId} is null`,
          )
        : and(
            eq(walletAccounts.ownerUserId, input.ownerUserId),
            eq(walletAccounts.type, input.type),
            eq(walletAccounts.currency, input.currency),
          );

    const existingRows = await executor
      .select({
        id: walletAccounts.id,
        ownerUserId: walletAccounts.ownerUserId,
        type: walletAccounts.type,
        currency: walletAccounts.currency,
      })
      .from(walletAccounts)
      .where(whereClause)
      .limit(1);

    const existing = existingRows[0];

    if (existing) {
      return existing;
    }

    try {
      const insertedRows = await executor
        .insert(walletAccounts)
        .values({
          ownerUserId: input.ownerUserId,
          type: input.type,
          currency: input.currency,
        })
        .returning({
          id: walletAccounts.id,
          ownerUserId: walletAccounts.ownerUserId,
          type: walletAccounts.type,
          currency: walletAccounts.currency,
        });

      const inserted = insertedRows[0];

      if (!inserted) {
        throw new AppError(500, "wallet_account_creation_failed", "failed to create wallet account");
      }

      return inserted;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        const retryRows = await executor
          .select({
            id: walletAccounts.id,
            ownerUserId: walletAccounts.ownerUserId,
            type: walletAccounts.type,
            currency: walletAccounts.currency,
          })
          .from(walletAccounts)
          .where(whereClause)
          .limit(1);

        const retry = retryRows[0];

        if (retry) {
          return retry;
        }
      }

      throw error;
    }
  }
}
