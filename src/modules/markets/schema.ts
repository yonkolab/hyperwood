import { z } from 'zod';
import { marketCurrencyWithPrimaryDefaultSchema } from '../../config/currency';

const marketStatusSchema = z.enum([
  'draft',
  'scheduled',
  'active',
  'halted',
  'trading_closed',
  'awaiting_resolution',
  'settled',
  'cancelled',
  'disputed',
  'voided',
]);

export const createEventBodySchema = z.object({
  slug: z.string().min(3).max(128),
  title: z.string().min(3).max(160),
  summary: z.string().min(3).max(2000).optional(),
  category: z.string().min(2).max(64),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const eventParamsSchema = z.object({
  eventId: z.string().uuid(),
});

export const updateEventBodySchema = z
  .object({
    title: z.string().min(3).max(160).optional(),
    summary: z.string().max(2000).nullable().optional(),
    endsAt: z.union([z.string().datetime(), z.null()]).optional(),
  })
  .refine((body) => Object.keys(body).length > 0);

export const createMarketBodySchema = z.object({
  eventId: z.string().uuid(),
  slug: z.string().min(3).max(128),
  title: z.string().min(3).max(160),
  summary: z.string().min(3).max(2000).optional(),
  currency: marketCurrencyWithPrimaryDefaultSchema,
  status: marketStatusSchema,
  tags: z.array(z.string().min(1).max(64)).max(16).optional(),
  resolutionRules: z.string().min(3).max(4000),
  resolutionSources: z.array(z.string().url()).max(16).optional(),
  yesPriceBps: z.number().int().min(0).max(10000),
  noPriceBps: z.number().int().min(0).max(10000),
  volumeUsdMinor: z.number().int().nonnegative().optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
  resolvesAt: z.string().datetime().optional(),
});

export const updateMarketDetailsBodySchema = z
  .object({
    title: z.string().min(3).max(160).optional(),
    summary: z.string().max(2000).nullable().optional(),
    tags: z.array(z.string().min(1).max(64)).max(16).optional(),
    resolutionRules: z.string().min(3).max(4000).optional(),
    resolutionSources: z.array(z.string().url()).max(16).optional(),
    yesPriceBps: z.number().int().min(0).max(10000).optional(),
    noPriceBps: z.number().int().min(0).max(10000).optional(),
    closesAt: z.union([z.string().datetime(), z.null()]).optional(),
    resolvesAt: z.union([z.string().datetime(), z.null()]).optional(),
  })
  .refine((body) => Object.keys(body).length > 0);

export const listMarketsQuerySchema = z.object({
  category: z.string().min(2).max(64).optional(),
  status: marketStatusSchema.optional(),
  tag: z.string().min(1).max(64).optional(),
  search: z.string().min(1).max(160).optional(),
  sort: z.enum(['newest', 'closing_soon', 'highest_volume']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().max(10000).default(0),
});

export const marketParamsSchema = z.object({
  marketId: z.string().uuid(),
});

export const publishMarketAnnouncementBodySchema = z.object({
  title: z.string().min(3).max(160),
  message: z.string().min(3).max(4000),
  publishedBy: z.string().min(3).max(128).optional(),
});

export const updateMarketStatusBodySchema = z.object({
  status: marketStatusSchema,
  reason: z.string().min(3).max(4000),
  changedBy: z.string().min(3).max(128).optional(),
});

export const updateMarketClosingBodySchema = z.object({
  closesAt: z.union([z.string().datetime(), z.null()]),
  resolvesAt: z.union([z.string().datetime(), z.null()]).optional(),
  changedBy: z.string().min(3).max(128).optional(),
});

export const resolveMarketBodySchema = z.object({
  outcome: z.enum(['yes', 'no', 'void']),
  evidenceSummary: z.string().min(3).max(4000),
  evidenceSources: z.array(z.string().url()).max(16).optional(),
  approvedBy: z.string().min(3).max(128).optional(),
});

export const orderBookDeltasQuerySchema = z.object({
  afterSequence: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export const recentTradesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const historicalCandlesQuerySchema = z.object({
  interval: z.enum(['1h', '1d']).default('1h'),
  limit: z.coerce.number().int().positive().max(200).default(100),
});
