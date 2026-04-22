import { z } from 'zod';

export const listReviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const listAuditEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  targetType: z.string().min(1).max(64).optional(),
  targetId: z.string().min(1).max(255).optional(),
  action: z.string().min(1).max(128).optional(),
});

export const listRateLimitEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  bucket: z.string().min(1).max(64).optional(),
  scopeType: z.string().min(1).max(32).optional(),
  scopeKey: z.string().min(1).max(255).optional(),
  path: z.string().min(1).max(255).optional(),
});

export const listAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  category: z.string().min(1).max(64).optional(),
  severity: z.enum(['warning', 'critical']).optional(),
  status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
  sourceType: z.string().min(1).max(64).optional(),
});

export const ledgerInvariantScanBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const settlementFailureScanBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const tradingConditionScanBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
});
