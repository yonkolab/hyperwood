import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  ledgerEntries,
  ledgerTransactions,
  marketCommandEvents,
  marketTrades,
  markets,
  orders,
  orderOutcomeEnum,
  orderSideEnum,
  walletAccounts,
  walletAccountTypeEnum,
} from "../../db/schema";
import { AppError } from "../../lib/errors";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type OrderOutcome = (typeof orderOutcomeEnum.enumValues)[number];
type OrderSide = (typeof orderSideEnum.enumValues)[number];
type WalletAccountType = (typeof walletAccountTypeEnum.enumValues)[number];

type MatchableOrder = {
  id: string;
  userId: string;
  marketId: string;
  outcome: OrderOutcome;
  side: OrderSide;
  quantity: number;
  filledQuantity: number;
  limitPriceBps: number;
  referencePriceBps: number;
  reservedAmountMinor: number;
  currency: string;
  status: "queued_for_matching" | "partially_filled";
  createSequence: number;
};

type OrderState = MatchableOrder & {
  nextFilledQuantity: number;
  nextReservedAmountMinor: number;
};

type PendingTrade = {
  makerOrderId: string;
  takerOrderId: string;
  marketId: string;
  outcome: OrderOutcome;
  priceBps: number;
  quantity: number;
  makerRemainingQuantity: number;
  takerRemainingQuantity: number;
  executedAt: Date;
};

type TradeCollateralMove = {
  orderId: string;
  userId: string;
  currency: string;
  reserveConsumedMinor: number;
  positionCollateralMinor: number;
  cashReleaseMinor: number;
};

