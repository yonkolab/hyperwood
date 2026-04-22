import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  getSessionAuthContext,
  requireSessionAuth,
} from '../identity/auth-guards';
import { IdentityService } from '../identity/service';
import { accountRealtimeService } from './account-realtime.service';
import {
  createExportBodySchema,
  exportJobParamsSchema,
  exportJobsQuerySchema,
  fillsQuerySchema,
  historicalFillsQuerySchema,
  historicalOrdersQuerySchema,
  portfolioQuerySchema,
  portfolioStreamQuerySchema,
  settlementsQuerySchema,
} from './schema';
import { PortfolioService } from './service';

async function portfolioRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const portfolioService = new PortfolioService();
  const requireSession = requireSessionAuth(identityService);

  app.get('/portfolio', { preHandler: requireSession }, async (request) => {
    const auth = getSessionAuthContext(request);
    const query = portfolioQuerySchema.parse(request.query);

    return portfolioService.getPortfolioSummary(auth.user.id, query.currency);
  });

  app.get(
    '/portfolio/stream',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const query = portfolioStreamQuerySchema.parse(request.query);
      const [portfolioSummary, fills, settlements] = await Promise.all([
        portfolioService.getPortfolioSummary(auth.user.id, query.currency),
        portfolioService.listFills(auth.user.id, 20, query.currency),
        portfolioService.listSettlements(auth.user.id, 20, query.currency),
      ]);

      reply.hijack();
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      reply.raw.write(
        accountRealtimeService.toSseFrame({
          id: randomUUID(),
          type: 'account_snapshot',
          userId: auth.user.id,
          currency: query.currency,
          emittedAt: new Date().toISOString(),
          data: {
            portfolioSummary,
            recentFills: fills.fills,
            recentSettlements: settlements.settlements,
          },
        }),
      );

      const onAccountEvent = (
        event: Parameters<typeof accountRealtimeService.toSseFrame>[0],
      ) => {
        reply.raw.write(accountRealtimeService.toSseFrame(event));
      };
      const unsubscribe = accountRealtimeService.subscribe(
        auth.user.id,
        query.currency,
        onAccountEvent,
      );
      const heartbeat = setInterval(() => {
        accountRealtimeService.markSubscriptionActivity(
          auth.user.id,
          query.currency,
          onAccountEvent,
        );
        reply.raw.write(': heartbeat\n\n');
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      request.raw.on('close', cleanup);
      reply.raw.on('close', cleanup);
    },
  );

  app.get(
    '/portfolio/fills',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = fillsQuerySchema.parse(request.query);

      return portfolioService.listFills(
        auth.user.id,
        query.limit,
        query.currency,
      );
    },
  );

  app.get(
    '/historical/portfolio/orders',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = historicalOrdersQuerySchema.parse(request.query);

      return portfolioService.listHistoricalOrders(
        auth.user.id,
        query.limit,
        query.currency,
      );
    },
  );

  app.get(
    '/historical/portfolio/fills',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = historicalFillsQuerySchema.parse(request.query);

      return portfolioService.listHistoricalFills(
        auth.user.id,
        query.limit,
        query.currency,
      );
    },
  );

  app.get(
    '/portfolio/settlements',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = settlementsQuerySchema.parse(request.query);

      return portfolioService.listSettlements(
        auth.user.id,
        query.limit,
        query.currency,
      );
    },
  );

  app.post(
    '/portfolio/exports',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const body = createExportBodySchema.parse(request.body ?? {});
      const result = await portfolioService.createAccountHistoryExport(
        auth.user.id,
        body.currency,
      );

      reply.status(201).send(result);
    },
  );

  app.get(
    '/portfolio/exports',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = exportJobsQuerySchema.parse(request.query);

      return portfolioService.listAccountHistoryExports(
        auth.user.id,
        query.limit,
        query.currency,
      );
    },
  );

  app.get(
    '/portfolio/exports/:exportJobId',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const params = exportJobParamsSchema.parse(request.params);

      return portfolioService.getAccountHistoryExport(
        auth.user.id,
        params.exportJobId,
      );
    },
  );
}

export async function registerPortfolioRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await portfolioRoutes(app, options);
}
