import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { AppError } from '../../lib/errors';
import { logWorkflowEvent } from '../../lib/observability';
import { FundingService } from '../funding/service';
import {
  getSessionAuthContext,
  requireSessionAuth,
} from '../identity/auth-guards';
import { IdentityService } from '../identity/service';
import { marketRealtimeService } from '../markets/market-realtime.service';
import { MarketsService } from '../markets/service';
import { accountRealtimeService } from '../portfolio/account-realtime.service';
import {
  amendOrderBodySchema,
  createOrderBodySchema,
  orderParamsSchema,
} from './schema';
import { OrdersService } from './service';

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
  const marketsService = new MarketsService();
  const fundingService = new FundingService();
  const requireSession = requireSessionAuth(identityService);

  app.post(
    '/orders',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const idempotencyKey = getIdempotencyKeyFromRequest(request);
      const body = createOrderBodySchema.parse(request.body);
      const result = await ordersService.createOrder({
        userId: auth.user.id,
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

      logWorkflowEvent(request, 'order.create.accepted', {
        userId: auth.user.id,
        orderId: result.order.id,
        marketId: result.order.marketId,
        orderStatus: result.order.status,
        idempotentReplay: result.idempotentReplay,
        marketCommandSequence: result.marketCommand?.sequence ?? null,
      });

      const orderBook = await marketsService.getOrderBookSnapshot(
        result.order.marketId,
      );
      marketRealtimeService.publish({
        marketId: result.order.marketId,
        type: 'order_book_updated',
        data: {
          trigger: result.idempotentReplay
            ? 'order_create_replay'
            : 'order_create',
          orderBook,
          latestSequence: orderBook.snapshot.sequence,
        },
      });

      const balance = await fundingService.getWalletBalance(
        auth.user.id,
        result.order.currency,
      );

      accountRealtimeService.publish({
        userId: auth.user.id,
        currency: result.order.currency,
        type: 'order_updated',
        data: {
          order: result.order,
          idempotentReplay: result.idempotentReplay,
        },
      });
      accountRealtimeService.publish({
        userId: auth.user.id,
        currency: result.order.currency,
        type: 'balance_updated',
        data: {
          balance,
          trigger: result.idempotentReplay
            ? 'order_create_replay'
            : 'order_create',
        },
      });

      reply.status(result.idempotentReplay ? 200 : 201).send(result);
    },
  );

  app.delete(
    '/orders/:orderId',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const params = orderParamsSchema.parse(request.params);
      const result = await ordersService.cancelOrder({
        userId: auth.user.id,
        orderId: params.orderId,
      });

      logWorkflowEvent(request, 'order.cancelled', {
        userId: auth.user.id,
        orderId: result.order.id,
        marketId: result.order.marketId,
        alreadyCancelled: result.alreadyCancelled,
        marketCommandSequence: result.marketCommand?.sequence ?? null,
      });

      const orderBook = await marketsService.getOrderBookSnapshot(
        result.order.marketId,
      );
      marketRealtimeService.publish({
        marketId: result.order.marketId,
        type: 'order_book_updated',
        data: {
          trigger: result.alreadyCancelled
            ? 'order_cancel_replay'
            : 'order_cancel',
          orderBook,
          latestSequence: orderBook.snapshot.sequence,
        },
      });

      const balance = await fundingService.getWalletBalance(
        auth.user.id,
        result.order.currency,
      );

      accountRealtimeService.publish({
        userId: auth.user.id,
        currency: result.order.currency,
        type: 'order_updated',
        data: {
          order: result.order,
          alreadyCancelled: result.alreadyCancelled,
        },
      });
      accountRealtimeService.publish({
        userId: auth.user.id,
        currency: result.order.currency,
        type: 'balance_updated',
        data: {
          balance,
          trigger: result.alreadyCancelled
            ? 'order_cancel_replay'
            : 'order_cancel',
        },
      });

      reply.status(200).send(result);
    },
  );

  app.patch(
    '/orders/:orderId',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const params = orderParamsSchema.parse(request.params);
      const body = amendOrderBodySchema.parse(request.body);
      const result = await ordersService.amendOrder({
        userId: auth.user.id,
        orderId: params.orderId,
        ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
        ...(body.limitPriceBps !== undefined
          ? { limitPriceBps: body.limitPriceBps }
          : {}),
      });

      logWorkflowEvent(request, 'order.amended', {
        userId: auth.user.id,
        orderId: result.order.id,
        marketId: result.order.marketId,
        alreadyApplied: result.alreadyApplied,
        marketCommandSequence: result.marketCommand?.sequence ?? null,
      });

      const orderBook = await marketsService.getOrderBookSnapshot(
        result.order.marketId,
      );
      marketRealtimeService.publish({
        marketId: result.order.marketId,
        type: 'order_book_updated',
        data: {
          trigger: result.alreadyApplied ? 'order_amend_replay' : 'order_amend',
          orderBook,
          latestSequence: orderBook.snapshot.sequence,
        },
      });

      const balance = await fundingService.getWalletBalance(
        auth.user.id,
        result.order.currency,
      );

      accountRealtimeService.publish({
        userId: auth.user.id,
        currency: result.order.currency,
        type: 'order_updated',
        data: {
          order: result.order,
          alreadyApplied: result.alreadyApplied,
        },
      });
      accountRealtimeService.publish({
        userId: auth.user.id,
        currency: result.order.currency,
        type: 'balance_updated',
        data: {
          balance,
          trigger: result.alreadyApplied ? 'order_amend_replay' : 'order_amend',
        },
      });

      reply.status(200).send(result);
    },
  );
}

export async function registerOrderRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await orderRoutes(app, options);
}
