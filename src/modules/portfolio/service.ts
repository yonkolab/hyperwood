import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client';
import {
  ledgerEntries,
  ledgerTransactions,
  type marketCurrencyEnum,
  marketSettlementPayouts,
  marketSettlements,
  markets,
  marketTrades,
  orders,
  users,
  walletAccounts,
} from '../../db/schema';
import { AppError } from '../../lib/errors';

type FillRole = 'maker' | 'taker';
type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];
type WalletAccountType =
  | 'user_cash'
  | 'user_order_reserved'
  | 'user_position_collateral'
  | 'user_withdrawal_hold';
type PositionRecord = {
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  outcome: 'yes' | 'no';
  quantity: number;
  averageEntryPriceBps: number;
  costBasisMinor: number;
};

const DEFAULT_RECENT_FILL_LIMIT = 20;
const DEFAULT_RECENT_ACTIVITY_LIMIT = 20;

export class PortfolioService {
  async getPortfolioSummary(userId: string, currency: MarketCurrency = 'USD') {
    const cash = await this.getCashSummary(userId, currency);
    const positions = await this.getDerivedPositions(userId, currency);
    const recentFills = await this.listFills(
      userId,
      DEFAULT_RECENT_FILL_LIMIT,
      currency,
    );
    const recentLedgerActivity = await this.listLedgerActivity(
      userId,
      DEFAULT_RECENT_ACTIVITY_LIMIT,
      currency,
    );

    return {
      currency,
      cash: {
        ...cash,
      },
      positions,
      recentFills: recentFills.fills,
      recentLedgerActivity,
    };
  }

  async listFills(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    await this.assertUserExists(userId);

    const rows = await this.loadUserFillRows(userId, currency);
    const fills = rows
      .sort(
        (left, right) => right.executedAt.getTime() - left.executedAt.getTime(),
      )
      .slice(0, Math.min(limit, 100))
      .map((row) => this.mapFill(row));

    return {
      currency,
      fills,
    };
  }

  async listSettlements(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    await this.assertUserExists(userId);

    const rows = await db
      .select({
        settlementId: marketSettlements.id,
        marketId: marketSettlementPayouts.marketId,
        marketSlug: markets.slug,
        marketTitle: markets.title,
        outcome: marketSettlements.outcome,
        quantity: marketSettlementPayouts.quantity,
        costBasisMinor: marketSettlementPayouts.costBasisMinor,
        payoutMinor: marketSettlementPayouts.payoutMinor,
        settledAt: marketSettlements.settledAt,
      })
      .from(marketSettlementPayouts)
      .innerJoin(
        marketSettlements,
        eq(marketSettlements.id, marketSettlementPayouts.settlementId),
      )
      .innerJoin(markets, eq(markets.id, marketSettlementPayouts.marketId))
      .where(
        and(
          eq(marketSettlementPayouts.userId, userId),
          eq(markets.currency, currency),
        ),
      )
      .orderBy(
        desc(marketSettlements.settledAt),
        desc(marketSettlementPayouts.createdAt),
      )
      .limit(Math.min(limit, 100));

    return {
      currency,
      settlements: rows.map((row) => ({
        settlementId: row.settlementId,
        marketId: row.marketId,
        marketSlug: row.marketSlug,
        marketTitle: row.marketTitle,
        outcome: row.outcome,
        quantity: row.quantity,
        costBasisMinor: row.costBasisMinor,
        payoutMinor: row.payoutMinor,
        netPnlMinor: row.payoutMinor - row.costBasisMinor,
        settledAt: row.settledAt.toISOString(),
      })),
    };
  }

