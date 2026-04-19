import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  fundingMethods,
  fundingReconciliationDiscrepancies,
  fundingReconciliationRuns,
  fundingTransfers,
  users,
} from '../../db/schema';
import { OperationsAlertService } from './alerts';
import { AdminAuditService } from './audit';
import { RateLimitEventService } from './rate-limit';

export class OperationsService {
  private readonly operationsAlertService = new OperationsAlertService();
  private readonly adminAuditService = new AdminAuditService();
  private readonly rateLimitEventService = new RateLimitEventService();

  async listActiveReviewQueue(input: { limit: number }) {
    const limit = Math.min(input.limit, 100);

    const [withdrawalRows, discrepancyRows] = await Promise.all([
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
    ]);

    return {
      generatedAt: new Date().toISOString(),
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
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  async listAuditEvents(input: {
    limit: number;
    targetType?: string;
    targetId?: string;
    action?: string;
  }) {
    const limit = Math.min(input.limit, 100);

    return {
      generatedAt: new Date().toISOString(),
      events: await this.adminAuditService.listEvents({
        limit,
        ...(input.targetType ? { targetType: input.targetType } : {}),
        ...(input.targetId ? { targetId: input.targetId } : {}),
        ...(input.action ? { action: input.action } : {}),
      }),
    };
  }

  async listRateLimitEvents(input: {
    bucket?: string;
    limit: number;
    path?: string;
    scopeKey?: string;
    scopeType?: string;
  }) {
    const limit = Math.min(input.limit, 100);

    return {
      generatedAt: new Date().toISOString(),
      events: await this.rateLimitEventService.listEvents({
        limit,
        ...(input.bucket ? { bucket: input.bucket } : {}),
        ...(input.scopeType ? { scopeType: input.scopeType } : {}),
        ...(input.scopeKey ? { scopeKey: input.scopeKey } : {}),
        ...(input.path ? { path: input.path } : {}),
      }),
    };
  }

  async listAlerts(input: {
    limit: number;
    category?: string;
    severity?: 'warning' | 'critical';
    sourceType?: string;
    status?: 'open' | 'acknowledged' | 'resolved';
  }) {
    const limit = Math.min(input.limit, 100);

    return {
      generatedAt: new Date().toISOString(),
      alerts: await this.operationsAlertService.listAlerts({
        limit,
        ...(input.category ? { category: input.category } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      }),
    };
  }
}
