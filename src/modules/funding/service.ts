import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  fundingMethods,
  ledgerEntries,
  ledgerTransactions,
  walletAccounts,
  users,
  type fundingRailEnum,
  type fundingMethodStatusEnum,
  type walletAccountTypeEnum,
} from "../../db/schema";
import { AppError } from "../../lib/errors";
import { ComplianceService } from "../compliance/service";

type FundingRail = (typeof fundingRailEnum.enumValues)[number];
type FundingMethodStatus = (typeof fundingMethodStatusEnum.enumValues)[number];
type WalletAccountType = (typeof walletAccountTypeEnum.enumValues)[number];

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

export class FundingService {
  private readonly complianceService = new ComplianceService();

  async linkFundingMethod(input: LinkFundingMethodInput) {
    await this.assertUserExists(input.userId);

    const insertedRows = await db
      .insert(fundingMethods)
      .values({
        userId: input.userId,
        rail: input.rail,
        status: input.status,
        displayName: input.displayName,
        countryCode: input.countryCode.toUpperCase(),
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

  async listEligibleFundingMethods(userId: string) {
    await this.assertUserExists(userId);

    const capabilityEvaluation = await this.complianceService.getCapabilityEvaluation(userId);

    if (!capabilityEvaluation.capabilities.funding.allowed) {
      return {
        fundingAllowed: false,
        fundingReasons: capabilityEvaluation.capabilities.funding.reasons,
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
      fundingMethods: methods.filter((method) => allowedRails.has(method.rail)),
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

    const [availableBalanceMinor, reservedBalanceMinor] = await Promise.all([
      this.getWalletAccountBalance(wallet.id),
      this.getWalletAccountBalance(reservedWallet.id),
    ]);

    return {
      walletAccountId: wallet.id,
      reservedWalletAccountId: reservedWallet.id,
      currency,
      balanceMinor: availableBalanceMinor,
      availableBalanceMinor,
      reservedBalanceMinor,
      totalBalanceMinor: availableBalanceMinor + reservedBalanceMinor,
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
}
