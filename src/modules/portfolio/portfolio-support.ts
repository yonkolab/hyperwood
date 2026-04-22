import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client';
import {
  ledgerEntries,
  ledgerTransactions,
  markets,
  marketTrades,
  orders,
  users,
  walletAccounts,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type {
  FillRole,
  MarketCurrency,
  PositionRecord,
  WalletAccountType,
} from './types';

export type UserFillRow = {
  tradeId: string;
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  marketStatus: string;
  orderId: string;
  role: FillRole;
  side: 'buy' | 'sell';
  outcome: 'yes' | 'no';
  priceBps: number;
  quantity: number;
  executedAt: Date;
};

export type UserOrderRow = {
  orderId: string;
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  marketStatus: string;
  type: 'limit' | 'market';
  side: 'buy' | 'sell';
  outcome: 'yes' | 'no';
  status: 'queued_for_matching' | 'partially_filled' | 'filled' | 'cancelled';
  quantity: number;
  filledQuantity: number;
  limitPriceBps: number | null;
  referencePriceBps: number;
  reservedAmountMinor: number;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
};

export class PortfolioSupportService {
  /**
   * Ensure one user exists before building portfolio views.
   *
   * Example:
   * `await portfolioSupportService.assertUserExists(userId)`
   */
  async assertUserExists(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError(
        404,
        'user_not_found',
        `user was not found for id ${userId}`,
      );
    }
  }

  /**
   * Load or create one user wallet account for portfolio reads.
   *
   * Example:
   * `await portfolioSupportService.getOrCreateWalletAccount(userId, 'user_cash', 'USD')`
   */
  async getOrCreateWalletAccount(
    ownerUserId: string,
    type: WalletAccountType,
    currency: string,
  ) {
    const existingRows = await db
      .select({
        id: walletAccounts.id,
      })
      .from(walletAccounts)
      .where(
        and(
          eq(walletAccounts.ownerUserId, ownerUserId),
          eq(walletAccounts.type, type),
          eq(walletAccounts.currency, currency),
        ),
      )
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      return existing;
    }

    const insertedRows = await db
      .insert(walletAccounts)
      .values({
        ownerUserId,
        type,
        currency,
      })
      .returning({
        id: walletAccounts.id,
      });
    const inserted = insertedRows[0];

    if (!inserted) {
      throw new AppError(
        500,
        'wallet_account_creation_failed',
        `failed to create wallet account for user ${ownerUserId}, type ${type}, currency ${currency}`,
      );
    }

    return inserted;
  }

  /**
   * Replay one wallet balance from its ledger entries.
   *
   * Example:
   * `await portfolioSupportService.getWalletAccountBalance(walletId)`
   */
  async getWalletAccountBalance(walletAccountId: string) {
    const balanceRows = await db
      .select({
        balanceMinor: sql<string>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletAccountId, walletAccountId));

    return Number(balanceRows[0]?.balanceMinor ?? 0);
  }

  /**
   * Load all user fills for one market currency.
   *
   * Example:
   * `await portfolioSupportService.loadUserFillRows(userId, 'USD')`
   */
  async loadUserFillRows(userId: string, currency: MarketCurrency) {
    const makerOrders = alias(orders, 'maker_orders');
    const takerOrders = alias(orders, 'taker_orders');
    const marketTable = alias(markets, 'portfolio_markets');

    const rows = await db
      .select({
        tradeId: marketTrades.id,
        marketId: marketTrades.marketId,
        marketSlug: marketTable.slug,
        marketTitle: marketTable.title,
        marketCurrency: marketTable.currency,
        marketStatus: marketTable.status,
        makerOrderId: marketTrades.makerOrderId,
        takerOrderId: marketTrades.takerOrderId,
        priceBps: marketTrades.priceBps,
        quantity: marketTrades.quantity,
        executedAt: marketTrades.executedAt,
        makerUserId: makerOrders.userId,
        makerSide: makerOrders.side,
        makerOutcome: makerOrders.outcome,
        takerUserId: takerOrders.userId,
        takerSide: takerOrders.side,
        takerOutcome: takerOrders.outcome,
      })
      .from(marketTrades)
      .innerJoin(makerOrders, eq(makerOrders.id, marketTrades.makerOrderId))
      .innerJoin(takerOrders, eq(takerOrders.id, marketTrades.takerOrderId))
      .innerJoin(marketTable, eq(marketTable.id, marketTrades.marketId))
      .where(
        and(
          eq(marketTable.currency, currency),
          or(eq(makerOrders.userId, userId), eq(takerOrders.userId, userId)),
        ),
      );

    return rows.flatMap((row) => {
      const entries: UserFillRow[] = [];

      if (row.makerUserId === userId) {
        entries.push({
          tradeId: row.tradeId,
          marketId: row.marketId,
          marketSlug: row.marketSlug,
          marketTitle: row.marketTitle,
          marketStatus: row.marketStatus,
          orderId: row.makerOrderId,
          role: 'maker',
          side: row.makerSide,
          outcome: row.makerOutcome,
          priceBps: row.priceBps,
          quantity: row.quantity,
          executedAt: row.executedAt,
        });
      }

      if (row.takerUserId === userId) {
        entries.push({
          tradeId: row.tradeId,
          marketId: row.marketId,
          marketSlug: row.marketSlug,
          marketTitle: row.marketTitle,
          marketStatus: row.marketStatus,
          orderId: row.takerOrderId,
          role: 'taker',
          side: row.takerSide,
          outcome: row.takerOutcome,
          priceBps: row.priceBps,
          quantity: row.quantity,
          executedAt: row.executedAt,
        });
      }

      return entries;
    });
  }

  /**
   * Load all user orders for one market currency.
   *
   * Example:
   * `await portfolioSupportService.loadUserOrderRows(userId, 'USD')`
   */
  async loadUserOrderRows(userId: string, currency: MarketCurrency) {
    const marketTable = alias(markets, 'portfolio_order_markets');

    const rows = await db
      .select({
        orderId: orders.id,
        marketId: orders.marketId,
        marketSlug: marketTable.slug,
        marketTitle: marketTable.title,
        marketStatus: marketTable.status,
        type: orders.type,
        side: orders.side,
        outcome: orders.outcome,
        status: orders.status,
        quantity: orders.quantity,
        filledQuantity: orders.filledQuantity,
        limitPriceBps: orders.limitPriceBps,
        referencePriceBps: orders.referencePriceBps,
        reservedAmountMinor: orders.reservedAmountMinor,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        cancelledAt: orders.cancelledAt,
      })
      .from(orders)
      .innerJoin(marketTable, eq(marketTable.id, orders.marketId))
      .where(and(eq(orders.userId, userId), eq(orders.currency, currency)));

    return rows as UserOrderRow[];
  }

  /**
   * Normalize one fill into long exposure semantics.
   *
   * Example:
   * `portfolioSupportService.normalizeExposure(fill)`
   */
  normalizeExposure(fill: {
    marketId: string;
    marketSlug: string;
    marketTitle: string;
    side: 'buy' | 'sell';
    outcome: 'yes' | 'no';
    priceBps: number;
    quantity: number;
  }): PositionRecord {
    const normalizedOutcome =
      fill.side === 'buy'
        ? fill.outcome
        : fill.outcome === 'yes'
          ? 'no'
          : 'yes';
    const normalizedPriceBps =
      fill.side === 'buy' ? fill.priceBps : 10000 - fill.priceBps;

    return {
      marketId: fill.marketId,
      marketSlug: fill.marketSlug,
      marketTitle: fill.marketTitle,
      outcome: normalizedOutcome,
      quantity: fill.quantity,
      averageEntryPriceBps: normalizedPriceBps,
      costBasisMinor: Math.ceil((fill.quantity * normalizedPriceBps) / 100),
    };
  }

  /**
   * Shape one fill response row from the shared fill model.
   *
   * Example:
   * `portfolioSupportService.mapFill(fillRow)`
   */
  mapFill(fill: UserFillRow) {
    const normalized = this.normalizeExposure(fill);

    return {
      tradeId: fill.tradeId,
      marketId: fill.marketId,
      marketSlug: fill.marketSlug,
      marketTitle: fill.marketTitle,
      orderId: fill.orderId,
      role: fill.role,
      side: fill.side,
      outcome: fill.outcome,
      normalizedOutcome: normalized.outcome,
      priceBps: fill.priceBps,
      quantity: fill.quantity,
      costBasisMinor: normalized.costBasisMinor,
      executedAt: fill.executedAt.toISOString(),
    };
  }

  /**
   * Shape one historical order response row from the shared order model.
   *
   * Example:
   * `portfolioSupportService.mapOrder(orderRow)`
   */
  mapOrder(order: UserOrderRow) {
    return {
      orderId: order.orderId,
      marketId: order.marketId,
      marketSlug: order.marketSlug,
      marketTitle: order.marketTitle,
      marketStatus: order.marketStatus,
      type: order.type,
      side: order.side,
      outcome: order.outcome,
      status: order.status,
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      limitPriceBps: order.limitPriceBps,
      referencePriceBps: order.referencePriceBps,
      reservedAmountMinor: order.reservedAmountMinor,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
    };
  }

  /**
   * Aggregate recent ledger activity across user-owned wallets.
   *
   * Example:
   * `await portfolioSupportService.listLedgerActivity(userId, 20, 'USD')`
   */
  async listLedgerActivity(
    userId: string,
    limit: number,
    currency: MarketCurrency,
  ) {
    const rows = await db
      .select({
        transactionId: ledgerTransactions.id,
        referenceType: ledgerTransactions.referenceType,
        referenceId: ledgerTransactions.referenceId,
        metadata: ledgerTransactions.metadata,
        transactionCreatedAt: ledgerTransactions.createdAt,
        entrySide: ledgerEntries.side,
        amountMinor: ledgerEntries.amountMinor,
        currency: ledgerEntries.currency,
        walletAccountType: walletAccounts.type,
        walletAccountId: walletAccounts.id,
      })
      .from(ledgerTransactions)
      .innerJoin(
        ledgerEntries,
        eq(ledgerEntries.transactionId, ledgerTransactions.id),
      )
      .innerJoin(
        walletAccounts,
        eq(walletAccounts.id, ledgerEntries.walletAccountId),
      )
      .where(
        and(
          eq(walletAccounts.ownerUserId, userId),
          eq(walletAccounts.currency, currency),
          inArray(walletAccounts.type, [
            'user_cash',
            'user_order_reserved',
            'user_position_collateral',
            'user_withdrawal_hold',
          ]),
        ),
      )
      .orderBy(
        desc(ledgerTransactions.createdAt),
        desc(ledgerEntries.createdAt),
      )
      .limit(Math.min(limit * 4, 200));

    const grouped = new Map<
      string,
      {
        transactionId: string;
        referenceType: string;
        referenceId: string | null;
        metadata: Record<string, unknown>;
        createdAt: string;
        impacts: Array<{
          walletAccountId: string;
          walletAccountType: string;
          currency: string;
          amountMinor: number;
        }>;
      }
    >();

    for (const row of rows) {
      const existing = grouped.get(row.transactionId);
      const impact = {
        walletAccountId: row.walletAccountId,
        walletAccountType: row.walletAccountType,
        currency: row.currency,
        amountMinor:
          row.entrySide === 'credit' ? row.amountMinor : -row.amountMinor,
      };

      if (existing) {
        existing.impacts.push(impact);
        continue;
      }

      grouped.set(row.transactionId, {
        transactionId: row.transactionId,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        metadata: this.asRecord(row.metadata),
        createdAt: row.transactionCreatedAt.toISOString(),
        impacts: [impact],
      });
    }

    return Array.from(grouped.values()).slice(0, limit);
  }

  /**
   * Sum remaining resting-order collateral for one user and currency.
   *
   * Example:
   * `await portfolioSupportService.getRestingOrderValueMinor(userId, 'USD')`
   */
  async getRestingOrderValueMinor(userId: string, currency: MarketCurrency) {
    const rows = await db
      .select({
        side: orders.side,
        quantity: orders.quantity,
        filledQuantity: orders.filledQuantity,
        referencePriceBps: orders.referencePriceBps,
      })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.currency, currency),
          or(
            eq(orders.status, 'queued_for_matching'),
            eq(orders.status, 'partially_filled'),
          ),
        ),
      );

    return rows.reduce((total, order) => {
      const remainingQuantity = Math.max(
        0,
        order.quantity - order.filledQuantity,
      );
      const exposureBps =
        order.side === 'buy'
          ? order.referencePriceBps
          : 10000 - order.referencePriceBps;

      return total + Math.ceil((remainingQuantity * exposureBps) / 100);
    }, 0);
  }

  /**
   * Convert stored JSONB into a plain object or an empty object.
   *
   * Example:
   * `portfolioSupportService.asRecord(job.artifact)`
   */
  asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  /**
   * Shape one historical export job for API responses.
   *
   * Example:
   * `portfolioSupportService.mapExportJob(row)`
   */
  mapExportJob(row: {
    id: string;
    scope: 'account_history';
    status: 'completed';
    format: 'json';
    currency: string;
    createdAt: Date;
    completedAt: Date;
  }) {
    return {
      id: row.id,
      scope: row.scope,
      status: row.status,
      format: row.format,
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt.toISOString(),
    };
  }
}
