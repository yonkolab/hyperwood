import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { logWorkflowEvent } from '../../lib/observability';
import { MatchingService } from '../matching/service';
import {
  createEventBodySchema,
  createMarketBodySchema,
  listMarketsQuerySchema,
  marketParamsSchema,
  orderBookDeltasQuerySchema,
  publishMarketAnnouncementBodySchema,
  recentTradesQuerySchema,
  resolveMarketBodySchema,
  updateMarketStatusBodySchema,
} from './schema';
import { MarketsService } from './service';

function assertBootstrapToken(request: FastifyRequest) {
  const bootstrapToken = request.headers['x-bootstrap-token'];

  if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
    throw new AppError(
      401,
      'invalid_bootstrap_token',
      'invalid bootstrap token',
    );
  }
}

async function marketRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const marketsService = new MarketsService();
  const matchingService = new MatchingService();

  app.get('/markets', async (request) => {
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

  app.get('/markets/:marketId', async (request) => {
    const params = marketParamsSchema.parse(request.params);

    return marketsService.getMarketDetail(params.marketId);
  });

  app.get('/markets/:marketId/order-book', async (request) => {
    const params = marketParamsSchema.parse(request.params);

    return marketsService.getOrderBookSnapshot(params.marketId);
  });

  app.get('/markets/:marketId/order-book/deltas', async (request) => {
    const params = marketParamsSchema.parse(request.params);
    const query = orderBookDeltasQuerySchema.parse(request.query);

    return marketsService.getOrderBookDeltas(params.marketId, {
      afterSequence: query.afterSequence,
      limit: query.limit,
    });
  });

  app.get('/markets/:marketId/trades', async (request) => {
    const params = marketParamsSchema.parse(request.params);
    const query = recentTradesQuerySchema.parse(request.query);

    return marketsService.listRecentTrades(params.marketId, query.limit);
  });

  app.get('/historical/markets/:marketId/trades', async (request) => {
    const params = marketParamsSchema.parse(request.params);
    const query = recentTradesQuerySchema.parse(request.query);

    return marketsService.listHistoricalTrades(params.marketId, query.limit);
  });

  app.get('/markets/:marketId/announcements', async (request) => {
    const params = marketParamsSchema.parse(request.params);

    return marketsService.listMarketAnnouncements(params.marketId);
  });

  app.post('/internal/markets/events', async (request, reply) => {
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

  app.post('/internal/markets', async (request, reply) => {
    assertBootstrapToken(request);
    const body = createMarketBodySchema.parse(request.body);
    const result = await marketsService.createMarket({
      eventId: body.eventId,
      slug: body.slug,
      title: body.title,
      currency: body.currency,
      status: body.status,
      resolutionRules: body.resolutionRules,
      yesPriceBps: body.yesPriceBps,
      noPriceBps: body.noPriceBps,
      ...(body.summary ? { summary: body.summary } : {}),
      ...(body.tags ? { tags: body.tags } : {}),
      ...(body.resolutionSources
        ? { resolutionSources: body.resolutionSources }
        : {}),
      ...(body.volumeUsdMinor !== undefined
        ? { volumeUsdMinor: body.volumeUsdMinor }
        : {}),
      ...(body.opensAt ? { opensAt: new Date(body.opensAt) } : {}),
      ...(body.closesAt ? { closesAt: new Date(body.closesAt) } : {}),
      ...(body.resolvesAt ? { resolvesAt: new Date(body.resolvesAt) } : {}),
    });

    reply.status(201).send(result);
  });

  app.post('/internal/markets/:marketId/match', async (request) => {
    assertBootstrapToken(request);
    const params = marketParamsSchema.parse(request.params);
    const result = await matchingService.runLimitOrderMatching(params.marketId);

    logWorkflowEvent(request, 'matching.run.completed', {
      marketId: result.marketId,
      matchedTradeCount: result.summary.matchedTradeCount,
      touchedOrderCount: result.summary.touchedOrderCount,
      latestSequence: result.summary.latestSequence,
    });

    return result;
  });

  app.post(
    '/internal/markets/:marketId/announcements',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = marketParamsSchema.parse(request.params);
      const body = publishMarketAnnouncementBodySchema.parse(request.body);
      const result = await marketsService.publishMarketAnnouncement(
        params.marketId,
        {
          title: body.title,
          message: body.message,
          ...(body.publishedBy ? { publishedBy: body.publishedBy } : {}),
        },
      );

      logWorkflowEvent(request, 'market.announcement_published', {
        marketId: result.market.id,
        announcementId: result.announcement.id,
        marketStatus: result.market.status,
      });

      reply.status(201).send(result);
    },
  );

  app.post('/internal/markets/:marketId/status', async (request, reply) => {
    assertBootstrapToken(request);
    const params = marketParamsSchema.parse(request.params);
    const body = updateMarketStatusBodySchema.parse(request.body);
    const result = await marketsService.updateMarketStatus(params.marketId, {
      status: body.status,
      reason: body.reason,
      ...(body.changedBy ? { changedBy: body.changedBy } : {}),
    });

    logWorkflowEvent(request, 'market.status_updated', {
      marketId: result.market.id,
      status: result.market.status,
      alreadyApplied: result.alreadyApplied,
      transitionId: result.transition?.id ?? null,
    });

    reply.status(200).send(result);
  });

  app.post('/internal/markets/:marketId/resolve', async (request, reply) => {
    assertBootstrapToken(request);
    const params = marketParamsSchema.parse(request.params);
    const body = resolveMarketBodySchema.parse(request.body);
    const result = await marketsService.resolveMarket(params.marketId, {
      outcome: body.outcome,
      evidenceSummary: body.evidenceSummary,
      ...(body.evidenceSources
        ? { evidenceSources: body.evidenceSources }
        : {}),
      ...(body.approvedBy ? { approvedBy: body.approvedBy } : {}),
    });

    logWorkflowEvent(request, 'market.resolution.recorded', {
      marketId: result.market.id,
      resolutionId: result.resolution.id,
      outcome: result.resolution.outcome,
      status: result.market.status,
    });

    reply.status(200).send(result);
  });

  app.post('/internal/markets/:marketId/settle', async (request, reply) => {
    assertBootstrapToken(request);
    const params = marketParamsSchema.parse(request.params);
    const result = await marketsService.settleMarket(params.marketId);

    logWorkflowEvent(request, 'market.settlement.completed', {
      marketId: result.marketId,
      settlementId: result.settlement.id,
      alreadySettled: result.alreadySettled,
      outcome: result.resolution.outcome,
      payoutCount: result.payouts.length,
      totalPayoutMinor: result.settlement.totalPayoutMinor,
    });

    reply.status(result.alreadySettled ? 200 : 201).send(result);
  });
}

export async function registerMarketRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await marketRoutes(app, options);
}