export class MatchingService {
  async runLimitOrderMatching(marketId: string) {
    return db.transaction(async (tx) => {
      const market = await this.assertMarketMatchable(tx, marketId);

      await this.acquireMarketWriteLock(tx, market.id);

      const activeOrders = await this.loadMatchableOrders(tx, market.id);
      const plannedTrades = this.planTrades(activeOrders);

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

      const { nextStates, collateralMoves } = this.applyTradesToStates(
        activeOrders,
        plannedTrades,
      );

      for (let index = 0; index < insertedTrades.length; index += 1) {
        const trade = insertedTrades[index];
        const plannedTrade = plannedTrades[index];
        const moveSet = collateralMoves[index];

        if (!trade || !plannedTrade || !moveSet) {
          throw new AppError(500, "trade_persistence_failed", "failed to persist matched trade");
        }

        await this.recordCollateralReclassification(tx, {
          tradeId: trade.id,
          marketId: plannedTrade.marketId,
          executedAt: plannedTrade.executedAt,
          moves: moveSet.filter(
            (move) => move.positionCollateralMinor > 0 || move.cashReleaseMinor > 0,
          ),
        });
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
            ? "filled"
            : order.nextFilledQuantity > 0
              ? "partially_filled"
              : "queued_for_matching";

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
          throw new AppError(500, "order_match_update_failed", "failed to update matched order");
        }

        updatedOrders.push(updatedOrder);
      }

      const commandEvents = [];

      for (let index = 0; index < insertedTrades.length; index += 1) {
        const trade = insertedTrades[index];
        const plannedTrade = plannedTrades[index];

        if (!trade || !plannedTrade) {
          throw new AppError(500, "trade_persistence_failed", "failed to persist matched trade");
        }

        const command = await this.recordMarketCommand(tx, {
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
            bookEffect: "trade",
          },
        });

        commandEvents.push(command);
      }

      return {
        marketId,
        summary: {
          matchedTradeCount: insertedTrades.length,
          touchedOrderCount: touchedOrders.length,
          latestSequence: commandEvents.at(-1)?.sequence ?? market.lastCommandSequence,
        },
        trades: insertedTrades,
        orders: updatedOrders,
      };
    });
  }

  async listRecentTrades(marketId: string, limit: number) {
    await this.assertMarketExists(marketId);

    const rows = await db
      .select()
      .from(marketTrades)
      .where(eq(marketTrades.marketId, marketId))
      .orderBy(desc(marketTrades.executedAt), desc(marketTrades.id))
      .limit(Math.min(limit, 100));

    return {
      marketId,
      trades: rows,
    };
  }

  private async assertMarketExists(marketId: string) {
    const [market] = await db
      .select({
        id: markets.id,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      throw new AppError(404, "market_not_found", "market was not found");
    }

    return market;
  }

  private async assertMarketMatchable(executor: DbExecutor, marketId: string) {
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
      throw new AppError(404, "market_not_found", "market was not found");
    }

    if (market.status !== "active") {
      throw new AppError(409, "market_not_matchable", "market is not active for matching");
    }

    return market;
  }

  private async loadMatchableOrders(executor: DbExecutor, marketId: string) {
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
          inArray(orders.status, ["queued_for_matching", "partially_filled"]),
          eq(orders.type, "limit"),
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
          eq(marketCommandEvents.commandType, "order_create"),
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

      if (typeof createSequence !== "number") {
        throw new AppError(
          500,
          "order_priority_missing",
          "missing authoritative create sequence for active order",
        );
      }

      if (typeof order.limitPriceBps !== "number") {
        throw new AppError(500, "invalid_order_state", "limit order is missing limit price");
      }

      if (order.status !== "queued_for_matching" && order.status !== "partially_filled") {
        throw new AppError(500, "invalid_order_state", "order is not matchable");
      }

      return {
        ...order,
        limitPriceBps: order.limitPriceBps,
        status: order.status,
        createSequence,
      };
    });
  }

  private planTrades(ordersToMatch: MatchableOrder[]) {
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

      let incomingRemaining = incomingState.quantity - incomingState.nextFilledQuantity;

      if (incomingRemaining <= 0) {
        continue;
      }

      const oppositeBook =
        restingBooks[incoming.outcome][incoming.side === "buy" ? "sell" : "buy"];

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

        const makerRemaining = makerState.quantity - makerState.nextFilledQuantity;

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

        const makerRemainingAfter = makerState.quantity - makerState.nextFilledQuantity;
        const takerRemainingAfter = incomingState.quantity - incomingState.nextFilledQuantity;

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

  private applyTradesToStates(
    ordersToMatch: MatchableOrder[],
    trades: PendingTrade[],
  ) {
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
        throw new AppError(500, "trade_state_failed", "matched trade references missing order");
      }

      maker.nextFilledQuantity += trade.quantity;
      taker.nextFilledQuantity += trade.quantity;

      const makerMove = this.consumeOrderReserve(maker, trade.quantity, trade.priceBps);
      const takerMove = this.consumeOrderReserve(taker, trade.quantity, trade.priceBps);

      collateralMoves.push([makerMove, takerMove]);
    }

    return {
      nextStates: Array.from(stateByOrderId.values()),
      collateralMoves,
    };
  }

  private isCrossed(
    incoming: Pick<MatchableOrder, "side" | "limitPriceBps">,
    maker: Pick<MatchableOrder, "side" | "limitPriceBps">,
  ) {
    if (incoming.side === maker.side) {
      return false;
    }

    return incoming.side === "buy"
      ? incoming.limitPriceBps >= maker.limitPriceBps
      : incoming.limitPriceBps <= maker.limitPriceBps;
  }

  private insertRestingOrder(book: MatchableOrder[], order: MatchableOrder) {
    book.push(order);
    book.sort((left, right) => {
      if (left.side === "buy" && right.side === "buy") {
        return right.limitPriceBps - left.limitPriceBps || left.createSequence - right.createSequence;
      }

      if (left.side === "sell" && right.side === "sell") {
        return left.limitPriceBps - right.limitPriceBps || left.createSequence - right.createSequence;
      }

      return left.createSequence - right.createSequence;
    });
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
      throw new AppError(500, "market_sequence_failed", "failed to advance market sequence");
    }

    const commandRows = await executor
      .insert(marketCommandEvents)
      .values({
        marketId: input.marketId,
        orderId: input.orderId,
        sequence: updatedMarket.lastCommandSequence,
        commandType: "match_execution",
        metadata: input.metadata,
      })
      .returning();

    const command = commandRows[0];

    if (!command) {
      throw new AppError(500, "market_command_failed", "failed to record market command");
    }

    return command;
  }

  private consumeOrderReserve(
    order: OrderState,
    tradeQuantity: number,
    executionPriceBps: number,
  ): TradeCollateralMove {
    const currentRemainingQuantity = order.quantity - order.nextFilledQuantity + tradeQuantity;
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
    const theoreticalPositionCollateralMinor = this.calculateReserveAmountMinor({
      side: order.side,
      quantity: tradeQuantity,
      priceBps: order.side === "buy" ? executionPriceBps : 10000 - executionPriceBps,
      useDirectExposureBps: true,
    });
    const positionCollateralMinor = Math.min(
      reserveConsumedMinor,
      theoreticalPositionCollateralMinor,
    );
    const cashReleaseMinor = reserveConsumedMinor - positionCollateralMinor;

    if (currentRemainingQuantity <= 0) {
      throw new AppError(500, "invalid_match_state", "order has no remaining quantity to match");
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
      : input.side === "buy"
        ? input.priceBps
        : 10000 - input.priceBps;

    return Math.ceil((input.quantity * exposureBps) / 100);
  }

  private async recordCollateralReclassification(
    executor: DbExecutor,
    input: {
      tradeId: string;
      marketId: string;
      executedAt: Date;
      moves: TradeCollateralMove[];
    },
  ) {
    if (input.moves.length === 0) {
      return;
    }

    const transactionRows = await executor
      .insert(ledgerTransactions)
      .values({
        referenceType: "trade_collateral_reclassify",
        referenceId: input.tradeId,
        metadata: {
          marketId: input.marketId,
          executedAt: input.executedAt.toISOString(),
        },
      })
      .returning({
        id: ledgerTransactions.id,
      });

    const transaction = transactionRows[0];

    if (!transaction) {
      throw new AppError(500, "ledger_transaction_failed", "failed to create ledger transaction");
    }

    const entries = [];

    for (const move of input.moves) {
      const reservedWallet = await this.getOrCreateWalletAccount(executor, {
        ownerUserId: move.userId,
        type: "user_order_reserved",
        currency: move.currency,
      });
      const positionWallet = await this.getOrCreateWalletAccount(executor, {
        ownerUserId: move.userId,
        type: "user_position_collateral",
        currency: move.currency,
      });

      entries.push({
        transactionId: transaction.id,
        walletAccountId: reservedWallet.id,
        side: "debit" as const,
        amountMinor: move.reserveConsumedMinor,
        currency: move.currency,
      });

      if (move.positionCollateralMinor > 0) {
        entries.push({
          transactionId: transaction.id,
          walletAccountId: positionWallet.id,
          side: "credit" as const,
          amountMinor: move.positionCollateralMinor,
          currency: move.currency,
        });
      }

      if (move.cashReleaseMinor > 0) {
        const cashWallet = await this.getOrCreateWalletAccount(executor, {
          ownerUserId: move.userId,
          type: "user_cash",
          currency: move.currency,
        });

        entries.push({
          transactionId: transaction.id,
          walletAccountId: cashWallet.id,
          side: "credit" as const,
          amountMinor: move.cashReleaseMinor,
          currency: move.currency,
        });
      }
    }

    await executor.insert(ledgerEntries).values(entries);
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
      })
      .from(walletAccounts)
      .where(whereClause)
      .limit(1);

    const existing = existingRows[0];

    if (existing) {
      return existing;
    }

    const insertedRows = await executor
      .insert(walletAccounts)
      .values({
        ownerUserId: input.ownerUserId,
        type: input.type,
        currency: input.currency,
      })
      .returning({
        id: walletAccounts.id,
      });

    const inserted = insertedRows[0];

    if (!inserted) {
      throw new AppError(500, "wallet_account_creation_failed", "failed to create wallet account");
    }

    return inserted;
  }
}
