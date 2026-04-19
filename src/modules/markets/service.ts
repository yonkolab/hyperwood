import { and, asc, desc, eq, gt, inArray, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db/client";
import {
  ledgerEntries,
  ledgerTransactions,
  marketCommandEvents,
  marketCurrencyEnum,
  marketEvents,
  marketResolutionOutcomeEnum,
  marketResolutions,
  marketSettlementPayouts,
  marketSettlements,
  marketTrades,
  markets,
  marketStatusEnum,
  orders,
  orderOutcomeEnum,
  orderSideEnum,
  orderTypeEnum,
  walletAccounts,
  walletAccountTypeEnum,
} from "../../db/schema";
import { AppError } from "../../lib/errors";

type MarketStatus = (typeof marketStatusEnum.enumValues)[number];
type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];
type MarketResolutionOutcome = (typeof marketResolutionOutcomeEnum.enumValues)[number];
type OrderOutcome = (typeof orderOutcomeEnum.enumValues)[number];
type OrderSide = (typeof orderSideEnum.enumValues)[number];
type OrderType = (typeof orderTypeEnum.enumValues)[number];
type WalletAccountType = (typeof walletAccountTypeEnum.enumValues)[number];
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreateMarketEventInput = {
  slug: string;
  title: string;
  summary?: string;
  category: string;
  startsAt?: Date;
  endsAt?: Date;
};

type CreateMarketInput = {
  eventId: string;
  slug: string;
  title: string;
  summary?: string;
  currency: MarketCurrency;
  status: MarketStatus;
  tags?: string[];
  resolutionRules: string;
  resolutionSources?: string[];
  yesPriceBps: number;
  noPriceBps: number;
  volumeUsdMinor?: number;
  opensAt?: Date;
  closesAt?: Date;
  resolvesAt?: Date;
};

type ListMarketsInput = {
  category?: string;
  status?: MarketStatus;
  tag?: string;
  search?: string;
  sort?: "newest" | "closing_soon" | "highest_volume";
  limit: number;
};

type MarketRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: MarketStatus;
  currency: MarketCurrency;
  tags: string[];
  yesPriceBps: number;
  noPriceBps: number;
  volumeUsdMinor: number;
  opensAt: Date | null;
  closesAt: Date | null;
  resolvesAt: Date | null;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  event: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    category: string;
    startsAt: Date | null;
    endsAt: Date | null;
  };
};

type NormalizedPosition = {
  userId: string;
  marketId: string;
  outcome: "yes" | "no";
  quantity: number;
  costBasisMinor: number;
};

export class MarketsService {
  async createEvent(input: CreateMarketEventInput) {
    const insertedRows = await db
      .insert(marketEvents)
      .values({
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        category: input.category,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        updatedAt: new Date(),
      })
      .returning();

    return {
      event: insertedRows[0],
    };
  }

