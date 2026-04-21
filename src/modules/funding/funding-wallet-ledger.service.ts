import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  fundingMethods,
  ledgerEntries,
  ledgerTransactions,
  users,
  walletAccounts,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import {
  doesFundingRailSupportCurrency,
  isFundingRailAllowedForCountry,
} from './policy';
import type {
  DbExecutor,
  FundingRail,
  FundingTransferStatus,
  FundingTransferType,
  MarketCurrency,
  SeedWalletBalanceInput,
  WalletAccountType,
} from './types';

export const WITHDRAWAL_REVIEW_THRESHOLD_MINOR = 250_000;

export class FundingWalletLedgerService {
  /**
   * Resolve or initialize all wallet balances for one user/currency tuple.
   *
   * Example:
   * `await walletLedgerService.getWalletBalance(userId, 'BRL')`
   */
  async getWalletBalance(userId: string, currency: MarketCurrency = 'USD') {
    await this.assertUserExists(userId);

    const wallet = await this.getOrCreateWalletAccount({
      ownerUserId: userId,
      type: 'user_cash',
      currency,
    });
    const reservedWallet = await this.getOrCreateWalletAccount({
      ownerUserId: userId,
      type: 'user_order_reserved',
      currency,
    });
    const positionCollateralWallet = await this.getOrCreateWalletAccount({
      ownerUserId: userId,
      type: 'user_position_collateral',
      currency,
    });
    const withdrawalHoldWallet = await this.getOrCreateWalletAccount({
      ownerUserId: userId,
      type: 'user_withdrawal_hold',
      currency,
    });

    const [
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
      withdrawalHoldMinor,
    ] = await Promise.all([
      this.getWalletAccountBalance(wallet.id),
      this.getWalletAccountBalance(reservedWallet.id),
      this.getWalletAccountBalance(positionCollateralWallet.id),
      this.getWalletAccountBalance(withdrawalHoldWallet.id),
    ]);

    return {
      walletAccountId: wallet.id,
      reservedWalletAccountId: reservedWallet.id,
      positionCollateralWalletAccountId: positionCollateralWallet.id,
      withdrawalHoldWalletAccountId: withdrawalHoldWallet.id,
      currency,
      balanceMinor: availableBalanceMinor,
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
      withdrawalHoldMinor,
      totalBalanceMinor:
        availableBalanceMinor +
        reservedBalanceMinor +
        positionCollateralMinor +
        withdrawalHoldMinor,
    };
  }

  /**
   * Seed a user cash wallet from the platform clearing wallet.
   *
   * Example:
   * `await walletLedgerService.seedWalletBalance({ userId, amountMinor: 1000, currency: 'USD' })`
   */
  async seedWalletBalance(input: SeedWalletBalanceInput) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new AppError(
        400,
        'invalid_amount',
        `amount must be a positive integer, received ${String(input.amountMinor)}`,
      );
    }

    await this.assertUserExists(input.userId);

    const currency = input.currency.toUpperCase();
    const userWallet = await this.getOrCreateWalletAccount({
      ownerUserId: input.userId,
      type: 'user_cash',
      currency,
    });
    const platformClearingWallet = await this.getOrCreateWalletAccount({
      ownerUserId: null,
      type: 'platform_clearing',
      currency,
    });

    await db.transaction(async (tx) => {
      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: 'wallet_seed',
          referenceId: input.referenceId,
        })
        .returning({ id: ledgerTransactions.id });
      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          'failed to create ledger transaction for wallet seed',
        );
      }

      await tx.insert(ledgerEntries).values([
        {
          transactionId: transaction.id,
          walletAccountId: userWallet.id,
          side: 'credit',
          amountMinor: input.amountMinor,
          currency,
        },
        {
          transactionId: transaction.id,
          walletAccountId: platformClearingWallet.id,
          side: 'debit',
          amountMinor: input.amountMinor,
          currency,
        },
      ]);
    });

    return this.getWalletBalance(input.userId, currency as MarketCurrency);
  }

  async assertUserExists(userId: string, executor: DbExecutor = db) {
    const [user] = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError(
        404,
        'user_not_found',
        `user was not found: ${userId}`,
      );
    }
  }

  async getVerifiedFundingMethod(
    userId: string,
    fundingMethodId: string,
    executor: DbExecutor = db,
  ) {
    const rows = await executor
      .select({
        id: fundingMethods.id,
        rail: fundingMethods.rail,
        status: fundingMethods.status,
        displayName: fundingMethods.displayName,
        countryCode: fundingMethods.countryCode,
      })
      .from(fundingMethods)
      .where(
        and(
          eq(fundingMethods.id, fundingMethodId),
          eq(fundingMethods.userId, userId),
        ),
      )
      .limit(1);
    const fundingMethod = rows[0];

    if (!fundingMethod) {
      throw new AppError(
        404,
        'funding_method_not_found',
        `funding method was not found for id ${fundingMethodId}`,
      );
    }

    if (fundingMethod.status !== 'verified') {
      throw new AppError(
        409,
        'funding_method_not_verified',
        `funding method ${fundingMethodId} must be verified before use`,
      );
    }

    if (
      !isFundingRailAllowedForCountry(
        fundingMethod.rail,
        fundingMethod.countryCode,
      )
    ) {
      throw new AppError(
        409,
        'funding_method_region_not_supported',
        `funding method ${fundingMethodId} is not allowed for country ${fundingMethod.countryCode}`,
      );
    }

    return fundingMethod;
  }

  requiresWithdrawalReview(amountMinor: number) {
    return amountMinor >= WITHDRAWAL_REVIEW_THRESHOLD_MINOR;
  }

  getLedgerReferenceTypesForTransfers(
    transfers: Array<{
      type: FundingTransferType;
      status: FundingTransferStatus;
    }>,
  ) {
    return Array.from(
      new Set(
        transfers.flatMap((transfer) =>
          this.getRequiredLedgerReferenceTypesForTransfer(transfer),
        ),
      ),
    );
  }

  getRequiredLedgerReferenceTypesForTransfer(transfer: {
    type: FundingTransferType;
    status: FundingTransferStatus;
  }) {
    if (transfer.type === 'deposit') {
      return transfer.status === 'settled' ? ['deposit_settlement'] : [];
    }

    if (transfer.status === 'pending' || transfer.status === 'in_review') {
      return ['withdrawal_hold'];
    }

    if (transfer.status === 'settled') {
      return ['withdrawal_settlement'];
    }

    if (transfer.status === 'failed') {
      return ['withdrawal_release'];
    }

    return [];
  }

  async getWalletAccountBalance(
    walletAccountId: string,
    executor: DbExecutor = db,
  ) {
    const balanceRows = await executor
      .select({
        balanceMinor: sql<string>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletAccountId, walletAccountId));

    return Number(balanceRows[0]?.balanceMinor ?? 0);
  }

  async getOrCreateWalletAccount(
    input: {
      ownerUserId: string | null;
      type: WalletAccountType;
      currency: string;
    },
    executor: DbExecutor = db,
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

  ensureFundingRailSupportsCurrency(rail: string, currency: MarketCurrency) {
    if (!doesFundingRailSupportCurrency(rail as FundingRail, currency)) {
      throw new AppError(
        409,
        'funding_method_currency_not_supported',
        `funding method rail ${rail} does not support currency ${currency}`,
      );
    }
  }
}
