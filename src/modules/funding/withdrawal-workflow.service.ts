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
import type { AdminAuditService } from '../operations/audit';
import { mapTransfer } from './funding-record-mapper';
import {
  type FundingWalletLedgerService,
  WITHDRAWAL_REVIEW_THRESHOLD_MINOR,
} from './funding-wallet-ledger.service';
import type {
  CreateWithdrawalInput,
  DbExecutor,
  MarketCurrency,
} from './types';

type WithdrawalServiceDependencies = {
  walletLedgerService: FundingWalletLedgerService;
  complianceService: ComplianceService;
  adminAuditService: AdminAuditService;
};

type WithdrawalRow = {
  id: string;
  userId: string;
  fundingMethodId: string;
  type: 'withdrawal';
  status: 'pending' | 'in_review' | 'settled' | 'failed';
  amountMinor: number;
  currency: string;
  requestedAt: Date;
  settledAt: Date | null;
  failedAt: Date | null;
  providerTransferReference: string | null;
  failureReason: string | null;
  fundingMethodRail: typeof fundingMethods.$inferSelect.rail;
  fundingMethodDisplayName: string;
};

export class WithdrawalWorkflowService {
  constructor(
    private readonly walletLedgerService: FundingWalletLedgerService,
    private readonly complianceService: ComplianceService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  /**
   * Return withdrawal history for one user, optionally filtered by currency.
   *
   * Example:
   * `await withdrawalWorkflowService.listWithdrawals(userId, { limit: 20 })`
   */
  async listWithdrawals(
    userId: string,
    input: {
      currency?: MarketCurrency;
      limit: number;
    },
  ) {
    return listWithdrawals(
      { walletLedgerService: this.walletLedgerService },
      userId,
      input,
    );
  }

  /**
   * Create a withdrawal and reserve available user cash into the hold wallet.
   *
   * Example:
   * `await withdrawalWorkflowService.createWithdrawal(input)`
   */
  async createWithdrawal(input: CreateWithdrawalInput) {
    return createWithdrawal(
      {
        walletLedgerService: this.walletLedgerService,
        complianceService: this.complianceService,
      },
      input,
    );
  }

  /**
   * Approve a withdrawal that is waiting for review.
   *
   * Example:
   * `await withdrawalWorkflowService.approveWithdrawalReview(withdrawalId)`
   */
  async approveWithdrawalReview(
    withdrawalId: string,
    input?: { actor?: string },
  ) {
    return approveWithdrawalReview(
      { adminAuditService: this.adminAuditService },
      withdrawalId,
      input,
    );
  }

  /**
   * Mark a withdrawal as failed and release the held funds back to cash.
   *
   * Example:
   * `await withdrawalWorkflowService.failWithdrawal(withdrawalId, 'provider_rejected')`
   */
  async failWithdrawal(
    withdrawalId: string,
    failureReason: string,
    input?: { actor?: string },
  ) {
    return failWithdrawal(
      {
        walletLedgerService: this.walletLedgerService,
        adminAuditService: this.adminAuditService,
      },
      withdrawalId,
      failureReason,
      input,
    );
  }

  /**
   * Finalize a pending withdrawal and debit the user's hold wallet.
   *
   * Example:
   * `await withdrawalWorkflowService.settleWithdrawal(withdrawalId)`
   */
  async settleWithdrawal(withdrawalId: string, input?: { actor?: string }) {
    return settleWithdrawal(
      {
        walletLedgerService: this.walletLedgerService,
        adminAuditService: this.adminAuditService,
      },
      withdrawalId,
      input,
    );
  }
}

async function listWithdrawals(
  dependencies: Pick<WithdrawalServiceDependencies, 'walletLedgerService'>,
  userId: string,
  input: {
    currency?: MarketCurrency;
    limit: number;
  },
) {
  await dependencies.walletLedgerService.assertUserExists(userId);

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
        eq(fundingTransfers.type, 'withdrawal'),
        input.currency
          ? eq(fundingTransfers.currency, input.currency)
          : undefined,
      ),
    )
    .orderBy(sql`${fundingTransfers.requestedAt} desc`)
    .limit(Math.min(input.limit, 100));

  return {
    withdrawals: rows.map((row) => mapTransfer(row)),
  };
}

