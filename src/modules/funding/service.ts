import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  fundingMethods,
  fundingTransfers,
  ledgerEntries,
  ledgerTransactions,
  marketCurrencyEnum,
  walletAccounts,
  users,
  type fundingRailEnum,
  type fundingMethodStatusEnum,
  type fundingTransferStatusEnum,
  type fundingTransferTypeEnum,
  type walletAccountTypeEnum,
} from "../../db/schema";
import { AppError } from "../../lib/errors";
import { ComplianceService } from "../compliance/service";
import {
  doesFundingRailSupportCurrency,
  getSupportedCurrenciesForFundingRail,
  isFundingRailAllowedForCountry,
} from "./policy";

type FundingRail = (typeof fundingRailEnum.enumValues)[number];
type FundingMethodStatus = (typeof fundingMethodStatusEnum.enumValues)[number];
type FundingTransferType = (typeof fundingTransferTypeEnum.enumValues)[number];
type FundingTransferStatus = (typeof fundingTransferStatusEnum.enumValues)[number];
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

export class FundingService {
  private readonly complianceService = new ComplianceService();

  async linkFundingMethod(input: LinkFundingMethodInput) {
    await this.assertUserExists(input.userId);
    const countryCode = input.countryCode.toUpperCase();

    if (!isFundingRailAllowedForCountry(input.rail, countryCode)) {
      throw new AppError(
        400,
        "funding_method_country_not_supported",
        "funding rail is not supported for the provided country",
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

  async listEligibleFundingMethods(userId: string, currency: MarketCurrency = "USD") {
    await this.assertUserExists(userId);

    const capabilityEvaluation = await this.complianceService.getCapabilityEvaluation(userId);

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
          eq(fundingMethods.status, "verified"),
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
          supportedCurrencies: getSupportedCurrenciesForFundingRail(method.rail),
        })),
    };
  }

  async getWalletBalance(userId: string, currency = "USD") {
    await this.assertUserExists(userId);

    const wallet = await this.getOrCreateWalletAccount({
      ownerUserId: userId,
      type: "user_cash",
      currency,
    });
    const reservedWallet = await this.getOrCreateWalletAccount({
      ownerUserId: userId,
      type: "user_order_reserved",
      currency,
    });
    const positionCollateralWallet = await this.getOrCreateWalletAccount({
      ownerUserId: userId,
      type: "user_position_collateral",
      currency,
    });

    const [
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
    ] = await Promise.all([
      this.getWalletAccountBalance(wallet.id),
      this.getWalletAccountBalance(reservedWallet.id),
      this.getWalletAccountBalance(positionCollateralWallet.id),
    ]);

    return {
      walletAccountId: wallet.id,
      reservedWalletAccountId: reservedWallet.id,
      positionCollateralWalletAccountId: positionCollateralWallet.id,
      currency,
      balanceMinor: availableBalanceMinor,
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
      totalBalanceMinor:
        availableBalanceMinor + reservedBalanceMinor + positionCollateralMinor,
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
      .innerJoin(fundingMethods, eq(fundingMethods.id, fundingTransfers.fundingMethodId))
      .where(
        and(
          eq(fundingTransfers.userId, userId),
          eq(fundingTransfers.type, "deposit"),
          input.currency ? eq(fundingTransfers.currency, input.currency) : undefined,
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
      throw new AppError(400, "invalid_amount", "amount must be a positive integer");
    }

    await this.assertUserExists(input.userId);

    const capabilityEvaluation = await this.complianceService.getCapabilityEvaluation(input.userId);

    if (!capabilityEvaluation.capabilities.funding.allowed) {
      throw new AppError(
        403,
        "funding_not_allowed",
        `funding not allowed: ${capabilityEvaluation.capabilities.funding.reasons.join(", ")}`,
      );
    }

    const fundingMethod = await this.getVerifiedFundingMethod(input.userId, input.fundingMethodId);

    if (!doesFundingRailSupportCurrency(fundingMethod.rail, input.currency)) {
      throw new AppError(
        409,
        "funding_method_currency_not_supported",
        "funding method rail does not support the requested currency",
      );
    }

    const insertedRows = await db
      .insert(fundingTransfers)
      .values({
        userId: input.userId,
        fundingMethodId: fundingMethod.id,
        type: "deposit",
        status: "pending",
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
      throw new AppError(500, "deposit_creation_failed", "failed to create deposit");
    }

    return {
      deposit: this.mapDeposit({
        ...deposit,
        fundingMethodRail: fundingMethod.rail,
        fundingMethodDisplayName: fundingMethod.displayName,
      }),
    };
  }

  async seedWalletBalance(input: SeedWalletBalanceInput) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new AppError(400, "invalid_amount", "amount must be a positive integer");
    }

    await this.assertUserExists(input.userId);

    const currency = input.currency.toUpperCase();
    const userWallet = await this.getOrCreateWalletAccount({
      ownerUserId: input.userId,
      type: "user_cash",
      currency,
    });
    const platformClearingWallet = await this.getOrCreateWalletAccount({
      ownerUserId: null,
      type: "platform_clearing",
      currency,
    });

    await db.transaction(async (tx) => {
      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: "wallet_seed",
          referenceId: input.referenceId,
        })
        .returning({
          id: ledgerTransactions.id,
        });

      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(500, "ledger_transaction_failed", "failed to create ledger transaction");
      }

      await tx.insert(ledgerEntries).values([
        {
          transactionId: transaction.id,
          walletAccountId: userWallet.id,
          side: "credit",
          amountMinor: input.amountMinor,
          currency,
        },
        {
          transactionId: transaction.id,
          walletAccountId: platformClearingWallet.id,
          side: "debit",
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
        .innerJoin(fundingMethods, eq(fundingMethods.id, fundingTransfers.fundingMethodId))
        .where(eq(fundingTransfers.id, depositId))
        .limit(1);

      const deposit = depositRows[0];

      if (!deposit || deposit.type !== "deposit") {
        throw new AppError(404, "deposit_not_found", "deposit was not found");
      }

      if (deposit.status === "settled") {
        return {
          deposit: this.mapDeposit(deposit),
          alreadySettled: true,
        };
      }

      if (deposit.status !== "pending") {
        throw new AppError(
          409,
          "deposit_not_settleable",
          "deposit is not in a settleable state",
        );
      }

      const userWallet = await this.getOrCreateWalletAccount({
        ownerUserId: deposit.userId,
        type: "user_cash",
        currency: deposit.currency,
      });
      const platformClearingWallet = await this.getOrCreateWalletAccount({
        ownerUserId: null,
        type: "platform_clearing",
        currency: deposit.currency,
      });

      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: "deposit_settlement",
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
          "ledger_transaction_failed",
          "failed to create ledger transaction",
        );
      }

      await tx.insert(ledgerEntries).values([
        {
          transactionId: transaction.id,
          walletAccountId: userWallet.id,
          side: "credit",
          amountMinor: deposit.amountMinor,
          currency: deposit.currency,
        },
        {
          transactionId: transaction.id,
          walletAccountId: platformClearingWallet.id,
          side: "debit",
          amountMinor: deposit.amountMinor,
          currency: deposit.currency,
        },
      ]);

      const updatedRows = await tx
        .update(fundingTransfers)
        .set({
          status: "settled",
          settledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fundingTransfers.id, deposit.id))
        .returning();

      const settledDeposit = updatedRows[0];

      if (!settledDeposit) {
        throw new AppError(500, "deposit_settlement_failed", "failed to settle deposit");
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

  private async assertUserExists(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, "user_not_found", "user was not found");
    }
  }

  private async getVerifiedFundingMethod(userId: string, fundingMethodId: string) {
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
        "funding_method_not_found",
        "funding method was not found",
      );
    }

    if (fundingMethod.status !== "verified") {
      throw new AppError(
        409,
        "funding_method_not_verified",
        "funding method must be verified before use",
      );
    }

    if (!isFundingRailAllowedForCountry(fundingMethod.rail, fundingMethod.countryCode)) {
      throw new AppError(
        409,
        "funding_method_region_not_supported",
        "funding method is not allowed for its registered country",
      );
    }

    return fundingMethod;
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
        throw new AppError(500, "wallet_account_creation_failed", "failed to create wallet account");
      }

      return inserted;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
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
}
