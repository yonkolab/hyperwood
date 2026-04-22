import { z } from 'zod';

export const fillsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  currency: z.enum(['USD', 'BRL']).default('USD'),
});

export const settlementsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  currency: z.enum(['USD', 'BRL']).default('USD'),
});

export const portfolioQuerySchema = z.object({
  currency: z.enum(['USD', 'BRL']).default('USD'),
});

export const portfolioStreamQuerySchema = z.object({
  currency: z.enum(['USD', 'BRL']).default('USD'),
});

export const exportJobsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  currency: z.enum(['USD', 'BRL']).default('USD'),
});

export const createExportBodySchema = z.object({
  currency: z.enum(['USD', 'BRL']).default('USD'),
});

export const exportJobParamsSchema = z.object({
  exportJobId: z.string().uuid(),
});
