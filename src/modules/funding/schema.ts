import { z } from 'zod';

export const fundingMethodBodySchema = z.object({
  rail: z.enum(['ach', 'fps', 'pix', 'wire', 'debit_card', 'crypto_wallet']),
  status: z.enum(['pending_verification', 'verified', 'disabled']),
  displayName: z.string().min(2).max(128),
  countryCode: z.string().length(2),
  provider: z.string().min(1).max(64).optional(),
  providerReference: z.string().min(1).max(255).optional(),
  last4: z.string().length(4).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const fundingMethodsQuerySchema = z.object({
  currency: z.enum(['USD', 'BRL']).default('USD'),
});

export const createDepositBodySchema = z.object({
  fundingMethodId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.enum(['USD', 'BRL']),
});

export const createWithdrawalBodySchema = z.object({
  fundingMethodId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.enum(['USD', 'BRL']),
});

export const listDepositsQuerySchema = z.object({
  currency: z.enum(['USD', 'BRL']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const listWithdrawalsQuerySchema = z.object({
  currency: z.enum(['USD', 'BRL']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const seedWalletBodySchema = z.object({
  amountMinor: z.number().int().positive(),
  currency: z.enum(['USD', 'BRL']),
  referenceId: z.string().min(1).max(255).optional(),
});

export const fundingUserParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const fundingDepositParamsSchema = z.object({
  depositId: z.string().uuid(),
});

export const fundingWithdrawalParamsSchema = z.object({
  withdrawalId: z.string().uuid(),
});

export const fundingWebhookProviderParamsSchema = z.object({
  provider: z.string().min(1).max(64),
});

export const fundingProviderWebhookBodySchema = z.object({
  eventId: z.string().min(1).max(255),
  eventType: z.literal('funding.transfer.updated'),
  occurredAt: z.string().datetime(),
  transferId: z.string().uuid(),
  status: z.enum(['pending', 'in_review', 'settled', 'failed']),
  providerTransferReference: z.string().min(1).max(255).optional(),
  failureReason: z.string().min(1).max(4000).optional(),
});

export const reconciliationSnapshotSchema = z.object({
  transferId: z.string().uuid(),
  expectedStatus: z.enum([
    'pending',
    'in_review',
    'settled',
    'failed',
    'cancelled',
    'reversed',
  ]),
});

export const reconciliationRunBodySchema = z.object({
  provider: z.string().min(1).max(64).optional(),
  snapshots: z.array(reconciliationSnapshotSchema).min(1).max(500),
});

export const callbackDelayScanBodySchema = z.object({
  provider: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const reconciliationDiscrepanciesQuerySchema = z.object({
  unresolvedOnly: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const walletBalanceQuerySchema = z.object({
  currency: z.enum(['USD', 'BRL']).default('USD'),
});