async function createWithdrawal(
  dependencies: Pick<
    WithdrawalServiceDependencies,
    'walletLedgerService' | 'complianceService'
  >,
  input: CreateWithdrawalInput,
) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new AppError(
      400,
      'invalid_amount',
      `amount must be a positive integer, received ${String(input.amountMinor)}`,
    );
  }

  await dependencies.walletLedgerService.assertUserExists(input.userId);

  const capabilityEvaluation =
    await dependencies.complianceService.getCapabilityEvaluation(input.userId);

  if (!capabilityEvaluation.capabilities.withdrawal.allowed) {
    throw new AppError(
      403,
      'withdrawal_not_allowed',
      `withdrawal not allowed: ${capabilityEvaluation.capabilities.withdrawal.reasons.join(', ')}`,
    );
  }

  const fundingMethod =
    await dependencies.walletLedgerService.getVerifiedFundingMethod(
      input.userId,
      input.fundingMethodId,
    );
  dependencies.walletLedgerService.ensureFundingRailSupportsCurrency(
    fundingMethod.rail,
    input.currency,
  );

  return db.transaction(async (tx) => {
    const cashWallet =
      await dependencies.walletLedgerService.getOrCreateWalletAccount(
        {
          ownerUserId: input.userId,
          type: 'user_cash',
          currency: input.currency,
        },
        tx,
      );
    const withdrawalHoldWallet =
      await dependencies.walletLedgerService.getOrCreateWalletAccount(
        {
          ownerUserId: input.userId,
          type: 'user_withdrawal_hold',
          currency: input.currency,
        },
        tx,
      );
    const availableBalanceMinor =
      await dependencies.walletLedgerService.getWalletAccountBalance(
        cashWallet.id,
        tx,
      );

    if (availableBalanceMinor < input.amountMinor) {
      throw new AppError(
        409,
        'insufficient_available_balance',
        `insufficient available balance for withdrawal amount ${String(input.amountMinor)}`,
      );
    }

    const initialStatus =
      dependencies.walletLedgerService.requiresWithdrawalReview(
        input.amountMinor,
      )
        ? 'in_review'
        : 'pending';

    const insertedRows = await tx
      .insert(fundingTransfers)
      .values({
        userId: input.userId,
        fundingMethodId: fundingMethod.id,
        type: 'withdrawal',
        status: initialStatus,
        amountMinor: input.amountMinor,
        currency: input.currency,
        metadata: {
          rail: fundingMethod.rail,
          fundingMethodDisplayName: fundingMethod.displayName,
          requiresReview: initialStatus === 'in_review',
          reviewReason:
            initialStatus === 'in_review' ? 'amount_threshold' : null,
          reviewThresholdMinor:
            initialStatus === 'in_review'
              ? WITHDRAWAL_REVIEW_THRESHOLD_MINOR
              : null,
        },
        updatedAt: new Date(),
      })
      .returning();
    const withdrawal = insertedRows[0];

    if (!withdrawal) {
      throw new AppError(
        500,
        'withdrawal_creation_failed',
        'failed to create withdrawal',
      );
    }

    const transactionRows = await tx
      .insert(ledgerTransactions)
      .values({
        referenceType: 'withdrawal_hold',
        referenceId: withdrawal.id,
        metadata: {
          fundingMethodId: fundingMethod.id,
          rail: fundingMethod.rail,
        },
      })
      .returning({ id: ledgerTransactions.id });
    const transaction = transactionRows[0];

    if (!transaction) {
      throw new AppError(
        500,
        'ledger_transaction_failed',
        `failed to create withdrawal hold ledger transaction for ${withdrawal.id}`,
      );
    }

    await tx.insert(ledgerEntries).values([
      {
        transactionId: transaction.id,
        walletAccountId: cashWallet.id,
        side: 'debit',
        amountMinor: input.amountMinor,
        currency: input.currency,
      },
      {
        transactionId: transaction.id,
        walletAccountId: withdrawalHoldWallet.id,
        side: 'credit',
        amountMinor: input.amountMinor,
        currency: input.currency,
      },
    ]);

    return {
      withdrawal: mapTransfer({
        ...withdrawal,
        fundingMethodRail: fundingMethod.rail,
        fundingMethodDisplayName: fundingMethod.displayName,
      }),
    };
  });
}

