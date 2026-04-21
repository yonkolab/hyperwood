import type {
  FundingDiscrepancySeverity,
  FundingDiscrepancyType,
  FundingRail,
  FundingReconciliationRunStatus,
  FundingTransferStatus,
  FundingTransferType,
} from './types';

type FundingTransferRow = {
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
};

type FundingReconciliationRunRow = {
  id: string;
  scope: 'funding_transfers';
  provider: string | null;
  status: FundingReconciliationRunStatus;
  comparedRecordsCount: number;
  discrepancyCount: number;
  startedAt: Date;
  completedAt: Date;
};

type ProviderWebhookEventRow = {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  transferId: string | null;
  status: 'applied';
  payload: Record<string, unknown>;
  processedAt: Date;
  createdAt: Date;
};

type FundingReconciliationDiscrepancyRow = {
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
};

export function mapDeposit(row: FundingTransferRow) {
  return mapTransfer(row);
}

export function mapTransfer(row: FundingTransferRow) {
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

export function mapReconciliationRun(row: FundingReconciliationRunRow) {
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

export function mapProviderWebhookEvent(row: ProviderWebhookEventRow) {
  return {
    id: row.id,
    provider: row.provider,
    eventId: row.eventId,
    eventType: row.eventType,
    transferId: row.transferId,
    status: row.status,
    payload: row.payload,
    processedAt: row.processedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapReconciliationDiscrepancy(
  row: FundingReconciliationDiscrepancyRow,
) {
  return {
    id: row.id,
    transferId: row.transferId,
    discrepancyType: row.discrepancyType,
    severity: row.severity,
    expectedStatus: row.expectedStatus,
    actualStatus: row.actualStatus,
    message: row.message,
    metadata: asRecord(row.metadata),
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

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
