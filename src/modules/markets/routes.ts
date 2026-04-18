import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { MarketsService } from "./service";

const createEventBodySchema = z.object({
  slug: z.string().min(3).max(128),
  title: z.string().min(3).max(160),
  summary: z.string().min(3).max(2000).optional(),
  category: z.string().min(2).max(64),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const createMarketBodySchema = z.object({
  eventId: z.string().uuid(),
  slug: z.string().min(3).max(128),
  title: z.string().min(3).max(160),
  summary: z.string().min(3).max(2000).optional(),
  status: z.enum([
    "draft",
    "scheduled",
    "active",
    "halted",
    "trading_closed",
    "awaiting_resolution",
    "settled",
    "cancelled",
    "disputed",
    "voided",
  ]),
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

const listMarketsQuerySchema = z.object({
  category: z.string().min(2).max(64).optional(),
  status: z
    .enum([
      "draft",
      "scheduled",
      "active",
      "halted",
      "trading_closed",
      "awaiting_resolution",
      "settled",
      "cancelled",
      "disputed",
      "voided",
    ])
    .optional(),
  tag: z.string().min(1).max(64).optional(),
  search: z.string().min(1).max(160).optional(),
  sort: z.enum(["newest", "closing_soon", "highest_volume"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

const marketParamsSchema = z.object({
  marketId: z.string().uuid(),
});

function assertBootstrapToken(request: FastifyRequest) {
  const bootstrapToken = request.headers["x-bootstrap-token"];

  if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
    throw new AppError(401, "invalid_bootstrap_token", "invalid bootstrap token");
  }
}

async function marketRoutes(app: FastifyInstance, _options: FastifyPluginOptions) {
  const marketsService = new MarketsService();

  app.get("/markets", async (request) => {
    const query = listMarketsQuerySchema.parse(request.query);

    return marketsService.listMarkets({
      limit: query.limit,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.sort ? { sort: query.sort } : {}),
    });
  });

  app.get("/markets/:marketId", async (request) => {
    const params = marketParamsSchema.parse(request.params);

    return marketsService.getMarketDetail(params.marketId);
  });

  app.post("/internal/markets/events", async (request, reply) => {
    assertBootstrapToken(request);
    const body = createEventBodySchema.parse(request.body);
    const result = await marketsService.createEvent({
      slug: body.slug,
      title: body.title,
      category: body.category,
      ...(body.summary ? { summary: body.summary } : {}),
      ...(body.startsAt ? { startsAt: new Date(body.startsAt) } : {}),
      ...(body.endsAt ? { endsAt: new Date(body.endsAt) } : {}),
    });

    reply.status(201).send(result);
  });

  app.post("/internal/markets", async (request, reply) => {
    assertBootstrapToken(request);
    const body = createMarketBodySchema.parse(request.body);
    const result = await marketsService.createMarket({
      eventId: body.eventId,
      slug: body.slug,
      title: body.title,
      status: body.status,
      resolutionRules: body.resolutionRules,
      yesPriceBps: body.yesPriceBps,
      noPriceBps: body.noPriceBps,
      ...(body.summary ? { summary: body.summary } : {}),
      ...(body.tags ? { tags: body.tags } : {}),
      ...(body.resolutionSources ? { resolutionSources: body.resolutionSources } : {}),
      ...(body.volumeUsdMinor !== undefined ? { volumeUsdMinor: body.volumeUsdMinor } : {}),
      ...(body.opensAt ? { opensAt: new Date(body.opensAt) } : {}),
      ...(body.closesAt ? { closesAt: new Date(body.closesAt) } : {}),
      ...(body.resolvesAt ? { resolvesAt: new Date(body.resolvesAt) } : {}),
    });

    reply.status(201).send(result);
  });
}

export async function registerMarketRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await marketRoutes(app, options);
}
