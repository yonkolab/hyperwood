import { z } from 'zod';
import { marketCurrencyWithPrimaryDefaultSchema } from '../../config/currency';

export const fillsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const historicalOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const historicalFillsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const settlementsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const portfolioQuerySchema = z.object({
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const portfolioStreamQuerySchema = z.object({
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const exportJobsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const createExportBodySchema = z.object({
  currency: marketCurrencyWithPrimaryDefaultSchema,
});

export const exportJobParamsSchema = z.object({
  exportJobId: z.string().uuid(),
});
