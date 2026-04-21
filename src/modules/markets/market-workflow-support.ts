import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client';
import {
  marketAnnouncements,
  marketCommandEvents,
  marketEvents,
  marketResolutions,
  marketSettlementPayouts,
  marketSettlements,
  marketStatusTransitions,
  markets,
  marketTrades,
  orderOutcomeEnum,
  orderSideEnum,
  orders,
  orderTypeEnum,
  walletAccounts,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type {
  DbExecutor,
  ListMarketsInput,
  MarketCurrency,
  MarketRecord,
  MarketResolutionOutcome,
  MarketStatus,
  NormalizedPosition,
  OrderOutcome,
  OrderSide,
  WalletAccountType,
} from './types';

export async function assertEventExists(eventId: string) {
  const [event] = await db
    .select({
      id: marketEvents.id,
    })
    .from(marketEvents)
    .where(eq(marketEvents.id, eventId))
    .limit(1);

  if (!event) {
    throw new AppError(
      404,
      'event_not_found',
      `event was not found: ${eventId}`,
    );
  }
}

export async function assertMarketExists(marketId: string) {
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
    throw new AppError(
      404,
      'market_not_found',
      `market was not found: ${marketId}`,
    );
  }

  return market;
}

export async function loadMarketSummary(
  executor: DbExecutor,
  marketId: string,
) {
  const [market] = await executor
    .select({
      id: markets.id,
      slug: markets.slug,
      title: markets.title,
      status: markets.status,
    })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);

  if (!market) {
    throw new AppError(
      404,
      'market_not_found',
      `market was not found: ${marketId}`,
    );
  }

  return market;
}

export async function loadMarketForResolution(
  executor: DbExecutor,
  marketId: string,
) {
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
    throw new AppError(
      404,
      'market_not_found',
      `market was not found: ${marketId}`,
    );
  }

  if (
    market.status === 'settled' ||
    market.status === 'voided' ||
    market.status === 'cancelled'
  ) {
    throw new AppError(
      409,
      'market_not_resolvable',
      `market status ${market.status} is not eligible for resolution`,
    );
  }

  return market;
}

export async function loadMarketForSettlement(
  executor: DbExecutor,
  marketId: string,
) {
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
    throw new AppError(
      404,
      'market_not_found',
      `market was not found: ${marketId}`,
    );
  }

  if (
    market.status !== 'awaiting_resolution' &&
    market.status !== 'trading_closed' &&
    market.status !== 'active'
  ) {
    throw new AppError(
      409,
      'market_not_settleable',
      `market status ${market.status} is not eligible for settlement`,
    );
  }

  return market;
}

export function assertAllowedMarketStatusTransition(
  fromStatus: MarketStatus,
  toStatus: MarketStatus,
) {
  const allowedTransitions: Record<MarketStatus, MarketStatus[]> = {
    draft: ['scheduled', 'cancelled'],
    scheduled: ['active', 'halted', 'cancelled'],
    active: ['halted', 'trading_closed', 'disputed', 'cancelled'],
    halted: ['active', 'trading_closed', 'disputed', 'cancelled'],
    trading_closed: ['awaiting_resolution', 'disputed', 'cancelled'],
    awaiting_resolution: ['disputed', 'trading_closed'],
    settled: [],
    cancelled: [],
    disputed: ['awaiting_resolution', 'trading_closed', 'cancelled'],
    voided: [],
  };

  if (!allowedTransitions[fromStatus].includes(toStatus)) {
    throw new AppError(
      409,
      'invalid_market_status_transition',
      `cannot transition market from ${fromStatus} to ${toStatus}`,
    );
  }
}

export async function assertNoOpenOrders(
  executor: DbExecutor,
  marketId: string,
) {
  const [openOrder] = await executor
    .select({
      id: orders.id,
    })
    .from(orders)
    .where(
      and(
        eq(orders.marketId, marketId),
        inArray(orders.status, ['queued_for_matching', 'partially_filled']),
      ),
    )
    .limit(1);

  if (openOrder) {
    throw new AppError(
      409,
      'market_has_open_orders',
      `market ${marketId} still has open orders that must be cleared before resolution`,
    );
  }
}

