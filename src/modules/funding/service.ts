import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  type fundingDiscrepancySeverityEnum,
  type fundingDiscrepancyTypeEnum,
  type fundingMethodStatusEnum,
  fundingMethods,
  type fundingRailEnum,
  fundingReconciliationDiscrepancies,
  type fundingReconciliationRunStatusEnum,
  fundingReconciliationRuns,
  type fundingTransferStatusEnum,
  fundingTransfers,
  type fundingTransferTypeEnum,
  ledgerEntries,
  ledgerTransactions,
  type marketCurrencyEnum,
  users,
  walletAccounts,
  type walletAccountTypeEnum,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import { ComplianceService } from '../compliance/service';
import { AdminAuditService } from '../operations/audit';
import {
  doesFundingRailSupportCurrency,
  getSupportedCurrenciesForFundingRail,
  isFundingRailAllowedForCountry,
} from './policy';

type FundingRail = (typeof fundingRailEnum.enumValues)[number];
type FundingMethodStatus = (typeof fundingMethodStatusEnum.enumValues)[number];
type FundingTransferType = (typeof fundingTransferTypeEnum.enumValues)[number];
type FundingTransferStatus =
  (typeof fundingTransferStatusEnum.enumValues)[number];
type FundingReconciliationRunStatus =
  (typeof fundingReconciliationRunStatusEnum.enumValues)[number];
type FundingDiscrepancyType =
  (typeof fundingDiscrepancyTypeEnum.enumValues)[number];
type FundingDiscrepancySeverity =
  (typeof fundingDiscrepancySeverityEnum.enumValues)[number];
type WalletAccountType = (typeof walletAccountTypeEnum.enumValues)[number];
type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];

type LinkFundingMethodInput = {
  userId: string;
  rail: FundingRail;
  status: FundingMethodStatus;
  displayName: string;
  countryCode: string;
  provider?: string;
  providerReference?: string;
  last4?: string;
  metadata?: Record<string, unknown>;
};

type SeedWalletBalanceInput = {
  userId: string;
  amountMinor: number;
  currency: string;
  referenceId?: string;
};

type CreateDepositInput = {
  userId: string;
  fundingMethodId: string;
  amountMinor: number;
  currency: MarketCurrency;
};

type CreateWithdrawalInput = {
  userId: string;
  fundingMethodId: string;
  amountMinor: number;
  currency: MarketCurrency;
};

type ReconciliationSnapshotInput = {
  transferId: string;
  expectedStatus: FundingTransferStatus;
};

type ReconciliationDiscrepancyRecord = {
  transferId: string;
  discrepancyType: FundingDiscrepancyType;
  severity: FundingDiscrepancySeverity;
  expectedStatus: FundingTransferStatus;
  actualStatus: FundingTransferStatus | null;
  message: string;
  metadata: Record<string, unknown>;
};

const WITHDRAWAL_REVIEW_THRESHOLD_MINOR = 250_000;

export class FundingService {
  private readonly complianceService = new ComplianceService();
  private readonly adminAuditService = new AdminAuditService();

  async linkFundingMethod(input: LinkFundingMethodInput) {
    await this.assertUserExists(input.userId);
    const countryCode = input.countryCode.toUpperCase();

    if (!isFundingRailAllowedForCountry(input.rail, countryCode)) {
      throw new AppError(
        400,
        'funding_method_country_not_supported',
        'funding rail is not supported for the provided country',
      );
    }

    const insertedRows = await db
      .insert(fundingMethods)
      .values({
        userId: input.userId,
        rail: input.rail,
        status: input.status,
        displayName: input.displayName,
        countryCode,
        provider: input.provider,
        providerReference: input.providerReference,
        last4: input.last4,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      })
      .returning();

    return {
      fundingMethod: insertedRows[0],
    };
  }

