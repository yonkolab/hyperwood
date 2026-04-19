import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { ExchangeService } from './service';

const weekdaySchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

const weeklyWindowSchema = z
  .object({
    weekday: weekdaySchema,
    opensAt: z.string().regex(/^\d{2}:\d{2}$/),
    closesAt: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((value) => value.opensAt < value.closesAt, {
    message: 'closesAt must be later than opensAt',
    path: ['closesAt'],
  });

const maintenanceWindowSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  message: z.string().min(3).max(4000),
});

const upsertExchangeScheduleBodySchema = z.object({
  name: z.string().min(3).max(160),
  timezone: z.string().min(3).max(64),
  weeklyWindows: z.array(weeklyWindowSchema).max(21),
  maintenanceWindows: z.array(maintenanceWindowSchema).max(16).default([]),
  notes: z.string().min(3).max(4000).optional(),
});

const currencySchema = z.enum(['USD', 'BRL']);

const publishExchangeFeeScheduleBodySchema = z
  .object({
    name: z.string().min(3).max(160),
    currency: currencySchema,
    makerFeeBps: z.number().int().min(0).max(10000),
    takerFeeBps: z.number().int().min(0).max(10000),
    effectiveFrom: z.string().datetime(),
    effectiveUntil: z.string().datetime().optional(),
    notes: z.string().min(3).max(4000).optional(),
    publishedBy: z.string().min(3).max(128).optional(),
  })
  .refine(
    (value) =>
      !value.effectiveUntil ||
      new Date(value.effectiveUntil) > new Date(value.effectiveFrom),
    {
      message: 'effectiveUntil must be later than effectiveFrom',
      path: ['effectiveUntil'],
    },
  );

const listExchangeFeeSchedulesQuerySchema = z.object({
  currency: currencySchema.optional(),
});

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