export async function loadNormalizedPositions(
  executor: DbExecutor,
  marketId: string,
) {
  const takerOrders = alias(orders, 'taker_orders');
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
        fill.side === 'buy'
          ? fill.outcome
          : fill.outcome === 'yes'
            ? 'no'
            : 'yes';
      const normalizedPriceBps =
        fill.side === 'buy' ? fill.priceBps : 10000 - fill.priceBps;
      const key = `${fill.userId}:${normalizedOutcome}`;
      const existing = positions.get(key);
      const costBasisMinor = Math.ceil(
        (fill.quantity * normalizedPriceBps) / 100,
      );

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

export function getSettlementPriceSnapshot(outcome: MarketResolutionOutcome) {
  if (outcome === 'yes') {
    return {
      yesPriceBps: 10000,
      noPriceBps: 0,
    };
  }

  if (outcome === 'no') {
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

export async function listSettlementPayouts(
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

export function assertPriceSnapshot(yesPriceBps: number, noPriceBps: number) {
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
      'invalid_price_snapshot',
      `yes and no prices must be integer basis points summing to 10000, received yes=${String(yesPriceBps)} no=${String(noPriceBps)}`,
    );
  }
}

export function getOrderByClause(sort: ListMarketsInput['sort']) {
  switch (sort) {
    case 'closing_soon':
      return [asc(markets.closesAt), desc(markets.createdAt)];
    case 'highest_volume':
      return [desc(markets.volumeUsdMinor), desc(markets.createdAt)];
    default:
      return [desc(markets.createdAt)];
  }
}

export function mapMarketRecord(row: {
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

export function mapResolution(row: typeof marketResolutions.$inferSelect) {
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

export function mapSettlement(row: typeof marketSettlements.$inferSelect) {
  return {
    id: row.id,
    marketId: row.marketId,
    resolutionId: row.resolutionId,
    outcome: row.outcome,
    settledAt: row.settledAt.toISOString(),
    totalPayoutMinor: row.totalPayoutMinor,
    affectedUserCount: row.affectedUserCount,
    metadata: asRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapStatusTransition(
  row: typeof marketStatusTransitions.$inferSelect,
) {
  return {
    id: row.id,
    marketId: row.marketId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    changedBy: row.changedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapAnnouncement(
  announcement: typeof marketAnnouncements.$inferSelect,
) {
  return {
    id: announcement.id,
    marketId: announcement.marketId,
    title: announcement.title,
    message: announcement.message,
    publishedBy: announcement.publishedBy,
    publishedAt: announcement.publishedAt.toISOString(),
    createdAt: announcement.createdAt.toISOString(),
  };
}

export function buildStatusTimeline(
  row: {
    createdAt: Date;
    opensAt: Date | null;
    closesAt: Date | null;
    resolvesAt: Date | null;
    status: MarketStatus;
    statusChangedAt: Date;
  },
  transitions: Array<typeof marketStatusTransitions.$inferSelect>,
) {
  const timeline = [
    {
      milestone: 'created',
      at: row.createdAt,
    },
  ];

  if (row.opensAt) {
    timeline.push({
      milestone: 'opens',
      at: row.opensAt,
    });
  }

  if (row.closesAt) {
    timeline.push({
      milestone: 'closes',
      at: row.closesAt,
    });
  }

  if (row.resolvesAt) {
    timeline.push({
      milestone: 'resolves',
      at: row.resolvesAt,
    });
  }

  for (const transition of transitions) {
    timeline.push({
      milestone: `status:${transition.toStatus}`,
      at: transition.createdAt,
    });
  }

  if (!transitions.length) {
    timeline.push({
      milestone: `status:${row.status}`,
      at: row.statusChangedAt,
    });
  }

  return timeline;
}

export function buildOutcomeBook(
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
    .filter((level) => level.side === 'buy')
    .sort((left, right) => right.priceBps - left.priceBps)
    .map((level) => ({
      priceBps: level.priceBps,
      quantity: level.totalQuantity,
      orderCount: level.orderCount,
    }));
  const asks = levels
    .filter((level) => level.side === 'sell')
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

export function asRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function pickEnumValue<T extends string>(
  candidate: unknown,
  fallback: T,
  values: readonly T[],
) {
  if (typeof candidate === 'string' && values.includes(candidate as T)) {
    return candidate as T;
  }

  return fallback;
}

export function pickNumber(candidate: unknown, fallback: number) {
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : fallback;
}

export function pickNullableNumber(
  candidate: unknown,
  fallback: number | null,
) {
  if (candidate === null) {
    return null;
  }

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  return fallback;
}

export function pickString(candidate: unknown, fallback: string) {
  return typeof candidate === 'string' ? candidate : fallback;
}

export async function acquireMarketWriteLock(
  executor: DbExecutor,
  marketId: string,
) {
  await executor.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${marketId}, 0))`,
  );
}

export async function getOrCreateWalletAccount(
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
    throw new AppError(
      500,
      'wallet_account_creation_failed',
      `failed to create wallet account for type ${input.type} and currency ${input.currency}`,
    );
  }

  return inserted;
}

export async function listTrades(marketId: string, limit: number) {
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

export async function loadTradeAccessMarket(marketId: string) {
  const [market] = await db
    .select({
      id: markets.id,
      status: markets.status,
    })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);

  if (!market) {
    throw new AppError(
      404,
      'market_not_found',
      `market was not found: ${marketId}`,
    );
  }

  return market;
}

export function isHistoricalMarketStatus(status: MarketStatus) {
  return status === 'settled' || status === 'voided' || status === 'cancelled';
}

export {
  marketAnnouncements,
  marketCommandEvents,
  marketEvents,
  marketResolutions,
  marketSettlements,
  marketStatusTransitions,
  markets,
  marketTrades,
  orderOutcomeEnum,
  orderSideEnum,
  orders,
  orderTypeEnum,
};