  async listEligibleFundingMethods(
    userId: string,
    currency: MarketCurrency = 'USD',
  ) {
    await this.assertUserExists(userId);

    const capabilityEvaluation =
      await this.complianceService.getCapabilityEvaluation(userId);

    if (!capabilityEvaluation.capabilities.funding.allowed) {
      return {
        fundingAllowed: false,
        fundingReasons: capabilityEvaluation.capabilities.funding.reasons,
        requestedCurrency: currency,
        fundingMethods: [],
      };
    }

    const methods = await db
      .select({
        id: fundingMethods.id,
        rail: fundingMethods.rail,
        status: fundingMethods.status,
        displayName: fundingMethods.displayName,
        last4: fundingMethods.last4,
        countryCode: fundingMethods.countryCode,
        provider: fundingMethods.provider,
        providerReference: fundingMethods.providerReference,
        createdAt: fundingMethods.createdAt,
      })
      .from(fundingMethods)
      .where(
        and(
          eq(fundingMethods.userId, userId),
          eq(fundingMethods.status, 'verified'),
        ),
      );

    const allowedRails = new Set(capabilityEvaluation.fundingMethods);

    return {
      fundingAllowed: true,
      fundingReasons: [],
      requestedCurrency: currency,
      fundingMethods: methods
        .filter(
          (method) =>
            allowedRails.has(method.rail) &&
            isFundingRailAllowedForCountry(method.rail, method.countryCode) &&
            doesFundingRailSupportCurrency(method.rail, currency),
        )
        .map((method) => ({
          ...method,
          supportedCurrencies: getSupportedCurrenciesForFundingRail(
            method.rail,
          ),
        })),
    };
  }

  async getWalletBalance(userId: string, currency = 'USD') {
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

  async listDeposits(
    userId: string,
    input: {
      currency?: MarketCurrency;
      limit: number;
    },
  ) {
    await this.assertUserExists(userId);

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
      deposits: rows.map((row) => this.mapDeposit(row)),
    };
  }

