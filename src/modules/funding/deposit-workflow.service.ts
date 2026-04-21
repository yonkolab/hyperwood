import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  fundingMethods,
  fundingTransfers,
  ledgerEntries,
  ledgerTransactions,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { ComplianceService } from '../compliance/service';
import { mapDeposit } from './funding-record-mapper';
import type { FundingWalletLedgerService } from './funding-wallet-ledger.service';
import type { CreateDepositInput, MarketCurrency } from './types';

export class DepositWorkflowService {
  constructor(
    private readonly walletLedgerService: FundingWalletLedgerService,
    private readonly complianceService: ComplianceService,
  ) {}

  /**
   * Return deposit history for one user, optionally filtered by currency.
   *
   * Example:
   * `await depositWorkflowService.listDeposits(userId, { currency: 'USD', limit: 20 })`
   */
  async listDeposits(
    userId: string,
    input: {
      currency?: MarketCurrency;
      limit: number;
    },
  ) {
    await this.walletLedgerService.assertUserExists(userId);

    const rows = await db
      .select({
        id: fundingTransfers.id,
        type: fundingTransfers.type,
        status: fundingTransfers.status,
        amountMinor: fundingTransfers.amountMinor,
        currency: fundingTransfers.currency,
        fundingMethodId: fundingTransfers.fundingMethodId,
        fundingMethodRail: fundingMethods.rail,
        fundingMethodDisplayName: fundingMethods.displayName,
        requestedAt: fundingTransfers.requestedAt,
        settledAt: fundingTransfers.settledAt,
        failedAt: fundingTransfers.failedAt,
        providerTransferReference: fundingTransfers.providerTransferReference,
        failureReason: fundingTransfers.failureReason,
      })
      .from(fundingTransfers)
      .innerJoin(
        fundingMethods,
        eq(fundingMethods.id, fundingTransfers.fundingMethodId),
      )
      .where(
        and(
          eq(fundingTransfers.userId, userId),
          eq(fundingTransfers.type, 'deposit'),
          input.currency
            ? eq(fundingTransfers.currency, input.currency)
            : undefined,
        ),
      )
      .orderBy(sql`${fundingTransfers.requestedAt} desc`)
      .limit(Math.min(input.limit, 100));

    return {
      deposits: rows.map((row) => mapDeposit(row)),
    };
  }

