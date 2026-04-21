import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  fundingMethods,
  fundingReconciliationDiscrepancies,
  fundingReconciliationRuns,
  fundingTransfers,
  ledgerTransactions,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { OperationsAlertService } from '../operations/alerts';
import {
  mapReconciliationDiscrepancy,
  mapReconciliationRun,
} from './funding-record-mapper';
import type { FundingWalletLedgerService } from './funding-wallet-ledger.service';
import type {
  FundingReconciliationRunStatus,
  FundingTransferStatus,
  ReconciliationSnapshotInput,
} from './types';

type FundingReconciliationDiscrepancyCandidate = {
  transferId: string;
  discrepancyType:
    | 'status_mismatch'
    | 'missing_internal_transfer'
    | 'ledger_invariant_violation';
  severity: 'critical' | 'warning';
  expectedStatus: FundingTransferStatus;
  actualStatus: FundingTransferStatus | null;
  message: string;
  metadata: Record<string, unknown>;
};

export class FundingReconciliationService {
  constructor(
    private readonly walletLedgerService: FundingWalletLedgerService,
    private readonly operationsAlertService: OperationsAlertService,
  ) {}

  /**
   * Compare external transfer snapshots with internal funding transfer state.
   *
   * Example:
   * `await fundingReconciliationService.runTransferReconciliation({ provider: 'pix', snapshots })`
   */
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
    const referenceTypes =
      this.walletLedgerService.getLedgerReferenceTypesForTransfers(transfers);
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

    const discrepancies =
      transferIds.flatMap<FundingReconciliationDiscrepancyCandidate>(
        (transferId) => {
          const expectedStatus = snapshotMap.get(transferId);
          const transfer = transferMap.get(transferId);

          if (!expectedStatus) {
            return [];
          }

          if (!transfer) {
            return [
              {
                transferId,
                discrepancyType: 'missing_internal_transfer',
                severity: 'critical',
                expectedStatus,
                actualStatus: null,
                message:
                  'transfer was missing from internal records during reconciliation',
                metadata: {},
              },
            ];
          }

          const statusMismatch =
            transfer.status !== expectedStatus
              ? [
                  {
                    transferId: transfer.id,
                    discrepancyType: 'status_mismatch' as const,
                    severity: 'critical' as const,
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

          const ledgerInvariantMismatch = this.walletLedgerService
            .getRequiredLedgerReferenceTypesForTransfer(transfer)
            .map((referenceType) => ({
              transferId: transfer.id,
              discrepancyType: 'ledger_invariant_violation' as const,
              severity: 'critical' as const,
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
        },
      );

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

      const criticalDiscrepancies = persistedDiscrepancies.filter(
        (row) => row.severity === 'critical',
      );

      for (const discrepancy of criticalDiscrepancies) {
        await this.operationsAlertService.createAlert(
          {
            category: 'funding_reconciliation',
            severity: 'critical',
            sourceType: 'reconciliation_discrepancy',
            sourceId: discrepancy.id,
            message: discrepancy.message,
            metadata: {
              discrepancyType: discrepancy.discrepancyType,
              expectedStatus: discrepancy.expectedStatus,
              actualStatus: discrepancy.actualStatus,
              runId: run.id,
              provider: run.provider,
              transferId: discrepancy.transferId,
            },
          },
          tx,
        );
      }

      return {
        run: mapReconciliationRun(run),
        discrepancies: persistedDiscrepancies.map((row) =>
          mapReconciliationDiscrepancy(row),
        ),
      };
    });
  }

  /**
   * List persisted reconciliation discrepancies.
   *
   * Example:
   * `await fundingReconciliationService.listReconciliationDiscrepancies({ unresolvedOnly: true, limit: 50 })`
   */
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
      discrepancies: rows.map((row) => mapReconciliationDiscrepancy(row)),
    };
  }
}
