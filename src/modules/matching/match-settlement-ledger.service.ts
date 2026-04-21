import { and, eq, sql } from 'drizzle-orm';
import {
  ledgerEntries,
  ledgerTransactions,
  walletAccounts,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type {
  DbExecutor,
  TradeCollateralMove,
  WalletAccountType,
} from './types';

export class MatchSettlementLedgerService {
  /**
   * Persist reserve-to-collateral and reserve-to-cash reclassification for one trade.
   *
   * Example:
   * `await matchSettlementLedgerService.recordCollateralReclassification(tx, { tradeId, marketId, executedAt, moves })`
   */
  async recordCollateralReclassification(
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
        referenceType: 'trade_collateral_reclassify',
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
      throw new AppError(
        500,
        'ledger_transaction_failed',
        `failed to create ledger transaction for trade ${input.tradeId}`,
      );
    }

    const entries = [];

    for (const move of input.moves) {
      const reservedWallet = await this.getOrCreateWalletAccount(executor, {
        ownerUserId: move.userId,
        type: 'user_order_reserved',
        currency: move.currency,
      });
      const positionWallet = await this.getOrCreateWalletAccount(executor, {
        ownerUserId: move.userId,
        type: 'user_position_collateral',
        currency: move.currency,
      });

      entries.push({
        transactionId: transaction.id,
        walletAccountId: reservedWallet.id,
        side: 'debit' as const,
        amountMinor: move.reserveConsumedMinor,
        currency: move.currency,
      });

      if (move.positionCollateralMinor > 0) {
        entries.push({
          transactionId: transaction.id,
          walletAccountId: positionWallet.id,
          side: 'credit' as const,
          amountMinor: move.positionCollateralMinor,
          currency: move.currency,
        });
      }

      if (move.cashReleaseMinor > 0) {
        const cashWallet = await this.getOrCreateWalletAccount(executor, {
          ownerUserId: move.userId,
          type: 'user_cash',
          currency: move.currency,
        });

        entries.push({
          transactionId: transaction.id,
          walletAccountId: cashWallet.id,
          side: 'credit' as const,
          amountMinor: move.cashReleaseMinor,
          currency: move.currency,
        });
      }
    }

    await executor.insert(ledgerEntries).values(entries);
  }

  /**
   * Load or create one wallet account used by matching-side ledger moves.
   *
   * Example:
   * `await matchSettlementLedgerService.getOrCreateWalletAccount(tx, { ownerUserId, type: 'user_cash', currency: 'USD' })`
   */
  async getOrCreateWalletAccount(
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
}
