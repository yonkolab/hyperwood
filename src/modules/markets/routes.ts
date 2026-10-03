import { randomUUID } from 'node:crypto';
import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { z } from 'zod';
import type { MarketCurrency } from '../../config/currency';
import { logWorkflowEvent } from '../../lib/observability';
import { FundingService } from '../funding/service';
import {
  getInternalAuthContext,
  getSessionAuthContext,
  requireInternalAuth,
  requireSessionAuth,
} from '../identity/auth-guards';
import { IdentityService } from '../identity/service';
import { MatchingService } from '../matching/service';
import { accountRealtimeService } from '../portfolio/account-realtime.service';
import { PortfolioService } from '../portfolio/service';
import {
  createMarketComment,
  listMarketComments,
  reportMarketComment,
  toggleMarketCommentBookmark,
  toggleMarketCommentLike,
} from './market-comments.service';
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
  const identityService = new IdentityService();
  const requireSession = requireSessionAuth(identityService);
  const portfolioService = new PortfolioService();
  const requireMarketsWrite = requireInternalAuth('markets:write');
  const requireMarketsSettle = requireInternalAuth('markets:settle');

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
    { preHandler: requireMarketsWrite },
    async (request, reply) => {
      getInternalAuthContext(request);
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
    { preHandler: requireMarketsWrite },
    async (request, reply) => {
      getInternalAuthContext(request);
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
    { preHandler: requireMarketsWrite },
    async (request) => {
      getInternalAuthContext(request);
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
    { preHandler: requireMarketsWrite },
    async (request, reply) => {
      const auth = getInternalAuthContext(request);
      const params = marketParamsSchema.parse(request.params);
      const body = publishMarketAnnouncementBodySchema.parse(request.body);
      const result = await marketsService.publishMarketAnnouncement(
        params.marketId,
        {
          title: body.title,
          message: body.message,
          publishedBy: body.publishedBy ?? auth.internalActor,
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
    { preHandler: requireMarketsWrite },
    async (request, reply) => {
      const auth = getInternalAuthContext(request);
      const params = marketParamsSchema.parse(request.params);
      const body = updateMarketStatusBodySchema.parse(request.body);
      const result = await marketsService.updateMarketStatus(params.marketId, {
        status: body.status,
        reason: body.reason,
        changedBy: body.changedBy ?? auth.internalActor,
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
    { preHandler: requireMarketsSettle },
    async (request, reply) => {
      const auth = getInternalAuthContext(request);
      const params = marketParamsSchema.parse(request.params);
      const body = resolveMarketBodySchema.parse(request.body);
      const result = await marketsService.resolveMarket(params.marketId, {
        outcome: body.outcome,
        evidenceSummary: body.evidenceSummary,
        ...(body.evidenceSources
          ? { evidenceSources: body.evidenceSources }
          : {}),
        approvedBy: body.approvedBy ?? auth.internalActor,
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
    { preHandler: requireMarketsSettle },
    async (request, reply) => {
      const auth = getInternalAuthContext(request);
      const params = marketParamsSchema.parse(request.params);
      const result = await marketsService.settleMarket(params.marketId, {
        settledBy: auth.internalActor,
      });

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
  await marketCommentRoutes(app, options);
}

function getSessionBearerTokenOptional(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (
    typeof authorization !== 'string' ||
    !authorization.startsWith('Bearer ')
  ) {
    return null;
  }

  return authorization.slice('Bearer '.length) || null;
}

async function safeResolveViewer(
  identityService: { getUserFromSessionToken(token: string): Promise<unknown> },
  sessionToken: string,
): Promise<{ userId: string } | null> {
  try {
    const user = (await identityService.getUserFromSessionToken(
      sessionToken,
    )) as { id?: unknown };

    return typeof user?.id === 'string' ? { userId: user.id } : null;
  } catch {
    return null;
  }
}

async function marketCommentRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const requireSession = requireSessionAuth(identityService);

  const commentBodySchema = z.string().min(1).max(2000);

  const createCommentBodySchema = z.object({
    body: commentBodySchema,
    parentId: z.string().uuid().optional(),
  });

  const reportBodySchema = z.object({
    reason: z.string().min(3).max(160),
  });

  const commentParamsSchema = z.object({
    commentId: z.string().uuid(),
  });

  app.get('/markets/:marketId/comments', async (request) => {
    const params = marketParamsSchema.parse(request.params);
    const sessionToken = getSessionBearerTokenOptional(request);
    const viewer = sessionToken
      ? await safeResolveViewer(identityService, sessionToken)
      : null;

    const comments = await listMarketComments(params.marketId, viewer);

    return { marketId: params.marketId, comments };
  });

  app.post(
    '/markets/:marketId/comments',
    { preHandler: requireSession },
    async (request, reply) => {
      const params = marketParamsSchema.parse(request.params);
      const body = createCommentBodySchema.parse(request.body);
      const auth = getSessionAuthContext(request);

      const comment = await createMarketComment({
        marketId: params.marketId,
        userId: auth.user.id,
        parentId: body.parentId ?? null,
        body: body.body,
      });

      reply.status(201).send({ comment });
    },
  );

  app.post(
    '/comments/:commentId/like',
    { preHandler: requireSession },
    async (request) => {
      const params = commentParamsSchema.parse(request.params);
      const auth = getSessionAuthContext(request);

      return toggleMarketCommentLike({
        commentId: params.commentId,
        userId: auth.user.id,
      });
    },
  );

  app.post(
    '/comments/:commentId/bookmark',
    { preHandler: requireSession },
    async (request) => {
      const params = commentParamsSchema.parse(request.params);
      const auth = getSessionAuthContext(request);

      return toggleMarketCommentBookmark({
        commentId: params.commentId,
        userId: auth.user.id,
      });
    },
  );

  app.post(
    '/comments/:commentId/report',
    { preHandler: requireSession },
    async (request) => {
      const params = commentParamsSchema.parse(request.params);
      const body = reportBodySchema.parse(request.body);
      const auth = getSessionAuthContext(request);

      return reportMarketComment({
        commentId: params.commentId,
        reporterId: auth.user.id,
        reason: body.reason,
      });
    },
  );
}

export async function registerMarketCommentRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await marketCommentRoutes(app, options);
}
