import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { IdentityService } from '../identity/service';
import { OrdersService } from './service';

const createOrderBodySchema = z
  .object({
    marketId: z.string().uuid(),
    type: z.enum(['limit', 'market']),
    side: z.enum(['buy', 'sell']),
    outcome: z.enum(['yes', 'no']),
    quantity: z.number().int().positive(),
    limitPriceBps: z.number().int().min(1).max(9999).optional(),
    selfTradePrevention: z
      .enum(['decrement_and_cancel', 'cancel_oldest', 'cancel_newest'])
      .default('decrement_and_cancel'),
  })
  .superRefine((body, ctx) => {
    if (body.type === 'limit' && body.limitPriceBps === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limitPriceBps'],
        message: 'limitPriceBps is required for limit orders',
      });
    }

    if (body.type === 'market' && body.limitPriceBps !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limitPriceBps'],
        message: 'limitPriceBps is not allowed for market orders',
      });
    }
  });

const orderParamsSchema = z.object({
  orderId: z.string().uuid(),
});

const amendOrderBodySchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    limitPriceBps: z.number().int().min(1).max(9999).optional(),
  })
  .refine(
    (body) => body.quantity !== undefined || body.limitPriceBps !== undefined,
    {
      message: 'quantity or limitPriceBps is required',
    },
  );

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'missing_session', 'missing bearer session token');
  }

  return header.slice('Bearer '.length);
}

function getIdempotencyKeyFromRequest(request: FastifyRequest) {
  const header = request.headers['idempotency-key'];

  if (typeof header !== 'string' || header.length === 0) {
    throw new AppError(
      400,
      'missing_idempotency_key',
      'missing idempotency-key header',
    );
  }

  return header;
}

async function orderRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const ordersService = new OrdersService();

  app.post('/orders', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const idempotencyKey = getIdempotencyKeyFromRequest(request);
    const body = createOrderBodySchema.parse(request.body);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await ordersService.createOrder({
      userId: user.id,
      marketId: body.marketId,
      idempotencyKey,
      type: body.type,
      side: body.side,
      outcome: body.outcome,
      quantity: body.quantity,
      selfTradePrevention: body.selfTradePrevention,
      ...(body.limitPriceBps !== undefined
        ? { limitPriceBps: body.limitPriceBps }
        : {}),
    });

    reply.status(result.idempotentReplay ? 200 : 201).send(result);
  });

  app.delete('/orders/:orderId', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const params = orderParamsSchema.parse(request.params);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await ordersService.cancelOrder({
      userId: user.id,
      orderId: params.orderId,
    });

    reply.status(200).send(result);
  });

  app.patch('/orders/:orderId', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const params = orderParamsSchema.parse(request.params);
    const body = amendOrderBodySchema.parse(request.body);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await ordersService.amendOrder({
      userId: user.id,
      orderId: params.orderId,
      ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
      ...(body.limitPriceBps !== undefined
        ? { limitPriceBps: body.limitPriceBps }
        : {}),
    });

    reply.status(200).send(result);
  });
}

export async function registerOrderRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await orderRoutes(app, options);
}
