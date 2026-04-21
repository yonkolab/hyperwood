import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { AppError } from '../../lib/errors';
import { IdentityService } from '../identity/service';
import {
  createExportBodySchema,
  exportJobParamsSchema,
  exportJobsQuerySchema,
  fillsQuerySchema,
  portfolioQuerySchema,
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

  app.get('/portfolio/fills', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = fillsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.listFills(user.id, query.limit, query.currency);
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
