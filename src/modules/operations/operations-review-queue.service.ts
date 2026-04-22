import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  accountRestrictions,
  complianceProfiles,
  fundingMethods,
  fundingReconciliationDiscrepancies,
  fundingReconciliationRuns,
  fundingTransfers,
  users,
} from '../../db/schema';
import { SettlementFailureAlertService } from './settlement-failure-alert.service';

export class OperationsReviewQueueService {
  private readonly settlementFailureAlertService =
    new SettlementFailureAlertService();

  /**
   * Return the active operational review queues for internal operators.
   *
   * Example:
   * `await operationsReviewQueueService.listActiveReviewQueue({ limit: 25 })`
   */
  async listActiveReviewQueue(input: { limit: number }) {
    const limit = Math.min(input.limit, 100);

    const [
      withdrawalRows,
      discrepancyRows,
      kycRows,
      flaggedAccountRows,
      settlementRetryRows,
    ] = await Promise.all([
      db
        .select({
          withdrawalId: fundingTransfers.id,
          userId: fundingTransfers.userId,
          amountMinor: fundingTransfers.amountMinor,
          currency: fundingTransfers.currency,
          requestedAt: fundingTransfers.requestedAt,
          metadata: fundingTransfers.metadata,
          fundingMethodId: fundingMethods.id,
          fundingMethodRail: fundingMethods.rail,
          fundingMethodDisplayName: fundingMethods.displayName,
          fundingMethodCountryCode: fundingMethods.countryCode,
          fundingMethodProvider: fundingMethods.provider,
          userEmail: users.email,
          userRegion: users.region,
          userKycStatus: users.kycStatus,
        })
        .from(fundingTransfers)
        .innerJoin(
          fundingMethods,
          eq(fundingMethods.id, fundingTransfers.fundingMethodId),
        )
        .innerJoin(users, eq(users.id, fundingTransfers.userId))
        .where(
          and(
            eq(fundingTransfers.type, 'withdrawal'),
            eq(fundingTransfers.status, 'in_review'),
          ),
        )
        .orderBy(desc(fundingTransfers.requestedAt))
        .limit(limit),
      db
        .select({
          discrepancyId: fundingReconciliationDiscrepancies.id,
          discrepancyType: fundingReconciliationDiscrepancies.discrepancyType,
          severity: fundingReconciliationDiscrepancies.severity,
          expectedStatus: fundingReconciliationDiscrepancies.expectedStatus,
          actualStatus: fundingReconciliationDiscrepancies.actualStatus,
          message: fundingReconciliationDiscrepancies.message,
          metadata: fundingReconciliationDiscrepancies.metadata,
          detectedAt: fundingReconciliationDiscrepancies.createdAt,
          transferId: fundingTransfers.id,
          transferType: fundingTransfers.type,
          transferStatus: fundingTransfers.status,
          transferAmountMinor: fundingTransfers.amountMinor,
          transferCurrency: fundingTransfers.currency,
          transferRequestedAt: fundingTransfers.requestedAt,
          fundingMethodId: fundingMethods.id,
          fundingMethodRail: fundingMethods.rail,
          fundingMethodDisplayName: fundingMethods.displayName,
          runId: fundingReconciliationRuns.id,
          runProvider: fundingReconciliationRuns.provider,
          runStatus: fundingReconciliationRuns.status,
          runCompletedAt: fundingReconciliationRuns.completedAt,
          userId: users.id,
          userEmail: users.email,
          userRegion: users.region,
          userKycStatus: users.kycStatus,
        })
        .from(fundingReconciliationDiscrepancies)
        .innerJoin(
          fundingReconciliationRuns,
          eq(
            fundingReconciliationRuns.id,
            fundingReconciliationDiscrepancies.runId,
          ),
        )
        .leftJoin(
          fundingTransfers,
          eq(
            fundingTransfers.id,
            fundingReconciliationDiscrepancies.transferId,
          ),
        )
        .leftJoin(
          fundingMethods,
          eq(fundingMethods.id, fundingTransfers.fundingMethodId),
        )
        .leftJoin(users, eq(users.id, fundingTransfers.userId))
        .where(isNull(fundingReconciliationDiscrepancies.resolvedAt))
        .orderBy(desc(fundingReconciliationDiscrepancies.createdAt))
        .limit(limit),
      db
        .select({
          userId: users.id,
          userEmail: users.email,
          userRegion: users.region,
          userKycStatus: users.kycStatus,
          countryCode: complianceProfiles.countryCode,
          jurisdictionCode: complianceProfiles.jurisdictionCode,
          legalEntity: complianceProfiles.legalEntity,
          sanctionsStatus: complianceProfiles.sanctionsStatus,
          kycProvider: complianceProfiles.kycProvider,
          providerReference: complianceProfiles.providerReference,
          metadata: complianceProfiles.metadata,
          updatedAt: complianceProfiles.updatedAt,
        })
        .from(complianceProfiles)
        .innerJoin(users, eq(users.id, complianceProfiles.userId))
        .orderBy(desc(complianceProfiles.updatedAt))
        .limit(limit),
      db
        .select({
          restrictionId: accountRestrictions.id,
          scope: accountRestrictions.scope,
          reason: accountRestrictions.reason,
          source: accountRestrictions.source,
          expiresAt: accountRestrictions.expiresAt,
          createdAt: accountRestrictions.createdAt,
          userId: users.id,
          userEmail: users.email,
          userRegion: users.region,
          userKycStatus: users.kycStatus,
        })
        .from(accountRestrictions)
        .innerJoin(users, eq(users.id, accountRestrictions.userId))
        .where(isNull(accountRestrictions.resolvedAt))
        .orderBy(desc(accountRestrictions.createdAt))
        .limit(limit),
      this.settlementFailureAlertService.listStalledSettlements({
        limit,
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      kycReviews: kycRows
        .filter(
          (row) =>
            row.userKycStatus !== 'approved' || row.sanctionsStatus !== 'clear',
        )
        .map((row) => ({
          user: {
            id: row.userId,
            email: row.userEmail,
            region: row.userRegion,
            kycStatus: row.userKycStatus,
          },
          profile: {
            countryCode: row.countryCode,
            jurisdictionCode: row.jurisdictionCode,
            legalEntity: row.legalEntity,
            sanctionsStatus: row.sanctionsStatus,
            kycProvider: row.kycProvider,
            providerReference: row.providerReference,
            metadata: this.asRecord(row.metadata),
            updatedAt: row.updatedAt.toISOString(),
          },
        })),
      flaggedAccounts: flaggedAccountRows.map((row) => ({
        restrictionId: row.restrictionId,
        scope: row.scope,
        reason: row.reason,
        source: row.source,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        user: {
          id: row.userId,
          email: row.userEmail,
          region: row.userRegion,
          kycStatus: row.userKycStatus,
        },
      })),
      withdrawalReviews: withdrawalRows.map((row) => {
        const metadata = this.asRecord(row.metadata);
        const reviewReason =
          typeof metadata.reviewReason === 'string'
            ? metadata.reviewReason
            : metadata.requiresReview === true
              ? 'manual_review_or_policy'
              : 'unspecified';
        const thresholdMinor =
          typeof metadata.reviewThresholdMinor === 'number'
            ? metadata.reviewThresholdMinor
            : null;

        return {
          withdrawalId: row.withdrawalId,
          amountMinor: row.amountMinor,
          currency: row.currency,
          requestedAt: row.requestedAt.toISOString(),
          user: {
            id: row.userId,
            email: row.userEmail,
            region: row.userRegion,
            kycStatus: row.userKycStatus,
          },
          fundingMethod: {
            id: row.fundingMethodId,
            rail: row.fundingMethodRail,
            displayName: row.fundingMethodDisplayName,
            countryCode: row.fundingMethodCountryCode,
            provider: row.fundingMethodProvider,
          },
          reviewContext: {
            reason: reviewReason,
            thresholdMinor,
            metadata,
          },
        };
      }),
      reconciliationInvestigations: discrepancyRows.map((row) => ({
        discrepancyId: row.discrepancyId,
        discrepancyType: row.discrepancyType,
        severity: row.severity,
        expectedStatus: row.expectedStatus,
        actualStatus: row.actualStatus,
        message: row.message,
        detectedAt: row.detectedAt.toISOString(),
        metadata: this.asRecord(row.metadata),
        run: {
          id: row.runId,
          provider: row.runProvider,
          status: row.runStatus,
          completedAt: row.runCompletedAt.toISOString(),
        },
        transfer:
          row.transferId &&
          row.transferType &&
          row.transferStatus &&
          row.transferRequestedAt
            ? {
                id: row.transferId,
                type: row.transferType,
                status: row.transferStatus,
                amountMinor: row.transferAmountMinor,
                currency: row.transferCurrency,
                requestedAt: row.transferRequestedAt.toISOString(),
                user:
                  row.userId && row.userEmail
                    ? {
                        id: row.userId,
                        email: row.userEmail,
                        region: row.userRegion,
                        kycStatus: row.userKycStatus,
                      }
                    : null,
                fundingMethod:
                  row.fundingMethodId &&
                  row.fundingMethodRail &&
                  row.fundingMethodDisplayName
                    ? {
                        id: row.fundingMethodId,
                        rail: row.fundingMethodRail,
                        displayName: row.fundingMethodDisplayName,
                      }
                    : null,
              }
            : null,
      })),
      settlementRetries: settlementRetryRows.map((row) => ({
        marketId: row.marketId,
        marketTitle: row.marketTitle,
        marketCurrency: row.marketCurrency,
        marketStatus: row.marketStatus,
        resolutionId: row.resolutionId,
        outcome: row.outcome,
        approvedAt: row.approvedAt,
        retryEligibleAt: row.retryEligibleAt,
        thresholdMinutes: row.thresholdMinutes,
      })),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
