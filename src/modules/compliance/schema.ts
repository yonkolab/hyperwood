import { z } from 'zod';

export const complianceProfileBodySchema = z.object({
  countryCode: z.string().length(2),
  jurisdictionCode: z.string().min(2).max(32),
  legalEntity: z.string().min(2).max(64),
  kycStatus: z.enum(['pending', 'approved', 'rejected', 'restricted']),
  sanctionsStatus: z.enum(['clear', 'pending_review', 'restricted']),
  kycProvider: z.string().min(1).max(64).optional(),
  providerReference: z.string().min(1).max(255).optional(),
  ageVerified: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const restrictionBodySchema = z.object({
  scope: z.enum(['all', 'trading', 'funding', 'withdrawal']),
  reason: z.string().min(3),
  source: z.enum(['system', 'provider', 'admin']),
  expiresAt: z.string().datetime().optional(),
});

export const complianceUserParamsSchema = z.object({
  userId: z.string().uuid(),
});