  async createDeposit(input: CreateDepositInput) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new AppError(
        400,
        'invalid_amount',
        'amount must be a positive integer',
      );
    }

    await this.assertUserExists(input.userId);

    const capabilityEvaluation =
      await this.complianceService.getCapabilityEvaluation(input.userId);

    if (!capabilityEvaluation.capabilities.funding.allowed) {
      throw new AppError(
        403,
        'funding_not_allowed',
        `funding not allowed: ${capabilityEvaluation.capabilities.funding.reasons.join(', ')}`,
      );
    }

    const fundingMethod = await this.getVerifiedFundingMethod(
      input.userId,
      input.fundingMethodId,
    );

    if (!doesFundingRailSupportCurrency(fundingMethod.rail, input.currency)) {
      throw new AppError(
        409,
        'funding_method_currency_not_supported',
        'funding method rail does not support the requested currency',
      );
    }

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
      deposit: this.mapDeposit({
        ...deposit,
        fundingMethodRail: fundingMethod.rail,
        fundingMethodDisplayName: fundingMethod.displayName,
      }),
    };
  }

  async listWithdrawals(
    userId: string,
    input: {
      currency?: MarketCurrency;
      limit: number;
    },
  ) {
    await this.assertUserExists(userId);

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
      withdrawals: rows.map((row) => this.mapTransfer(row)),
    };
  }

  async createWithdrawal(input: CreateWithdrawalInput) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new AppError(
        400,
        'invalid_amount',
        'amount must be a positive integer',
      );
    }

    await this.assertUserExists(input.userId);

    const capabilityEvaluation =
      await this.complianceService.getCapabilityEvaluation(input.userId);

    if (!capabilityEvaluation.capabilities.withdrawal.allowed) {
      throw new AppError(
        403,
        'withdrawal_not_allowed',
        `withdrawal not allowed: ${capabilityEvaluation.capabilities.withdrawal.reasons.join(', ')}`,
      );
    }

    const fundingMethod = await this.getVerifiedFundingMethod(
      input.userId,
      input.fundingMethodId,
    );

    if (!doesFundingRailSupportCurrency(fundingMethod.rail, input.currency)) {
      throw new AppError(
        409,
        'funding_method_currency_not_supported',
        'funding method rail does not support the requested currency',
      );
    }

    return db.transaction(async (tx) => {
      const cashWallet = await this.getOrCreateWalletAccount({
        ownerUserId: input.userId,
        type: 'user_cash',
        currency: input.currency,
      });
      const withdrawalHoldWallet = await this.getOrCreateWalletAccount({
        ownerUserId: input.userId,
        type: 'user_withdrawal_hold',
        currency: input.currency,
      });

      const availableBalanceMinor = await this.getWalletAccountBalance(
        cashWallet.id,
      );

      if (availableBalanceMinor < input.amountMinor) {
        throw new AppError(
          409,
          'insufficient_available_balance',
          'insufficient available balance for withdrawal',
        );
      }

      const initialStatus = this.requiresWithdrawalReview(input.amountMinor)
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
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          'failed to create ledger transaction',
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
        withdrawal: this.mapTransfer({
          ...withdrawal,
          fundingMethodRail: fundingMethod.rail,
          fundingMethodDisplayName: fundingMethod.displayName,
        }),
      };
    });
  }

  async seedWalletBalance(input: SeedWalletBalanceInput) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new AppError(
        400,
        'invalid_amount',
        'amount must be a positive integer',
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
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          'failed to create ledger transaction',
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

    return this.getWalletBalance(input.userId, currency);
  }

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
        throw new AppError(404, 'deposit_not_found', 'deposit was not found');
      }

      if (deposit.status === 'settled') {
        return {
          deposit: this.mapDeposit(deposit),
          alreadySettled: true,
        };
      }

      if (deposit.status !== 'pending') {
        throw new AppError(
          409,
          'deposit_not_settleable',
          'deposit is not in a settleable state',
        );
      }

      const userWallet = await this.getOrCreateWalletAccount({
        ownerUserId: deposit.userId,
        type: 'user_cash',
        currency: deposit.currency,
      });
      const platformClearingWallet = await this.getOrCreateWalletAccount({
        ownerUserId: null,
        type: 'platform_clearing',
        currency: deposit.currency,
      });

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
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          'failed to create ledger transaction',
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
          'failed to settle deposit',
        );
      }

      return {
        deposit: this.mapDeposit({
          ...settledDeposit,
          fundingMethodRail: deposit.fundingMethodRail,
          fundingMethodDisplayName: deposit.fundingMethodDisplayName,
        }),
        alreadySettled: false,
      };
    });
  }

  async approveWithdrawalReview(withdrawalId: string) {
    const rows = await db
      .select({
        id: fundingTransfers.id,
        status: fundingTransfers.status,
        type: fundingTransfers.type,
        amountMinor: fundingTransfers.amountMinor,
        currency: fundingTransfers.currency,
        fundingMethodId: fundingTransfers.fundingMethodId,
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
        'withdrawal was not found',
      );
    }

    if (withdrawal.status === 'pending') {
      return {
        withdrawal: this.mapTransfer(withdrawal),
        alreadyApproved: true,
      };
    }

    if (withdrawal.status !== 'in_review') {
      throw new AppError(
        409,
        'withdrawal_not_reviewable',
        'withdrawal is not awaiting review approval',
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
        'failed to approve withdrawal',
      );
    }

    await this.adminAuditService.recordEvent({
      action: 'funding.withdrawal_review_approved',
      actor: 'bootstrap',
      targetType: 'withdrawal',
      targetId: approvedWithdrawal.id,
      payload: {
        userId: approvedWithdrawal.userId,
        amountMinor: approvedWithdrawal.amountMinor,
        currency: approvedWithdrawal.currency,
      },
    });

    return {
      withdrawal: this.mapTransfer({
        ...approvedWithdrawal,
        fundingMethodRail: withdrawal.fundingMethodRail,
        fundingMethodDisplayName: withdrawal.fundingMethodDisplayName,
      }),
      alreadyApproved: false,
    };
  }

  async failWithdrawal(withdrawalId: string, failureReason: string) {
    return db.transaction(async (tx) => {
      const rows = await tx
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
          'withdrawal was not found',
        );
      }

      if (withdrawal.status === 'failed') {
        return {
          withdrawal: this.mapTransfer(withdrawal),
          alreadyFailed: true,
        };
      }

      if (withdrawal.status === 'settled') {
        throw new AppError(
          409,
          'withdrawal_not_failurable',
          'settled withdrawal cannot be failed',
        );
      }

      const cashWallet = await this.getOrCreateWalletAccount({
        ownerUserId: withdrawal.userId,
        type: 'user_cash',
        currency: withdrawal.currency,
      });
      const withdrawalHoldWallet = await this.getOrCreateWalletAccount({
        ownerUserId: withdrawal.userId,
        type: 'user_withdrawal_hold',
        currency: withdrawal.currency,
      });

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
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          'failed to create ledger transaction',
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
          'failed to update withdrawal',
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'funding.withdrawal_failed',
          actor: 'bootstrap',
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
        withdrawal: this.mapTransfer({
          ...failedWithdrawal,
          fundingMethodRail: withdrawal.fundingMethodRail,
          fundingMethodDisplayName: withdrawal.fundingMethodDisplayName,
        }),
        alreadyFailed: false,
      };
    });
  }

  async settleWithdrawal(withdrawalId: string) {
    return db.transaction(async (tx) => {
      const rows = await tx
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
          'withdrawal was not found',
        );
      }

      if (withdrawal.status === 'settled') {
        return {
          withdrawal: this.mapTransfer(withdrawal),
          alreadySettled: true,
        };
      }

      if (withdrawal.status !== 'pending') {
        throw new AppError(
          409,
          'withdrawal_not_settleable',
          'withdrawal is not in a settleable state',
        );
      }

      const withdrawalHoldWallet = await this.getOrCreateWalletAccount({
        ownerUserId: withdrawal.userId,
        type: 'user_withdrawal_hold',
        currency: withdrawal.currency,
      });
      const platformClearingWallet = await this.getOrCreateWalletAccount({
        ownerUserId: null,
        type: 'platform_clearing',
        currency: withdrawal.currency,
      });

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
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          'failed to create ledger transaction',
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
          'failed to settle withdrawal',
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'funding.withdrawal_settled',
          actor: 'bootstrap',
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
        withdrawal: this.mapTransfer({
          ...settledWithdrawal,
          fundingMethodRail: withdrawal.fundingMethodRail,
          fundingMethodDisplayName: withdrawal.fundingMethodDisplayName,
        }),
        alreadySettled: false,
      };
    });
  }

  async runTransferReconciliation(input: {
    provider?: string;
    snapshots: ReconciliationSnapshotInput[];
  }) {
    const transferIds = Array.from(
      new Set(input.snapshots.map((snapshot) => snapshot.transferId)),
    );
    const snapshotMap = new Map(
      input.snapshots.map((snapshot) => [
        snapshot.transferId,
        snapshot.expectedStatus,
      ]),
    );

    const transfers = transferIds.length
      ? await db
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
            providerTransferReference:
              fundingTransfers.providerTransferReference,
            failureReason: fundingTransfers.failureReason,
          })
          .from(fundingTransfers)
          .innerJoin(
            fundingMethods,
            eq(fundingMethods.id, fundingTransfers.fundingMethodId),
          )
          .where(inArray(fundingTransfers.id, transferIds))
      : [];

    const transferMap = new Map(
      transfers.map((transfer) => [transfer.id, transfer]),
    );
    const referenceTypes = this.getLedgerReferenceTypesForTransfers(transfers);
    const ledgerRows =
      transferIds.length > 0 && referenceTypes.length > 0
        ? await db
            .select({
              referenceId: ledgerTransactions.referenceId,
              referenceType: ledgerTransactions.referenceType,
            })
            .from(ledgerTransactions)
            .where(
              and(
                inArray(ledgerTransactions.referenceId, transferIds),
                inArray(ledgerTransactions.referenceType, referenceTypes),
              ),
            )
        : [];

    const ledgerReferenceSet = new Set(
      ledgerRows.map((row) => `${row.referenceId}:${row.referenceType}`),
    );

    const discrepancies: ReconciliationDiscrepancyRecord[] =
      transferIds.flatMap((transferId) => {
        const expectedStatus = snapshotMap.get(transferId);
        const transfer = transferMap.get(transferId);

        if (!expectedStatus) {
          return [];
        }

        if (!transfer) {
          return [
            {
              transferId,
              discrepancyType:
                'missing_internal_transfer' as FundingDiscrepancyType,
              severity: 'critical' as FundingDiscrepancySeverity,
              expectedStatus,
              actualStatus: null,
              message:
                'transfer was missing from internal records during reconciliation',
              metadata: {},
            },
          ];
        }

        const statusMismatch: ReconciliationDiscrepancyRecord[] =
          transfer.status !== expectedStatus
            ? [
                {
                  transferId: transfer.id,
                  discrepancyType: 'status_mismatch' as FundingDiscrepancyType,
                  severity: 'critical' as FundingDiscrepancySeverity,
                  expectedStatus,
                  actualStatus: transfer.status,
                  message:
                    'authoritative transfer status did not match the internal status',
                  metadata: {
                    transferType: transfer.type,
                  },
                },
              ]
            : [];

        const ledgerInvariantMismatch: ReconciliationDiscrepancyRecord[] =
          this.getRequiredLedgerReferenceTypesForTransfer(transfer)
            .map((referenceType) => ({
              transferId: transfer.id,
              discrepancyType:
                'ledger_invariant_violation' as FundingDiscrepancyType,
              severity: 'critical' as FundingDiscrepancySeverity,
              expectedStatus: transfer.status,
              actualStatus: transfer.status,
              message: `missing expected ledger transaction for ${referenceType}`,
              metadata: {
                transferType: transfer.type,
                requiredReferenceType: referenceType,
              },
            }))
            .filter(
              (discrepancy) =>
                !ledgerReferenceSet.has(
                  `${discrepancy.transferId}:${String(discrepancy.metadata.requiredReferenceType)}`,
                ),
            );

        return [...statusMismatch, ...ledgerInvariantMismatch];
      });

    const runStatus: FundingReconciliationRunStatus =
      discrepancies.length > 0 ? 'completed_with_discrepancies' : 'completed';

    return db.transaction(async (tx) => {
      const runRows = await tx
        .insert(fundingReconciliationRuns)
        .values({
          scope: 'funding_transfers',
          provider: input.provider,
          status: runStatus,
          comparedRecordsCount: transferIds.length,
          discrepancyCount: discrepancies.length,
          metadata: {
            snapshotCount: input.snapshots.length,
          },
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .returning();

      const run = runRows[0];

      if (!run) {
        throw new AppError(
          500,
          'reconciliation_run_creation_failed',
          'failed to create reconciliation run',
        );
      }

      if (discrepancies.length > 0) {
        await tx.insert(fundingReconciliationDiscrepancies).values(
          discrepancies.map((discrepancy) => ({
            runId: run.id,
            transferId: transferMap.get(discrepancy.transferId)?.id ?? null,
            discrepancyType: discrepancy.discrepancyType,
            severity: discrepancy.severity,
            expectedStatus: discrepancy.expectedStatus,
            actualStatus: discrepancy.actualStatus,
            message: discrepancy.message,
            metadata: discrepancy.metadata,
          })),
        );
      }

      const persistedDiscrepancies = discrepancies.length
        ? await tx
            .select({
              id: fundingReconciliationDiscrepancies.id,
              transferId: fundingReconciliationDiscrepancies.transferId,
              discrepancyType:
                fundingReconciliationDiscrepancies.discrepancyType,
              severity: fundingReconciliationDiscrepancies.severity,
              expectedStatus: fundingReconciliationDiscrepancies.expectedStatus,
              actualStatus: fundingReconciliationDiscrepancies.actualStatus,
              message: fundingReconciliationDiscrepancies.message,
              metadata: fundingReconciliationDiscrepancies.metadata,
              createdAt: fundingReconciliationDiscrepancies.createdAt,
              resolvedAt: fundingReconciliationDiscrepancies.resolvedAt,
              runId: fundingReconciliationRuns.id,
              runScope: fundingReconciliationRuns.scope,
              runProvider: fundingReconciliationRuns.provider,
              runStatus: fundingReconciliationRuns.status,
              runCompletedAt: fundingReconciliationRuns.completedAt,
            })
            .from(fundingReconciliationDiscrepancies)
            .innerJoin(
              fundingReconciliationRuns,
              eq(
                fundingReconciliationRuns.id,
                fundingReconciliationDiscrepancies.runId,
              ),
            )
            .where(eq(fundingReconciliationDiscrepancies.runId, run.id))
            .orderBy(desc(fundingReconciliationDiscrepancies.createdAt))
        : [];

      return {
        run: this.mapReconciliationRun(run),
        discrepancies: persistedDiscrepancies.map((row) =>
          this.mapReconciliationDiscrepancy(row),
        ),
      };
    });
  }

  async listReconciliationDiscrepancies(input: {
    unresolvedOnly: boolean;
    limit: number;
  }) {
    const rows = await db
      .select({
        id: fundingReconciliationDiscrepancies.id,
        transferId: fundingReconciliationDiscrepancies.transferId,
        discrepancyType: fundingReconciliationDiscrepancies.discrepancyType,
        severity: fundingReconciliationDiscrepancies.severity,
        expectedStatus: fundingReconciliationDiscrepancies.expectedStatus,
        actualStatus: fundingReconciliationDiscrepancies.actualStatus,
        message: fundingReconciliationDiscrepancies.message,
        metadata: fundingReconciliationDiscrepancies.metadata,
        createdAt: fundingReconciliationDiscrepancies.createdAt,
        resolvedAt: fundingReconciliationDiscrepancies.resolvedAt,
        runId: fundingReconciliationRuns.id,
        runScope: fundingReconciliationRuns.scope,
        runProvider: fundingReconciliationRuns.provider,
        runStatus: fundingReconciliationRuns.status,
        runCompletedAt: fundingReconciliationRuns.completedAt,
      })
      .from(fundingReconciliationDiscrepancies)
      .innerJoin(
        fundingReconciliationRuns,
        eq(
          fundingReconciliationRuns.id,
          fundingReconciliationDiscrepancies.runId,
        ),
      )
      .where(
        input.unresolvedOnly
          ? isNull(fundingReconciliationDiscrepancies.resolvedAt)
          : undefined,
      )
      .orderBy(desc(fundingReconciliationDiscrepancies.createdAt))
      .limit(Math.min(input.limit, 200));

    return {
      discrepancies: rows.map((row) => this.mapReconciliationDiscrepancy(row)),
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

  private async getVerifiedFundingMethod(
    userId: string,
    fundingMethodId: string,
  ) {
    const rows = await db
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
        'funding method was not found',
      );
    }

    if (fundingMethod.status !== 'verified') {
      throw new AppError(
        409,
        'funding_method_not_verified',
        'funding method must be verified before use',
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
        'funding method is not allowed for its registered country',
      );
    }

    return fundingMethod;
  }

  private requiresWithdrawalReview(amountMinor: number) {
    return amountMinor >= WITHDRAWAL_REVIEW_THRESHOLD_MINOR;
  }

  private getLedgerReferenceTypesForTransfers(
    transfers: Array<{
      id: string;
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

  private getRequiredLedgerReferenceTypesForTransfer(transfer: {
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

  private async getWalletAccountBalance(walletAccountId: string) {
    const balanceRows = await db
      .select({
        balanceMinor: sql<string>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletAccountId, walletAccountId));

    return Number(balanceRows[0]?.balanceMinor ?? 0);
  }

  private async getOrCreateWalletAccount(input: {
    ownerUserId: string | null;
    type: WalletAccountType;
    currency: string;
  }) {
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

    const existingRows = await db
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
      const insertedRows = await db
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
          'failed to create wallet account',
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
        const retryRows = await db
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

  private mapDeposit(row: {
    id: string;
    type: FundingTransferType;
    status: FundingTransferStatus;
    amountMinor: number;
    currency: string;
    fundingMethodId: string;
    fundingMethodRail: FundingRail;
    fundingMethodDisplayName: string;
    requestedAt: Date;
    settledAt: Date | null;
    failedAt: Date | null;
    providerTransferReference: string | null;
    failureReason: string | null;
  }) {
    return this.mapTransfer(row);
  }

  private mapTransfer(row: {
    id: string;
    type: FundingTransferType;
    status: FundingTransferStatus;
    amountMinor: number;
    currency: string;
    fundingMethodId: string;
    fundingMethodRail: FundingRail;
    fundingMethodDisplayName: string;
    requestedAt: Date;
    settledAt: Date | null;
    failedAt: Date | null;
    providerTransferReference: string | null;
    failureReason: string | null;
  }) {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      amountMinor: row.amountMinor,
      currency: row.currency,
      fundingMethod: {
        id: row.fundingMethodId,
        rail: row.fundingMethodRail,
        displayName: row.fundingMethodDisplayName,
      },
      requestedAt: row.requestedAt.toISOString(),
      settledAt: row.settledAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      providerTransferReference: row.providerTransferReference,
      failureReason: row.failureReason,
    };
  }

  private mapReconciliationRun(row: {
    id: string;
    scope: 'funding_transfers';
    provider: string | null;
    status: FundingReconciliationRunStatus;
    comparedRecordsCount: number;
    discrepancyCount: number;
    startedAt: Date;
    completedAt: Date;
  }) {
    return {
      id: row.id,
      scope: row.scope,
      provider: row.provider,
      status: row.status,
      comparedRecordsCount: row.comparedRecordsCount,
      discrepancyCount: row.discrepancyCount,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt.toISOString(),
    };
  }

  private mapReconciliationDiscrepancy(row: {
    id: string;
    transferId: string | null;
    discrepancyType: FundingDiscrepancyType;
    severity: FundingDiscrepancySeverity;
    expectedStatus: FundingTransferStatus | null;
    actualStatus: FundingTransferStatus | null;
    message: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
    resolvedAt: Date | null;
    runId: string;
    runScope: 'funding_transfers';
    runProvider: string | null;
    runStatus: FundingReconciliationRunStatus;
    runCompletedAt: Date;
  }) {
    return {
      id: row.id,
      transferId: row.transferId,
      discrepancyType: row.discrepancyType,
      severity: row.severity,
      expectedStatus: row.expectedStatus,
      actualStatus: row.actualStatus,
      message: row.message,
      metadata: this.asRecord(row.metadata),
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      run: {
        id: row.runId,
        scope: row.runScope,
        provider: row.runProvider,
        status: row.runStatus,
        completedAt: row.runCompletedAt.toISOString(),
      },
    };
  }

  private asRecord(value: unknown) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
