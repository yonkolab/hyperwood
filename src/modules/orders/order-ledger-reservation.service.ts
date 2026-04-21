import { and, eq, sql } from 'drizzle-orm';
import {
  ledgerEntries,
  ledgerTransactions,
  walletAccounts,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type {
  DbExecutor,
  MarketCurrency,
  OrderSide,
  WalletAccountType,
} from './types';

const MAX_ORDER_RESERVE_MINOR = 10_000_000;

export class OrderLedgerReservationService {
  /**
   * Calculate collateral required for a resting order or its remaining quantity.
   *
   * Example:
   * `orderLedgerReservationService.calculateReservedAmountMinor({ side: 'buy', quantity: 10, referencePriceBps: 5200 })`
   */
  calculateReservedAmountMinor(input: {
    side: OrderSide;
    quantity: number;
    referencePriceBps: number;
  }) {
    const exposureBps =
      input.side === 'buy'
        ? input.referencePriceBps
        : 10000 - input.referencePriceBps;

    if (exposureBps <= 0 || exposureBps >= 10000) {
      throw new AppError(
        400,
        'invalid_exposure',
        `order exposure is invalid for side ${input.side} and referencePriceBps ${String(input.referencePriceBps)}`,
      );
    }

    return Math.ceil((input.quantity * exposureBps) / 100);
  }

  /**
   * Reject reserve sizes that exceed the supported collateral cap.
   *
   * Example:
   * `orderLedgerReservationService.assertReserveWithinLimit(150000)`
   */
  assertReserveWithinLimit(reservedAmountMinor: number) {
    if (reservedAmountMinor > MAX_ORDER_RESERVE_MINOR) {
      throw new AppError(
        400,
        'order_exposure_limit_exceeded',
        `order exposure ${String(reservedAmountMinor)} exceeds the maximum supported exposure ${String(MAX_ORDER_RESERVE_MINOR)}`,
      );
    }
  }

  /**
   * Return one wallet account balance by replaying its ledger entries.
   *
   * Example:
   * `await orderLedgerReservationService.getWalletAccountBalance(tx, walletId)`
   */
  async getWalletAccountBalance(executor: DbExecutor, walletAccountId: string) {
    const balanceRows = await executor
      .select({
        balanceMinor: sql<string>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletAccountId, walletAccountId));

    return Number(balanceRows[0]?.balanceMinor ?? 0);
  }

  /**
   * Load or create a wallet account for one owner, type, and currency.
   *
   * Example:
   * `await orderLedgerReservationService.getOrCreateWalletAccount(tx, { ownerUserId: userId, type: 'user_cash', currency: 'USD' })`
   */
  async getOrCreateWalletAccount(
    executor: DbExecutor,
    input: {
      ownerUserId: string | null;
      type: WalletAccountType;
      currency: MarketCurrency;
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
        throw new AppError(
          500,
          'wallet_account_creation_failed',
          `failed to create wallet account for type ${input.type} and currency ${input.currency}`,
        );
      }

      return inserted;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
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

  /**
   * Move order collateral between available cash and reserved balances.
   *
   * Example:
   * `await orderLedgerReservationService.recordReservationTransfer(tx, { ... })`
   */
  async recordReservationTransfer(
    executor: DbExecutor,
    input: {
      referenceType: 'order_reservation' | 'order_release' | 'order_amendment';
      referenceId: string;
      metadata: Record<string, unknown>;
      fromWalletAccountId: string;
      toWalletAccountId: string;
      amountMinor: number;
      currency: MarketCurrency;
    },
  ) {
    if (input.amountMinor === 0) {
      return;
    }

    const transactionRows = await executor
      .insert(ledgerTransactions)
      .values({
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        metadata: input.metadata,
      })
      .returning({
        id: ledgerTransactions.id,
      });
    const transaction = transactionRows[0];

    if (!transaction) {
      throw new AppError(
        500,
        'ledger_transaction_failed',
        `failed to create ledger transaction for reference ${input.referenceId}`,
      );
    }

    await executor.insert(ledgerEntries).values([
      {
        transactionId: transaction.id,
        walletAccountId: input.fromWalletAccountId,
        side: 'debit',
        amountMinor: input.amountMinor,
        currency: input.currency,
      },
      {
        transactionId: transaction.id,
        walletAccountId: input.toWalletAccountId,
        side: 'credit',
        amountMinor: input.amountMinor,
        currency: input.currency,
      },
    ]);
  }
}
