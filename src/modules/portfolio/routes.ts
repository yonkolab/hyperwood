import { randomUUID } from 'node:crypto';
import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { AppError } from '../../lib/errors';
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

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'missing_session', 'missing bearer session token');
  }

  return header.slice('Bearer '.length);
}

async function portfolioRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const portfolioService = new PortfolioService();

  app.get('/portfolio', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = portfolioQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.getPortfolioSummary(user.id, query.currency);
  });

  app.get('/portfolio/stream', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = portfolioStreamQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const [portfolioSummary, fills, settlements] = await Promise.all([
      portfolioService.getPortfolioSummary(user.id, query.currency),
      portfolioService.listFills(user.id, 20, query.currency),
      portfolioService.listSettlements(user.id, 20, query.currency),
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
        userId: user.id,
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
      user.id,
      query.currency,
      onAccountEvent,
    );
    const heartbeat = setInterval(() => {
      accountRealtimeService.markSubscriptionActivity(
        user.id,
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
  });

  app.get('/portfolio/fills', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = fillsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.listFills(user.id, query.limit, query.currency);
  });

  app.get('/historical/portfolio/orders', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = historicalOrdersQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.listHistoricalOrders(
      user.id,
      query.limit,
      query.currency,
    );
  });

  app.get('/historical/portfolio/fills', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = historicalFillsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.listHistoricalFills(
      user.id,
      query.limit,
      query.currency,
    );
  });

  app.get('/portfolio/settlements', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = settlementsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.listSettlements(
      user.id,
      query.limit,
      query.currency,
    );
  });

  app.post('/portfolio/exports', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const body = createExportBodySchema.parse(request.body ?? {});
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await portfolioService.createAccountHistoryExport(
      user.id,
      body.currency,
    );

    reply.status(201).send(result);
  });

  app.get('/portfolio/exports', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = exportJobsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.listAccountHistoryExports(
      user.id,
      query.limit,
      query.currency,
    );
  });

  app.get('/portfolio/exports/:exportJobId', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const params = exportJobParamsSchema.parse(request.params);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.getAccountHistoryExport(
      user.id,
      params.exportJobId,
    );
  });
}

export async function registerPortfolioRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await portfolioRoutes(app, options);
}
