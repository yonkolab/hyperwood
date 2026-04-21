import type {
  fundingRailEnum,
  kycStatusEnum,
  restrictionSourceEnum,
  sanctionsStatusEnum,
} from '../../db/schema';

export type KycStatus = (typeof kycStatusEnum.enumValues)[number];
export type SanctionsStatus = (typeof sanctionsStatusEnum.enumValues)[number];
export type RestrictionSource =
  (typeof restrictionSourceEnum.enumValues)[number];
export type CapabilityName = 'trading' | 'funding' | 'withdrawal';
export type FundingRail = (typeof fundingRailEnum.enumValues)[number];

export type UpsertComplianceProfileInput = {
  userId: string;
  countryCode: string;
  jurisdictionCode: string;
  legalEntity: string;
  kycStatus: KycStatus;
  sanctionsStatus: SanctionsStatus;
  kycProvider?: string;
  providerReference?: string;
  ageVerified: boolean;
  metadata?: Record<string, unknown>;
};

export type ApplyAccountRestrictionInput = {
  userId: string;
  scope: 'all' | CapabilityName;
  reason: string;
  source: RestrictionSource;
  expiresAt?: Date;
};

export type CapabilityEvaluation = {
  allowed: boolean;
  reasons: string[];
};