  /**
   * Create a pending deposit request against a verified funding method.
   *
   * Example:
   * `await depositWorkflowService.createDeposit(input)`
   */
  async createDeposit(input: CreateDepositInput) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new AppError(
        400,
        'invalid_amount',
        `amount must be a positive integer, received ${String(input.amountMinor)}`,
      );
    }

    await this.walletLedgerService.assertUserExists(input.userId);

    const capabilityEvaluation =
      await this.complianceService.getCapabilityEvaluation(input.userId);

    if (!capabilityEvaluation.capabilities.funding.allowed) {
      throw new AppError(
        403,
        'funding_not_allowed',
        `funding not allowed: ${capabilityEvaluation.capabilities.funding.reasons.join(', ')}`,
      );
    }

    const fundingMethod =
      await this.walletLedgerService.getVerifiedFundingMethod(
        input.userId,
        input.fundingMethodId,
      );
    this.walletLedgerService.ensureFundingRailSupportsCurrency(
      fundingMethod.rail,
      input.currency,
    );

    const insertedRows = await db
      .insert(fundingTransfers)
      .values({
        userId: input.userId,
        fundingMethodId: fundingMethod.id,
        type: 'deposit',
        status: 'pending',
        amountMinor: input.amountMinor,
        currency: input.currency,
        metadata: {
          rail: fundingMethod.rail,
          fundingMethodDisplayName: fundingMethod.displayName,
        },
        updatedAt: new Date(),
      })
      .returning();
    const deposit = insertedRows[0];

    if (!deposit) {
      throw new AppError(
        500,
        'deposit_creation_failed',
        'failed to create deposit',
      );
    }

    return {
      deposit: mapDeposit({
        ...deposit,
        fundingMethodRail: fundingMethod.rail,
        fundingMethodDisplayName: fundingMethod.displayName,
      }),
    };
  }

  /**
   * Settle a pending deposit into the user's cash wallet.
   *
   * Example:
   * `await depositWorkflowService.settleDeposit(depositId)`
   */
  async settleDeposit(depositId: string) {
    return db.transaction(async (tx) => {
      const depositRows = await tx
        .select({
          id: fundingTransfers.id,
          userId: fundingTransfers.userId,
          fundingMethodId: fundingTransfers.fundingMethodId,
          type: fundingTransfers.type,
          status: fundingTransfers.status,
          amountMinor: fundingTransfers.amountMinor,
          currency: fundingTransfers.currency,
          requestedAt: fundingTransfers.requestedAt,
          settledAt: fundingTransfers.settledAt,
          failedAt: fundingTransfers.failedAt,
          providerTransferReference: fundingTransfers.providerTransferReference,
          failureReason: fundingTransfers.failureReason,
          fundingMethodRail: fundingMethods.rail,
          fundingMethodDisplayName: fundingMethods.displayName,
        })
        .from(fundingTransfers)
        .innerJoin(
          fundingMethods,
          eq(fundingMethods.id, fundingTransfers.fundingMethodId),
        )
        .where(eq(fundingTransfers.id, depositId))
        .limit(1);
      const deposit = depositRows[0];

      if (!deposit || deposit.type !== 'deposit') {
        throw new AppError(
          404,
          'deposit_not_found',
          `deposit was not found for id ${depositId}`,
        );
      }

      if (deposit.status === 'settled') {
        return {
          deposit: mapDeposit(deposit),
          alreadySettled: true,
        };
      }

      if (deposit.status !== 'pending') {
        throw new AppError(
          409,
          'deposit_not_settleable',
          `deposit ${depositId} is not in a settleable state: ${deposit.status}`,
        );
      }

      const userWallet =
        await this.walletLedgerService.getOrCreateWalletAccount(
          {
            ownerUserId: deposit.userId,
            type: 'user_cash',
            currency: deposit.currency,
          },
          tx,
        );
      const platformClearingWallet =
        await this.walletLedgerService.getOrCreateWalletAccount(
          {
            ownerUserId: null,
            type: 'platform_clearing',
            currency: deposit.currency,
          },
          tx,
        );

      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: 'deposit_settlement',
          referenceId: deposit.id,
          metadata: {
            fundingMethodId: deposit.fundingMethodId,
            rail: deposit.fundingMethodRail,
          },
        })
        .returning({ id: ledgerTransactions.id });
      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          `failed to create ledger transaction for deposit ${deposit.id}`,
        );
      }

      await tx.insert(ledgerEntries).values([
        {
          transactionId: transaction.id,
          walletAccountId: userWallet.id,
          side: 'credit',
          amountMinor: deposit.amountMinor,
          currency: deposit.currency,
        },
        {
          transactionId: transaction.id,
          walletAccountId: platformClearingWallet.id,
          side: 'debit',
          amountMinor: deposit.amountMinor,
          currency: deposit.currency,
        },
      ]);

      const updatedRows = await tx
        .update(fundingTransfers)
        .set({
          status: 'settled',
          settledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fundingTransfers.id, deposit.id))
        .returning();
      const settledDeposit = updatedRows[0];

      if (!settledDeposit) {
        throw new AppError(
          500,
          'deposit_settlement_failed',
          `failed to settle deposit ${deposit.id}`,
        );
      }

      return {
        deposit: mapDeposit({
          ...settledDeposit,
          fundingMethodRail: deposit.fundingMethodRail,
          fundingMethodDisplayName: deposit.fundingMethodDisplayName,
        }),
        alreadySettled: false,
      };
    });
  }
}
