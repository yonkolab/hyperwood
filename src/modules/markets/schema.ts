import { z } from 'zod';

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

export const createMarketBodySchema = z.object({
  eventId: z.string().uuid(),
  slug: z.string().min(3).max(128),
  title: z.string().min(3).max(160),
  summary: z.string().min(3).max(2000).optional(),
  currency: z.enum(['USD', 'BRL']).default('USD'),
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

export const listMarketsQuerySchema = z.object({
  category: z.string().min(2).max(64).optional(),
  status: marketStatusSchema.optional(),
  tag: z.string().min(1).max(64).optional(),
  search: z.string().min(1).max(160).optional(),
  sort: z.enum(['newest', 'closing_soon', 'highest_volume']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
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