async function approveWithdrawalReview(
  dependencies: Pick<WithdrawalServiceDependencies, 'adminAuditService'>,
  withdrawalId: string,
  input?: { actor?: string },
) {
  const withdrawal = await loadWithdrawal(withdrawalId);

  if (withdrawal.status === 'pending') {
    return {
      withdrawal: mapTransfer(withdrawal),
      alreadyApproved: true,
    };
  }

  if (withdrawal.status !== 'in_review') {
    throw new AppError(
      409,
      'withdrawal_not_reviewable',
      `withdrawal ${withdrawalId} is not awaiting review approval: ${withdrawal.status}`,
    );
  }

  const updatedRows = await db
    .update(fundingTransfers)
    .set({
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(fundingTransfers.id, withdrawal.id))
    .returning();
  const approvedWithdrawal = updatedRows[0];

  if (!approvedWithdrawal) {
    throw new AppError(
      500,
      'withdrawal_approval_failed',
      `failed to approve withdrawal ${withdrawalId}`,
    );
  }

  await dependencies.adminAuditService.recordEvent({
    action: 'funding.withdrawal_review_approved',
    actor: input?.actor ?? 'bootstrap',
    targetType: 'withdrawal',
    targetId: approvedWithdrawal.id,
    payload: {
      userId: approvedWithdrawal.userId,
      amountMinor: approvedWithdrawal.amountMinor,
      currency: approvedWithdrawal.currency,
    },
  });

  return {
    withdrawal: mapTransfer({
      ...approvedWithdrawal,
      fundingMethodRail: withdrawal.fundingMethodRail,
      fundingMethodDisplayName: withdrawal.fundingMethodDisplayName,
    }),
    alreadyApproved: false,
  };
}

async function failWithdrawal(
  dependencies: Pick<
    WithdrawalServiceDependencies,
    'walletLedgerService' | 'adminAuditService'
  >,
  withdrawalId: string,
  failureReason: string,
  input?: { actor?: string },
) {
  return db.transaction(async (tx) => {
    const withdrawal = await loadWithdrawal(withdrawalId, tx);

    if (withdrawal.status === 'failed') {
      return {
        withdrawal: mapTransfer(withdrawal),
        alreadyFailed: true,
      };
    }

    if (withdrawal.status === 'settled') {
      throw new AppError(
        409,
        'withdrawal_not_failurable',
        `settled withdrawal ${withdrawalId} cannot be failed`,
      );
    }

    const cashWallet =
      await dependencies.walletLedgerService.getOrCreateWalletAccount(
        {
          ownerUserId: withdrawal.userId,
          type: 'user_cash',
          currency: withdrawal.currency,
        },
        tx,
      );
    const withdrawalHoldWallet =
      await dependencies.walletLedgerService.getOrCreateWalletAccount(
        {
          ownerUserId: withdrawal.userId,
          type: 'user_withdrawal_hold',
          currency: withdrawal.currency,
        },
        tx,
      );

    const transactionRows = await tx
      .insert(ledgerTransactions)
      .values({
        referenceType: 'withdrawal_release',
        referenceId: withdrawal.id,
        metadata: {
          fundingMethodId: withdrawal.fundingMethodId,
          rail: withdrawal.fundingMethodRail,
          failureReason,
        },
      })
      .returning({ id: ledgerTransactions.id });
    const transaction = transactionRows[0];

    if (!transaction) {
      throw new AppError(
        500,
        'ledger_transaction_failed',
        `failed to create withdrawal release transaction for ${withdrawal.id}`,
      );
    }

    await tx.insert(ledgerEntries).values([
      {
        transactionId: transaction.id,
        walletAccountId: withdrawalHoldWallet.id,
        side: 'debit',
        amountMinor: withdrawal.amountMinor,
        currency: withdrawal.currency,
      },
      {
        transactionId: transaction.id,
        walletAccountId: cashWallet.id,
        side: 'credit',
        amountMinor: withdrawal.amountMinor,
        currency: withdrawal.currency,
      },
    ]);

    const updatedRows = await tx
      .update(fundingTransfers)
      .set({
        status: 'failed',
        failureReason,
        failedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fundingTransfers.id, withdrawal.id))
      .returning();
    const failedWithdrawal = updatedRows[0];

    if (!failedWithdrawal) {
      throw new AppError(
        500,
        'withdrawal_failure_failed',
        `failed to update withdrawal ${withdrawal.id} as failed`,
      );
    }

    await dependencies.adminAuditService.recordEvent(
      {
        action: 'funding.withdrawal_failed',
        actor: input?.actor ?? 'bootstrap',
        targetType: 'withdrawal',
        targetId: failedWithdrawal.id,
        payload: {
          userId: failedWithdrawal.userId,
          amountMinor: failedWithdrawal.amountMinor,
          currency: failedWithdrawal.currency,
          failureReason,
        },
      },
      tx,
    );

    return {
      withdrawal: mapTransfer({
        ...failedWithdrawal,
        fundingMethodRail: withdrawal.fundingMethodRail,
        fundingMethodDisplayName: withdrawal.fundingMethodDisplayName,
      }),
      alreadyFailed: false,
    };
  });
}

async function settleWithdrawal(
  dependencies: Pick<
    WithdrawalServiceDependencies,
    'walletLedgerService' | 'adminAuditService'
  >,
  withdrawalId: string,
  input?: { actor?: string },
) {
  return db.transaction(async (tx) => {
    const withdrawal = await loadWithdrawal(withdrawalId, tx);

    if (withdrawal.status === 'settled') {
      return {
        withdrawal: mapTransfer(withdrawal),
        alreadySettled: true,
      };
    }

    if (withdrawal.status !== 'pending') {
      throw new AppError(
        409,
        'withdrawal_not_settleable',
        `withdrawal ${withdrawalId} is not in a settleable state: ${withdrawal.status}`,
      );
    }

    const withdrawalHoldWallet =
      await dependencies.walletLedgerService.getOrCreateWalletAccount(
        {
          ownerUserId: withdrawal.userId,
          type: 'user_withdrawal_hold',
          currency: withdrawal.currency,
        },
        tx,
      );
    const platformClearingWallet =
      await dependencies.walletLedgerService.getOrCreateWalletAccount(
        {
          ownerUserId: null,
          type: 'platform_clearing',
          currency: withdrawal.currency,
        },
        tx,
      );

    const transactionRows = await tx
      .insert(ledgerTransactions)
      .values({
        referenceType: 'withdrawal_settlement',
        referenceId: withdrawal.id,
        metadata: {
          fundingMethodId: withdrawal.fundingMethodId,
          rail: withdrawal.fundingMethodRail,
        },
      })
      .returning({ id: ledgerTransactions.id });
    const transaction = transactionRows[0];

    if (!transaction) {
      throw new AppError(
        500,
        'ledger_transaction_failed',
        `failed to create withdrawal settlement transaction for ${withdrawal.id}`,
      );
    }

    await tx.insert(ledgerEntries).values([
      {
        transactionId: transaction.id,
        walletAccountId: withdrawalHoldWallet.id,
        side: 'debit',
        amountMinor: withdrawal.amountMinor,
        currency: withdrawal.currency,
      },
      {
        transactionId: transaction.id,
        walletAccountId: platformClearingWallet.id,
        side: 'credit',
        amountMinor: withdrawal.amountMinor,
        currency: withdrawal.currency,
      },
    ]);

    const updatedRows = await tx
      .update(fundingTransfers)
      .set({
        status: 'settled',
        settledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fundingTransfers.id, withdrawal.id))
      .returning();
    const settledWithdrawal = updatedRows[0];

    if (!settledWithdrawal) {
      throw new AppError(
        500,
        'withdrawal_settlement_failed',
        `failed to settle withdrawal ${withdrawal.id}`,
      );
    }

    await dependencies.adminAuditService.recordEvent(
      {
        action: 'funding.withdrawal_settled',
        actor: input?.actor ?? 'bootstrap',
        targetType: 'withdrawal',
        targetId: settledWithdrawal.id,
        payload: {
          userId: settledWithdrawal.userId,
          amountMinor: settledWithdrawal.amountMinor,
          currency: settledWithdrawal.currency,
        },
      },
      tx,
    );

    return {
      withdrawal: mapTransfer({
        ...settledWithdrawal,
        fundingMethodRail: withdrawal.fundingMethodRail,
        fundingMethodDisplayName: withdrawal.fundingMethodDisplayName,
      }),
      alreadySettled: false,
    };
  });
}

async function loadWithdrawal(withdrawalId: string, executor: DbExecutor = db) {
  const rows = await executor
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
    .where(eq(fundingTransfers.id, withdrawalId))
    .limit(1);
  const withdrawal = rows[0];

  if (!withdrawal || withdrawal.type !== 'withdrawal') {
    throw new AppError(
      404,
      'withdrawal_not_found',
      `withdrawal was not found for id ${withdrawalId}`,
    );
  }

  return withdrawal as WithdrawalRow;
}
