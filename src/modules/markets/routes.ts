import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { MarketCurrency } from '../../config/currency';
import { logWorkflowEvent } from '../../lib/observability';
import { FundingService } from '../funding/service';
import { requireInternalAuth } from '../identity/auth-guards';
import { MatchingService } from '../matching/service';
import { accountRealtimeService } from '../portfolio/account-realtime.service';
import { PortfolioService } from '../portfolio/service';
import { marketRealtimeService } from './market-realtime.service';
import {
  createEventBodySchema,
  createMarketBodySchema,
  historicalCandlesQuerySchema,
  listMarketsQuerySchema,
  marketParamsSchema,
  orderBookDeltasQuerySchema,
  publishMarketAnnouncementBodySchema,
  recentTradesQuerySchema,
  resolveMarketBodySchema,
  updateMarketStatusBodySchema,
} from './schema';
import { MarketsService } from './service';

async function publishOrderBookUpdate(
  marketsService: MarketsService,
  marketId: string,
  trigger: string,
) {
  const orderBook = await marketsService.getOrderBookSnapshot(marketId);

  marketRealtimeService.publish({
    marketId,
    type: 'order_book_updated',
    data: {
      trigger,
      orderBook,
      latestSequence: orderBook.snapshot.sequence,
    },
  });
}

async function publishStatusChange(
  marketsService: MarketsService,
  marketId: string,
  trigger: string,
) {
  const detail = await marketsService.getMarketDetail(marketId);

  marketRealtimeService.publish({
    marketId,
    type: 'status_changed',
    data: {
      trigger,
      market: detail.market,
    },
  });
}

async function marketRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const marketsService = new MarketsService();
  const matchingService = new MatchingService();
  const fundingService = new FundingService();
  const portfolioService = new PortfolioService();
  const requireInternal = requireInternalAuth();

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

  app.get('/markets/:marketId/stream', async (request, reply) => {
    const params = marketParamsSchema.parse(request.params);
    const [detail, orderBook, recentTrades] = await Promise.all([
      marketsService.getMarketDetail(params.marketId),
      marketsService.getOrderBookSnapshot(params.marketId),
      marketsService.listRecentTrades(params.marketId, 20),
    ]);

    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    reply.raw.write(
      marketRealtimeService.toSseFrame({
        id: randomUUID(),
        type: 'snapshot',
        marketId: params.marketId,
        emittedAt: new Date().toISOString(),
        data: {
          market: detail.market,
          orderBook,
          recentTrades: recentTrades.trades,
          latestSequence: orderBook.snapshot.sequence,
        },
      }),
    );

    const onMarketEvent = (
      event: Parameters<typeof marketRealtimeService.toSseFrame>[0],
    ) => {
      reply.raw.write(marketRealtimeService.toSseFrame(event));
    };
    const unsubscribe = marketRealtimeService.subscribe(
      params.marketId,
      onMarketEvent,
    );
    const heartbeat = setInterval(() => {
      marketRealtimeService.markSubscriptionActivity(
        params.marketId,
        onMarketEvent,
      );
      reply.raw.write(': heartbeat\n\n');
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    request.raw.on('close', cleanup);
    reply.raw.on('close', cleanup);
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

  app.get('/historical/markets/:marketId/candles', async (request) => {
    const params = marketParamsSchema.parse(request.params);
    const query = historicalCandlesQuerySchema.parse(request.query);

    return marketsService.listHistoricalCandles(params.marketId, {
      interval: query.interval,
      limit: query.limit,
    });
  });

  app.get('/markets/:marketId/announcements', async (request) => {
    const params = marketParamsSchema.parse(request.params);

    return marketsService.listMarketAnnouncements(params.marketId);
  });

  app.post(
    '/internal/markets/events',
    { preHandler: requireInternal },
    async (request, reply) => {
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
    },
  );

  app.post(
    '/internal/markets',
    { preHandler: requireInternal },
    async (request, reply) => {
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
    },
  );

  app.post(
    '/internal/markets/:marketId/match',
    { preHandler: requireInternal },
    async (request) => {
      const params = marketParamsSchema.parse(request.params);
      const result = await matchingService.runLimitOrderMatching(
        params.marketId,
      );

      logWorkflowEvent(request, 'matching.run.completed', {
        marketId: result.marketId,
        matchedTradeCount: result.summary.matchedTradeCount,
        touchedOrderCount: result.summary.touchedOrderCount,
        latestSequence: result.summary.latestSequence,
      });

      if (result.trades.length > 0) {
        marketRealtimeService.publish({
          marketId: result.marketId,
          type: 'trade_batch',
          data: {
            trades: result.trades,
            latestSequence: result.summary.latestSequence,
          },
        });
        await publishOrderBookUpdate(
          marketsService,
          result.marketId,
          'matching_completed',
        );

        const affectedUsers = Array.from(
          new Map(
            result.orders.map((order) => [
              order.userId,
              {
                userId: order.userId,
                currency: order.currency as MarketCurrency,
              },
            ]),
          ).values(),
        );

        for (const affectedUser of affectedUsers) {
          const [fills, balance] = await Promise.all([
            portfolioService.listFills(
              affectedUser.userId,
              20,
              affectedUser.currency,
            ),
            fundingService.getWalletBalance(
              affectedUser.userId,
              affectedUser.currency,
            ),
          ]);

          accountRealtimeService.publish({
            userId: affectedUser.userId,
            currency: affectedUser.currency,
            type: 'fill_batch',
            data: {
              marketId: result.marketId,
              trades: result.trades,
              fills: fills.fills,
            },
          });
          accountRealtimeService.publish({
            userId: affectedUser.userId,
            currency: affectedUser.currency,
            type: 'balance_updated',
            data: {
              trigger: 'matching_completed',
              balance,
            },
          });
        }
      }

      return result;
    },
  );

  app.post(
    '/internal/markets/:marketId/announcements',
    { preHandler: requireInternal },
    async (request, reply) => {
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

      marketRealtimeService.publish({
        marketId: result.market.id,
        type: 'announcement_published',
        data: {
          market: result.market,
          announcement: result.announcement,
        },
      });

      reply.status(201).send(result);
    },
  );

  app.post(
    '/internal/markets/:marketId/status',
    { preHandler: requireInternal },
    async (request, reply) => {
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

      await publishStatusChange(
        marketsService,
        result.market.id,
        'market_status_updated',
      );

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/markets/:marketId/resolve',
    { preHandler: requireInternal },
    async (request, reply) => {
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

      await publishStatusChange(
        marketsService,
        result.market.id,
        'market_resolved',
      );

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/markets/:marketId/settle',
    { preHandler: requireInternal },
    async (request, reply) => {
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

      await publishStatusChange(
        marketsService,
        result.marketId,
        'market_settled',
      );

      for (const payout of result.payouts) {
        const currency = payout.currency as MarketCurrency;
        const [settlements, balance] = await Promise.all([
          portfolioService.listSettlements(payout.userId, 20, currency),
          fundingService.getWalletBalance(payout.userId, currency),
        ]);

        accountRealtimeService.publish({
          userId: payout.userId,
          currency,
          type: 'settlement_updated',
          data: {
            marketId: result.marketId,
            settlement: result.settlement,
            payout,
            settlements: settlements.settlements,
          },
        });
        accountRealtimeService.publish({
          userId: payout.userId,
          currency,
          type: 'balance_updated',
          data: {
            trigger: 'market_settled',
            balance,
          },
        });
      }

      reply.status(result.alreadySettled ? 200 : 201).send(result);
    },
  );
}

export async function registerMarketRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await marketRoutes(app, options);
}
