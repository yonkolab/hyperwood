import type { MarketCurrency } from '../../config/currency';
import type { db } from '../../db/client';
import type {
  fundingDiscrepancySeverityEnum,
  fundingDiscrepancyTypeEnum,
  fundingMethodStatusEnum,
  fundingRailEnum,
  fundingReconciliationRunStatusEnum,
  fundingTransferStatusEnum,
  fundingTransferTypeEnum,
  walletAccountTypeEnum,
} from '../../db/schema';

export type FundingRail = (typeof fundingRailEnum.enumValues)[number];
export type FundingMethodStatus =
  (typeof fundingMethodStatusEnum.enumValues)[number];
export type FundingTransferType =
  (typeof fundingTransferTypeEnum.enumValues)[number];
export type FundingTransferStatus =
  (typeof fundingTransferStatusEnum.enumValues)[number];
export type FundingReconciliationRunStatus =
  (typeof fundingReconciliationRunStatusEnum.enumValues)[number];
export type FundingDiscrepancyType =
  (typeof fundingDiscrepancyTypeEnum.enumValues)[number];
export type FundingDiscrepancySeverity =
  (typeof fundingDiscrepancySeverityEnum.enumValues)[number];
export type WalletAccountType =
  (typeof walletAccountTypeEnum.enumValues)[number];
export type { MarketCurrency };
export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LinkFundingMethodInput = {
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

export type SeedWalletBalanceInput = {
  userId: string;
  amountMinor: number;
  currency: string;
  referenceId?: string;
};

export type CreateDepositInput = {
  userId: string;
  fundingMethodId: string;
  amountMinor: number;
  currency: MarketCurrency;
};

export type CreateWithdrawalInput = {
  userId: string;
  fundingMethodId: string;
  amountMinor: number;
  currency: MarketCurrency;
};

export type ProcessProviderFundingWebhookInput = {
  provider: string;
  eventId: string;
  eventType: 'funding.transfer.updated';
  occurredAt: Date;
  transferId: string;
  status: Extract<
    FundingTransferStatus,
    'pending' | 'in_review' | 'settled' | 'failed'
  >;
  providerTransferReference?: string;
  failureReason?: string;
  payload: Record<string, unknown>;
};

export type ReconciliationSnapshotInput = {
  transferId: string;
  expectedStatus: FundingTransferStatus;
};

export type ReconciliationDiscrepancyRecord = {
  transferId: string;
  discrepancyType: FundingDiscrepancyType;
  severity: FundingDiscrepancySeverity;
  expectedStatus: FundingTransferStatus;
  actualStatus: FundingTransferStatus | null;
  message: string;
  metadata: Record<string, unknown>;
};