  async createMarket(input: CreateMarketInput) {
    await this.assertEventExists(input.eventId);
    this.assertPriceSnapshot(input.yesPriceBps, input.noPriceBps);

    const insertedRows = await db
      .insert(markets)
      .values({
        eventId: input.eventId,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        status: input.status,
        currency: input.currency,
        tags: input.tags ?? [],
        resolutionRules: input.resolutionRules,
        resolutionSources: input.resolutionSources ?? [],
        yesPriceBps: input.yesPriceBps,
        noPriceBps: input.noPriceBps,
        volumeUsdMinor: input.volumeUsdMinor ?? 0,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        resolvesAt: input.resolvesAt,
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      market: insertedRows[0],
    };
  }

  async listMarkets(input: ListMarketsInput) {
    const rows = await db
      .select({
        id: markets.id,
        slug: markets.slug,
        title: markets.title,
        summary: markets.summary,
        status: markets.status,
        currency: markets.currency,
        tags: markets.tags,
        yesPriceBps: markets.yesPriceBps,
        noPriceBps: markets.noPriceBps,
        volumeUsdMinor: markets.volumeUsdMinor,
        opensAt: markets.opensAt,
        closesAt: markets.closesAt,
        resolvesAt: markets.resolvesAt,
        statusChangedAt: markets.statusChangedAt,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        eventId: marketEvents.id,
        eventSlug: marketEvents.slug,
        eventTitle: marketEvents.title,
        eventSummary: marketEvents.summary,
        eventCategory: marketEvents.category,
        eventStartsAt: marketEvents.startsAt,
        eventEndsAt: marketEvents.endsAt,
      })
      .from(markets)
      .innerJoin(marketEvents, eq(marketEvents.id, markets.eventId))
      .where(
        and(
          input.category ? eq(marketEvents.category, input.category) : undefined,
          input.status ? eq(markets.status, input.status) : undefined,
          input.search
            ? or(
                ilike(markets.title, `%${input.search}%`),
                ilike(markets.summary, `%${input.search}%`),
                ilike(marketEvents.title, `%${input.search}%`),
                ilike(marketEvents.summary, `%${input.search}%`),
              )
            : undefined,
        ),
      )
      .orderBy(...this.getOrderByClause(input.sort))
      .limit(Math.min(input.limit, 100));

    const records = rows
      .map((row) => this.mapMarketRecord(row))
      .filter((market) => (input.tag ? market.tags.includes(input.tag) : true));

    const eventGroups = Array.from(
      records.reduce((groups, market) => {
        const existing = groups.get(market.event.id);

        if (existing) {
          existing.marketIds.push(market.id);
          return groups;
        }

        groups.set(market.event.id, {
          eventId: market.event.id,
          eventSlug: market.event.slug,
          eventTitle: market.event.title,
          category: market.event.category,
          marketIds: [market.id],
        });

        return groups;
      }, new Map<string, { eventId: string; eventSlug: string; eventTitle: string; category: string; marketIds: string[] }>()),
    ).map(([, group]) => group);

    return {
      filters: {
        category: input.category ?? null,
        status: input.status ?? null,
        tag: input.tag ?? null,
        search: input.search ?? null,
        sort: input.sort ?? "newest",
      },
      categories: Array.from(new Set(records.map((market) => market.event.category))),
      eventGroups,
      markets: records,
    };
  }

  async getMarketDetail(marketId: string) {
    const rows = await db
      .select({
        lastCommandSequence: markets.lastCommandSequence,
        id: markets.id,
        slug: markets.slug,
        title: markets.title,
        summary: markets.summary,
        status: markets.status,
        currency: markets.currency,
        tags: markets.tags,
        resolutionRules: markets.resolutionRules,
        resolutionSources: markets.resolutionSources,
        yesPriceBps: markets.yesPriceBps,
        noPriceBps: markets.noPriceBps,
        volumeUsdMinor: markets.volumeUsdMinor,
        opensAt: markets.opensAt,
        closesAt: markets.closesAt,
        resolvesAt: markets.resolvesAt,
        statusChangedAt: markets.statusChangedAt,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        eventId: marketEvents.id,
        eventSlug: marketEvents.slug,
        eventTitle: marketEvents.title,
        eventSummary: marketEvents.summary,
        eventCategory: marketEvents.category,
        eventStartsAt: marketEvents.startsAt,
        eventEndsAt: marketEvents.endsAt,
      })
      .from(markets)
      .innerJoin(marketEvents, eq(marketEvents.id, markets.eventId))
      .where(eq(markets.id, marketId))
      .limit(1);

    const market = rows[0];

    if (!market) {
      throw new AppError(404, "market_not_found", "market was not found");
    }

    const [resolution, settlement] = await Promise.all([
      db
        .select()
        .from(marketResolutions)
        .where(eq(marketResolutions.marketId, marketId))
        .limit(1),
      db
        .select()
        .from(marketSettlements)
        .where(eq(marketSettlements.marketId, marketId))
        .limit(1),
    ]);

    const record = this.mapMarketRecord(market);

    return {
      market: {
        ...record,
        resolutionRules: market.resolutionRules,
        resolutionSources: market.resolutionSources,
        statusTimeline: this.buildStatusTimeline(market),
        lastCommandSequence: market.lastCommandSequence,
        resolution: resolution[0]
          ? this.mapResolution(resolution[0])
          : null,
        settlement: settlement[0]
          ? this.mapSettlement(settlement[0])
          : null,
      },
    };
  }

  async resolveMarket(
    marketId: string,
    input: {
      outcome: MarketResolutionOutcome;
      evidenceSummary: string;
      evidenceSources?: string[];
      approvedBy?: string;
    },
  ) {
    return db.transaction(async (tx) => {
      const market = await this.loadMarketForResolution(tx, marketId);
      await this.acquireMarketWriteLock(tx, market.id);
      await this.assertNoOpenOrders(tx, market.id);

      const existingResolutionRows = await tx
        .select()
        .from(marketResolutions)
        .where(eq(marketResolutions.marketId, market.id))
        .limit(1);

      const existingResolution = existingResolutionRows[0];

      if (existingResolution) {
        throw new AppError(
          409,
          "market_already_resolved",
          "market already has a recorded resolution",
        );
      }

      const existingSettlementRows = await tx
        .select({
          id: marketSettlements.id,
        })
        .from(marketSettlements)
        .where(eq(marketSettlements.marketId, market.id))
        .limit(1);

      if (existingSettlementRows[0]) {
        throw new AppError(
          409,
          "market_already_settled",
          "market has already been settled",
        );
      }

      const now = new Date();
      const updatedMarketRows = await tx
        .update(markets)
        .set({
          status: "awaiting_resolution",
          statusChangedAt: now,
          updatedAt: now,
        })
        .where(eq(markets.id, market.id))
        .returning();

      const updatedMarket = updatedMarketRows[0];

      if (!updatedMarket) {
        throw new AppError(500, "market_resolution_failed", "failed to update market status");
      }

      const insertedResolutionRows = await tx
        .insert(marketResolutions)
        .values({
          marketId: market.id,
          outcome: input.outcome,
          evidenceSummary: input.evidenceSummary,
          evidenceSources: input.evidenceSources ?? [],
          approvedBy: input.approvedBy,
          approvedAt: now,
          updatedAt: now,
        })
        .returning();

      const resolution = insertedResolutionRows[0];

      if (!resolution) {
        throw new AppError(500, "market_resolution_failed", "failed to persist market resolution");
      }

      return {
        market: updatedMarket,
        resolution: this.mapResolution(resolution),
      };
    });
  }

  async settleMarket(marketId: string) {
    return db.transaction(async (tx) => {
      const market = await this.loadMarketForSettlement(tx, marketId);
      await this.acquireMarketWriteLock(tx, market.id);
      await this.assertNoOpenOrders(tx, market.id);

      const resolutionRows = await tx
        .select()
        .from(marketResolutions)
        .where(eq(marketResolutions.marketId, market.id))
        .limit(1);

      const resolution = resolutionRows[0];

      if (!resolution) {
        throw new AppError(
          409,
          "market_resolution_missing",
          "market must be resolved before settlement",
        );
      }

      const existingSettlementRows = await tx
        .select()
        .from(marketSettlements)
        .where(eq(marketSettlements.marketId, market.id))
        .limit(1);

      const existingSettlement = existingSettlementRows[0];

      if (existingSettlement) {
        return {
          marketId: market.id,
          alreadySettled: true,
          resolution: this.mapResolution(resolution),
          settlement: this.mapSettlement(existingSettlement),
          payouts: await this.listSettlementPayouts(tx, existingSettlement.id, market.currency),
        };
      }

      const positions = await this.loadNormalizedPositions(tx, market.id);
      const payouts = positions.map((position) => {
        const payoutMinor =
          resolution.outcome === "void"
            ? position.costBasisMinor
            : position.outcome === resolution.outcome
              ? position.quantity * 100
              : 0;

        return {
          userId: position.userId,
          marketId: market.id,
          outcome: resolution.outcome,
          quantity: position.quantity,
          costBasisMinor: position.costBasisMinor,
          payoutMinor,
        };
      });

      const settlementStatus: MarketStatus =
        resolution.outcome === "void" ? "voided" : "settled";
      const settledAt = new Date();

      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: "market_settlement",
          referenceId: market.id,
          metadata: {
            marketId: market.id,
            resolutionId: resolution.id,
            outcome: resolution.outcome,
            settledAt: settledAt.toISOString(),
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
          "failed to create settlement ledger transaction",
        );
      }

      const ledgerEntriesToInsert = [];

      for (const payout of payouts) {
        const positionWallet = await this.getOrCreateWalletAccount(tx, {
          ownerUserId: payout.userId,
          type: "user_position_collateral",
          currency: market.currency,
        });

        if (payout.costBasisMinor > 0) {
          ledgerEntriesToInsert.push({
            transactionId: transaction.id,
            walletAccountId: positionWallet.id,
            side: "debit" as const,
            amountMinor: payout.costBasisMinor,
            currency: market.currency,
          });
        }

        if (payout.payoutMinor > 0) {
          const cashWallet = await this.getOrCreateWalletAccount(tx, {
            ownerUserId: payout.userId,
            type: "user_cash",
            currency: market.currency,
          });

          ledgerEntriesToInsert.push({
            transactionId: transaction.id,
            walletAccountId: cashWallet.id,
            side: "credit" as const,
            amountMinor: payout.payoutMinor,
            currency: market.currency,
          });
        }
      }

      if (ledgerEntriesToInsert.length > 0) {
        await tx.insert(ledgerEntries).values(ledgerEntriesToInsert);
      }

      const settlementRows = await tx
        .insert(marketSettlements)
        .values({
          marketId: market.id,
          resolutionId: resolution.id,
          outcome: resolution.outcome,
          settledAt,
          totalPayoutMinor: payouts.reduce((total, payout) => total + payout.payoutMinor, 0),
          affectedUserCount: payouts.length,
          metadata: {
            currency: market.currency,
            ledgerTransactionId: transaction.id,
          },
        })
        .returning();

      const settlement = settlementRows[0];

      if (!settlement) {
        throw new AppError(
          500,
          "market_settlement_failed",
          "failed to persist market settlement",
        );
      }

      if (payouts.length > 0) {
        await tx.insert(marketSettlementPayouts).values(
          payouts.map((payout) => ({
            settlementId: settlement.id,
            marketId: payout.marketId,
            userId: payout.userId,
            outcome: payout.outcome,
            quantity: payout.quantity,
            costBasisMinor: payout.costBasisMinor,
            payoutMinor: payout.payoutMinor,
          })),
        );
      }

      const nextPriceSnapshot = this.getSettlementPriceSnapshot(resolution.outcome);

      const updatedMarketRows = await tx
        .update(markets)
        .set({
          status: settlementStatus,
          yesPriceBps: nextPriceSnapshot.yesPriceBps,
          noPriceBps: nextPriceSnapshot.noPriceBps,
          statusChangedAt: settledAt,
          updatedAt: settledAt,
        })
        .where(eq(markets.id, market.id))
        .returning();

      const updatedMarket = updatedMarketRows[0];

      if (!updatedMarket) {
        throw new AppError(
          500,
          "market_settlement_failed",
          "failed to update settled market state",
        );
      }

      return {
        marketId: market.id,
        alreadySettled: false,
        market: updatedMarket,
        resolution: this.mapResolution(resolution),
        settlement: this.mapSettlement(settlement),
        payouts: payouts.map((payout) => ({
          ...payout,
          currency: market.currency,
          netPnlMinor: payout.payoutMinor - payout.costBasisMinor,
        })),
      };
    });
  }

