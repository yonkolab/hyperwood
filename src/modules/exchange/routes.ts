import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import {
  listExchangeFeeSchedulesQuerySchema,
  publishExchangeFeeScheduleBodySchema,
  upsertExchangeScheduleBodySchema,
} from './schema';
import { ExchangeService } from './service';

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

async function exchangeRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const exchangeService = new ExchangeService();

  app.get('/exchange/schedule', async () =>
    exchangeService.getActiveSchedule(),
  );

  app.get('/exchange/status', async () =>
    exchangeService.getCurrentExchangeStatus(),
  );

  app.get('/exchange/fees', async (request) => {
    const query = listExchangeFeeSchedulesQuerySchema.parse(request.query);

    return exchangeService.listActiveFeeSchedules({
      ...(query.currency ? { currency: query.currency } : {}),
    });
  });

  app.post('/internal/exchange/schedule', async (request, reply) => {
    assertBootstrapToken(request);
    const body = upsertExchangeScheduleBodySchema.parse(request.body);
    const result = await exchangeService.upsertActiveSchedule({
      name: body.name,
      timezone: body.timezone,
      weeklyWindows: body.weeklyWindows,
      maintenanceWindows: body.maintenanceWindows,
      ...(body.notes ? { notes: body.notes } : {}),
    });

    reply.status(result.created ? 201 : 200).send(result);
  });

  app.post('/internal/exchange/fees', async (request, reply) => {
    assertBootstrapToken(request);
    const body = publishExchangeFeeScheduleBodySchema.parse(request.body);
    const result = await exchangeService.publishFeeSchedule({
      name: body.name,
      currency: body.currency,
      makerFeeBps: body.makerFeeBps,
      takerFeeBps: body.takerFeeBps,
      effectiveFrom: new Date(body.effectiveFrom),
      ...(body.effectiveUntil
        ? { effectiveUntil: new Date(body.effectiveUntil) }
        : {}),
      ...(body.notes ? { notes: body.notes } : {}),
      ...(body.publishedBy ? { publishedBy: body.publishedBy } : {}),
    });

    reply.status(201).send(result);
  });
}

export async function registerExchangeRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await exchangeRoutes(app, options);
}