  private async getCashSummary(userId: string, currency: MarketCurrency) {
    await this.assertUserExists(userId);

    const [
      cashWallet,
      reservedWallet,
      positionCollateralWallet,
      withdrawalHoldWallet,
    ] = await Promise.all([
      this.getOrCreateWalletAccount(userId, 'user_cash', currency),
      this.getOrCreateWalletAccount(userId, 'user_order_reserved', currency),
      this.getOrCreateWalletAccount(
        userId,
        'user_position_collateral',
        currency,
      ),
      this.getOrCreateWalletAccount(userId, 'user_withdrawal_hold', currency),
    ]);

    const [
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
      withdrawalHoldMinor,
      restingOrderValueMinor,
    ] = await Promise.all([
      this.getWalletAccountBalance(cashWallet.id),
      this.getWalletAccountBalance(reservedWallet.id),
      this.getWalletAccountBalance(positionCollateralWallet.id),
      this.getWalletAccountBalance(withdrawalHoldWallet.id),
      this.getRestingOrderValueMinor(userId, currency),
    ]);

    return {
      currency,
      walletAccountId: cashWallet.id,
      reservedWalletAccountId: reservedWallet.id,
      positionCollateralWalletAccountId: positionCollateralWallet.id,
      withdrawalHoldWalletAccountId: withdrawalHoldWallet.id,
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
      withdrawalHoldMinor,
      totalBalanceMinor:
        availableBalanceMinor +
        reservedBalanceMinor +
        positionCollateralMinor +
        withdrawalHoldMinor,
      restingOrderValueMinor,
    };
  }

  private async getDerivedPositions(userId: string, currency: MarketCurrency) {
    const fills = await this.loadUserFillRows(userId, currency);
    const grouped = fills.reduce<
      Map<string, PositionRecord & { totalWeightedPriceBpsQuantity: number }>
    >((positions, fill) => {
      if (fill.marketStatus === 'settled' || fill.marketStatus === 'voided') {
        return positions;
      }

      const normalized = this.normalizeExposure(fill);
      const key = `${normalized.marketId}:${normalized.outcome}`;
      const existing = positions.get(key);
      const totalWeightedPriceBpsQuantity =
        (existing?.totalWeightedPriceBpsQuantity ?? 0) +
        normalized.averageEntryPriceBps * normalized.quantity;
      const quantity = (existing?.quantity ?? 0) + normalized.quantity;
      const costBasisMinor =
        (existing?.costBasisMinor ?? 0) + normalized.costBasisMinor;

      positions.set(key, {
        ...normalized,
        quantity,
        costBasisMinor,
        totalWeightedPriceBpsQuantity,
        averageEntryPriceBps: Math.round(
          totalWeightedPriceBpsQuantity / quantity,
        ),
      });

      return positions;
    }, new Map<
      string,
      PositionRecord & { totalWeightedPriceBpsQuantity: number }
    >());

    return Array.from(grouped.values())
      .map(
        ({ totalWeightedPriceBpsQuantity: _ignored, ...position }) => position,
      )
      .sort((left, right) => left.marketTitle.localeCompare(right.marketTitle));
  }

  private async listLedgerActivity(
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

  private async getRestingOrderValueMinor(
    userId: string,
    currency: MarketCurrency,
  ) {
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

  private async loadUserFillRows(userId: string, currency: MarketCurrency) {
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
      const entries = [];

      if (row.makerUserId === userId) {
        entries.push({
          tradeId: row.tradeId,
          marketId: row.marketId,
          marketSlug: row.marketSlug,
          marketTitle: row.marketTitle,
          marketStatus: row.marketStatus,
          orderId: row.makerOrderId,
          role: 'maker' as FillRole,
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
          role: 'taker' as FillRole,
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

  private mapFill(
    fill: Awaited<ReturnType<PortfolioService['loadUserFillRows']>>[number],
  ) {
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

  private normalizeExposure(fill: {
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

  private async assertUserExists(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, 'user_not_found', 'user was not found');
    }
  }

  private async getWalletAccountBalance(walletAccountId: string) {
    const balanceRows = await db
      .select({
        balanceMinor: sql<string>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletAccountId, walletAccountId));

    return Number(balanceRows[0]?.balanceMinor ?? 0);
  }

  private async getOrCreateWalletAccount(
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
        'failed to create wallet account',
      );
    }

    return inserted;
  }

  private asRecord(value: unknown) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