  async getOrderBookSnapshot(marketId: string) {
    const market = await this.assertMarketExists(marketId);

    const rows = await db
      .select({
        outcome: orders.outcome,
        side: orders.side,
        priceBps: orders.limitPriceBps,
        totalQuantity: sql<string>`sum(${orders.quantity} - ${orders.filledQuantity})`,
        orderCount: sql<string>`count(*)`,
        latestOrderAt: sql<Date>`max(${orders.createdAt})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.marketId, marketId),
          or(
            eq(orders.status, "queued_for_matching"),
            eq(orders.status, "partially_filled"),
          ),
          eq(orders.type, "limit"),
        ),
      )
      .groupBy(orders.outcome, orders.side, orders.limitPriceBps);

    const priceLevels = rows
      .filter(
        (row): row is typeof row & { priceBps: number } =>
          typeof row.priceBps === "number",
      )
      .map((row) => ({
        outcome: row.outcome,
        side: row.side,
        priceBps: row.priceBps,
        totalQuantity: Number(row.totalQuantity),
        orderCount: Number(row.orderCount),
        latestOrderAt: row.latestOrderAt,
      }));

    const books = {
      yes: this.buildOutcomeBook(
        priceLevels.filter((level) => level.outcome === "yes"),
      ),
      no: this.buildOutcomeBook(
        priceLevels.filter((level) => level.outcome === "no"),
      ),
    };

    return {
      marketId,
      snapshot: {
        asOf: new Date().toISOString(),
        sequence: market.lastCommandSequence,
        sequenceToken: `${marketId}:${market.lastCommandSequence}`,
        totalPriceLevels: priceLevels.length,
      },
      books,
    };
  }

  async getOrderBookDeltas(
    marketId: string,
    input: {
      afterSequence: number;
      limit: number;
    },
  ) {
    const market = await this.assertMarketExists(marketId);
    const pageSize = Math.min(input.limit, 500);

    const rows = await db
      .select({
        id: marketCommandEvents.id,
        sequence: marketCommandEvents.sequence,
        commandType: marketCommandEvents.commandType,
        metadata: marketCommandEvents.metadata,
        createdAt: marketCommandEvents.createdAt,
        orderId: orders.id,
        orderType: orders.type,
        side: orders.side,
        outcome: orders.outcome,
        quantity: orders.quantity,
        limitPriceBps: orders.limitPriceBps,
        referencePriceBps: orders.referencePriceBps,
        reservedAmountMinor: orders.reservedAmountMinor,
        currency: orders.currency,
      })
      .from(marketCommandEvents)
      .innerJoin(orders, eq(orders.id, marketCommandEvents.orderId))
      .where(
        and(
          eq(marketCommandEvents.marketId, marketId),
          gt(marketCommandEvents.sequence, input.afterSequence),
        ),
      )
      .orderBy(asc(marketCommandEvents.sequence))
      .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const pageRows = rows.slice(0, pageSize);
    const endingSequence = pageRows.at(-1)?.sequence ?? input.afterSequence;

    return {
      marketId,
      recovery: {
        requestedAfterSequence: input.afterSequence,
        latestSequence: market.lastCommandSequence,
        hasMore,
        nextAfterSequence: hasMore ? endingSequence : null,
        sequenceToken: `${marketId}:${market.lastCommandSequence}`,
      },
      deltas: pageRows.map((row) => {
        const metadata = this.asRecord(row.metadata);
        const orderType = this.pickEnumValue<OrderType>(
          metadata.orderType,
          row.orderType,
          orderTypeEnum.enumValues,
        );
        const side = this.pickEnumValue<OrderSide>(
          metadata.side,
          row.side,
          orderSideEnum.enumValues,
        );
        const outcome = this.pickEnumValue<OrderOutcome>(
          metadata.outcome,
          row.outcome,
          orderOutcomeEnum.enumValues,
        );
        const quantity = this.pickNumber(metadata.quantity, row.quantity);
        const limitPriceBps = this.pickNullableNumber(
          metadata.limitPriceBps,
          row.limitPriceBps,
        );
        const referencePriceBps = this.pickNumber(
          metadata.referencePriceBps,
          row.referencePriceBps,
        );
        const reservedAmountMinor = this.pickNumber(
          metadata.reservedAmountMinor,
          row.reservedAmountMinor,
        );
        const trade = row.commandType === "match_execution"
          ? {
              tradeId: this.pickString(metadata.tradeId, ""),
              makerOrderId: this.pickString(metadata.makerOrderId, ""),
              takerOrderId: this.pickString(metadata.takerOrderId, row.orderId),
              outcome: this.pickEnumValue<OrderOutcome>(
                metadata.outcome,
                outcome,
                orderOutcomeEnum.enumValues,
              ),
              priceBps: this.pickNumber(metadata.priceBps, referencePriceBps),
              quantity: this.pickNumber(metadata.quantity, quantity),
            }
          : null;
        const bookEffect =
          row.commandType === "match_execution"
            ? this.pickString(metadata.bookEffect, "trade")
            : orderType !== "limit"
              ? "none"
              : row.commandType === "order_create"
                ? "resting_add"
                : "resting_remove";

        return {
          id: row.id,
          sequence: row.sequence,
          occurredAt: row.createdAt.toISOString(),
          commandType: row.commandType,
          bookEffect,
          affectsBook: bookEffect !== "none",
          order: {
            id: row.orderId,
            type: orderType,
            side,
            outcome,
            quantity,
            limitPriceBps,
            referencePriceBps,
            reservedAmountMinor,
            currency: this.pickString(metadata.currency, row.currency),
            stateAtSequence:
              row.commandType === "order_create"
                ? "queued_for_matching"
                : row.commandType === "order_cancel"
                  ? "cancelled"
                  : this.pickNumber(metadata.takerRemainingQuantity, 0) === 0
                    ? "filled"
                    : "partially_filled",
          },
          ...(trade ? { trade } : {}),
          metadata,
        };
      }),
    };
  }

  private async assertEventExists(eventId: string) {
    const [event] = await db
      .select({
        id: marketEvents.id,
      })
      .from(marketEvents)
      .where(eq(marketEvents.id, eventId))
      .limit(1);

    if (!event) {
      throw new AppError(404, "event_not_found", "event was not found");
    }
  }

  private async assertMarketExists(marketId: string) {
    const [market] = await db
      .select({
        id: markets.id,
        lastCommandSequence: markets.lastCommandSequence,
        currency: markets.currency,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      throw new AppError(404, "market_not_found", "market was not found");
    }

    return market;
  }

  private async loadMarketForResolution(executor: DbExecutor, marketId: string) {
    const [market] = await executor
      .select({
        id: markets.id,
        status: markets.status,
        currency: markets.currency,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      throw new AppError(404, "market_not_found", "market was not found");
    }

    if (
      market.status === "settled" ||
      market.status === "voided" ||
      market.status === "cancelled"
    ) {
      throw new AppError(
        409,
        "market_not_resolvable",
        `market status ${market.status} is not eligible for resolution`,
      );
    }

    return market;
  }

  private async loadMarketForSettlement(executor: DbExecutor, marketId: string) {
    const [market] = await executor
      .select({
        id: markets.id,
        status: markets.status,
        currency: markets.currency,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      throw new AppError(404, "market_not_found", "market was not found");
    }

    if (
      market.status !== "awaiting_resolution" &&
      market.status !== "trading_closed" &&
      market.status !== "active"
    ) {
      throw new AppError(
        409,
        "market_not_settleable",
        `market status ${market.status} is not eligible for settlement`,
      );
    }

    return market;
  }

  private async assertNoOpenOrders(executor: DbExecutor, marketId: string) {
    const [openOrder] = await executor
      .select({
        id: orders.id,
      })
      .from(orders)
      .where(
        and(
          eq(orders.marketId, marketId),
          inArray(orders.status, ["queued_for_matching", "partially_filled"]),
        ),
      )
      .limit(1);

    if (openOrder) {
      throw new AppError(
        409,
        "market_has_open_orders",
        "market still has open orders that must be cleared before resolution",
      );
    }
  }

  private async loadNormalizedPositions(executor: DbExecutor, marketId: string) {
    const takerOrders = alias(orders, "taker_orders");
    const rows = await executor
      .select({
        tradeId: marketTrades.id,
        makerUserId: orders.userId,
        makerSide: orders.side,
        makerOutcome: orders.outcome,
        takerUserId: takerOrders.userId,
        takerSide: takerOrders.side,
        takerOutcome: takerOrders.outcome,
        priceBps: marketTrades.priceBps,
        quantity: marketTrades.quantity,
      })
      .from(marketTrades)
      .innerJoin(orders, eq(orders.id, marketTrades.makerOrderId))
      .innerJoin(takerOrders, eq(takerOrders.id, marketTrades.takerOrderId))
      .where(eq(marketTrades.marketId, marketId));

    const positions = new Map<string, NormalizedPosition>();

    for (const row of rows) {
      for (const fill of [
        {
          userId: row.makerUserId,
          marketId,
          side: row.makerSide,
          outcome: row.makerOutcome,
          priceBps: row.priceBps,
          quantity: row.quantity,
        },
        {
          userId: row.takerUserId,
          marketId,
          side: row.takerSide,
          outcome: row.takerOutcome,
          priceBps: row.priceBps,
          quantity: row.quantity,
        },
      ]) {
        const normalizedOutcome =
          fill.side === "buy"
            ? fill.outcome
            : fill.outcome === "yes"
              ? "no"
              : "yes";
        const normalizedPriceBps =
          fill.side === "buy" ? fill.priceBps : 10000 - fill.priceBps;
        const key = `${fill.userId}:${normalizedOutcome}`;
        const existing = positions.get(key);
        const costBasisMinor = Math.ceil((fill.quantity * normalizedPriceBps) / 100);

        positions.set(key, {
          userId: fill.userId,
          marketId,
          outcome: normalizedOutcome,
          quantity: (existing?.quantity ?? 0) + fill.quantity,
          costBasisMinor: (existing?.costBasisMinor ?? 0) + costBasisMinor,
        });
      }
    }

    return Array.from(positions.values());
  }

  private getSettlementPriceSnapshot(outcome: MarketResolutionOutcome) {
    if (outcome === "yes") {
      return {
        yesPriceBps: 10000,
        noPriceBps: 0,
      };
    }

    if (outcome === "no") {
      return {
        yesPriceBps: 0,
        noPriceBps: 10000,
      };
    }

    return {
      yesPriceBps: 5000,
      noPriceBps: 5000,
    };
  }

  private async listSettlementPayouts(
    executor: DbExecutor,
    settlementId: string,
    currency: MarketCurrency,
  ) {
    const rows = await executor
      .select()
      .from(marketSettlementPayouts)
      .where(eq(marketSettlementPayouts.settlementId, settlementId))
      .orderBy(asc(marketSettlementPayouts.createdAt));

    return rows.map((row) => ({
      settlementId: row.settlementId,
      marketId: row.marketId,
      userId: row.userId,
      outcome: row.outcome,
      quantity: row.quantity,
      costBasisMinor: row.costBasisMinor,
      payoutMinor: row.payoutMinor,
      netPnlMinor: row.payoutMinor - row.costBasisMinor,
      currency,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private assertPriceSnapshot(yesPriceBps: number, noPriceBps: number) {
    if (
      !Number.isInteger(yesPriceBps) ||
      !Number.isInteger(noPriceBps) ||
      yesPriceBps < 0 ||
      noPriceBps < 0 ||
      yesPriceBps > 10000 ||
      noPriceBps > 10000 ||
      yesPriceBps + noPriceBps !== 10000
    ) {
      throw new AppError(
        400,
        "invalid_price_snapshot",
        "yes and no prices must be integer basis points summing to 10000",
      );
    }
  }

  private getOrderByClause(sort: ListMarketsInput["sort"]) {
    switch (sort) {
      case "closing_soon":
        return [asc(markets.closesAt), desc(markets.createdAt)];
      case "highest_volume":
        return [desc(markets.volumeUsdMinor), desc(markets.createdAt)];
      case "newest":
      default:
        return [desc(markets.createdAt)];
    }
  }

  private mapMarketRecord(row: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    status: MarketStatus;
    currency: MarketCurrency;
    tags: string[];
    yesPriceBps: number;
    noPriceBps: number;
    volumeUsdMinor: number;
    opensAt: Date | null;
    closesAt: Date | null;
    resolvesAt: Date | null;
    statusChangedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    eventId: string;
    eventSlug: string;
    eventTitle: string;
    eventSummary: string | null;
    eventCategory: string;
    eventStartsAt: Date | null;
    eventEndsAt: Date | null;
  }): MarketRecord {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      status: row.status,
      currency: row.currency,
      tags: row.tags,
      yesPriceBps: row.yesPriceBps,
      noPriceBps: row.noPriceBps,
      volumeUsdMinor: row.volumeUsdMinor,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      resolvesAt: row.resolvesAt,
      statusChangedAt: row.statusChangedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      event: {
        id: row.eventId,
        slug: row.eventSlug,
        title: row.eventTitle,
        summary: row.eventSummary,
        category: row.eventCategory,
        startsAt: row.eventStartsAt,
        endsAt: row.eventEndsAt,
      },
    };
  }

  private mapResolution(row: typeof marketResolutions.$inferSelect) {
    return {
      id: row.id,
      marketId: row.marketId,
      outcome: row.outcome,
      evidenceSummary: row.evidenceSummary,
      evidenceSources: row.evidenceSources,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapSettlement(row: typeof marketSettlements.$inferSelect) {
    return {
      id: row.id,
      marketId: row.marketId,
      resolutionId: row.resolutionId,
      outcome: row.outcome,
      settledAt: row.settledAt.toISOString(),
      totalPayoutMinor: row.totalPayoutMinor,
      affectedUserCount: row.affectedUserCount,
      metadata: this.asRecord(row.metadata),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private buildStatusTimeline(row: {
    createdAt: Date;
    opensAt: Date | null;
    closesAt: Date | null;
    resolvesAt: Date | null;
    status: MarketStatus;
    statusChangedAt: Date;
  }) {
    const timeline = [
      {
        milestone: "created",
        at: row.createdAt,
      },
    ];

    if (row.opensAt) {
      timeline.push({
        milestone: "opens",
        at: row.opensAt,
      });
    }

    if (row.closesAt) {
      timeline.push({
        milestone: "closes",
        at: row.closesAt,
      });
    }

    if (row.resolvesAt) {
      timeline.push({
        milestone: "resolves",
        at: row.resolvesAt,
      });
    }

    timeline.push({
      milestone: `status:${row.status}`,
      at: row.statusChangedAt,
    });

    return timeline;
  }

  private buildOutcomeBook(
    levels: Array<{
      outcome: OrderOutcome;
      side: OrderSide;
      priceBps: number;
      totalQuantity: number;
      orderCount: number;
      latestOrderAt: Date | null;
    }>,
  ) {
    const bids = levels
      .filter((level) => level.side === "buy")
      .sort((left, right) => right.priceBps - left.priceBps)
      .map((level) => ({
        priceBps: level.priceBps,
        quantity: level.totalQuantity,
        orderCount: level.orderCount,
      }));
    const asks = levels
      .filter((level) => level.side === "sell")
      .sort((left, right) => left.priceBps - right.priceBps)
      .map((level) => ({
        priceBps: level.priceBps,
        quantity: level.totalQuantity,
        orderCount: level.orderCount,
      }));

    return {
      bestBidPriceBps: bids[0]?.priceBps ?? null,
      bestAskPriceBps: asks[0]?.priceBps ?? null,
      bids,
      asks,
    };
  }

  private asRecord(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private pickEnumValue<T extends string>(
    candidate: unknown,
    fallback: T,
    values: readonly T[],
  ) {
    if (typeof candidate === "string" && values.includes(candidate as T)) {
      return candidate as T;
    }

    return fallback;
  }

  private pickNumber(candidate: unknown, fallback: number) {
    return typeof candidate === "number" && Number.isFinite(candidate)
      ? candidate
      : fallback;
  }

  private pickNullableNumber(candidate: unknown, fallback: number | null) {
    if (candidate === null) {
      return null;
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }

    return fallback;
  }

  private pickString(candidate: unknown, fallback: string) {
    return typeof candidate === "string" ? candidate : fallback;
  }

  private async acquireMarketWriteLock(executor: DbExecutor, marketId: string) {
    await executor.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${marketId}, 0))`,
    );
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
