import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { requireInternalAuth } from '../identity/auth-guards';
import {
  ledgerInvariantScanBodySchema,
  listAlertsQuerySchema,
  listAuditEventsQuerySchema,
  listRateLimitEventsQuerySchema,
  listReviewQueueQuerySchema,
  realtimeStreamHealthScanBodySchema,
  settlementFailureScanBodySchema,
  settlementRetryBodySchema,
  settlementRetryParamsSchema,
  tradingConditionScanBodySchema,
} from './schema';
import { OperationsService } from './service';

async function operationsRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const operationsService = new OperationsService();
  const requireInternal = requireInternalAuth();

  app.get(
    '/internal/operations/reviews',
    { preHandler: requireInternal },
    async (request) => {
      const query = listReviewQueueQuerySchema.parse(request.query);

      return operationsService.listActiveReviewQueue({
        limit: query.limit,
      });
    },
  );

  app.get(
    '/internal/operations/audit-events',
    { preHandler: requireInternal },
    async (request) => {
      const query = listAuditEventsQuerySchema.parse(request.query);

      return operationsService.listAuditEvents({
        limit: query.limit,
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.targetId ? { targetId: query.targetId } : {}),
        ...(query.action ? { action: query.action } : {}),
      });
    },
  );

  app.get(
    '/internal/operations/rate-limit-events',
    { preHandler: requireInternal },
    async (request) => {
      const query = listRateLimitEventsQuerySchema.parse(request.query);

      return operationsService.listRateLimitEvents({
        limit: query.limit,
        ...(query.bucket ? { bucket: query.bucket } : {}),
        ...(query.scopeType ? { scopeType: query.scopeType } : {}),
        ...(query.scopeKey ? { scopeKey: query.scopeKey } : {}),
        ...(query.path ? { path: query.path } : {}),
      });
    },
  );

  app.get(
    '/internal/operations/alerts',
    { preHandler: requireInternal },
    async (request) => {
      const query = listAlertsQuerySchema.parse(request.query);

      return operationsService.listAlerts({
        limit: query.limit,
        ...(query.category ? { category: query.category } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      });
    },
  );

  app.post(
    '/internal/operations/ledger-invariant-scan',
    { preHandler: requireInternal },
    async (request) => {
      const body = ledgerInvariantScanBodySchema.parse(request.body ?? {});

      return operationsService.scanLedgerInvariants({
        limit: body.limit,
      });
    },
  );

  app.post(
    '/internal/operations/settlement-failure-scan',
    { preHandler: requireInternal },
    async (request) => {
      const body = settlementFailureScanBodySchema.parse(request.body ?? {});

      return operationsService.scanSettlementFailures({
        limit: body.limit,
      });
    },
  );

  app.post(
    '/internal/operations/settlement-retries/:marketId',
    { preHandler: requireInternal },
    async (request, reply) => {
      const params = settlementRetryParamsSchema.parse(request.params);
      const body = settlementRetryBodySchema.parse(request.body ?? {});
      const result = await operationsService.retrySettlement({
        marketId: params.marketId,
        ...(body.requestedBy ? { requestedBy: body.requestedBy } : {}),
      });

      reply.status(result.alreadySettled ? 200 : 201).send(result);
    },
  );

  app.post(
    '/internal/operations/trading-condition-scan',
    { preHandler: requireInternal },
    async (request) => {
      const body = tradingConditionScanBodySchema.parse(request.body ?? {});

      return operationsService.scanTradingConditions({
        limit: body.limit,
      });
    },
  );

  app.post(
    '/internal/operations/realtime-stream-health-scan',
    { preHandler: requireInternal },
    async (request) => {
      const body = realtimeStreamHealthScanBodySchema.parse(request.body ?? {});

      return operationsService.scanRealtimeStreamHealth({
        limit: body.limit,
        ...(body.maxIdleSeconds !== undefined
          ? { maxIdleSeconds: body.maxIdleSeconds }
          : {}),
      });
    },
  );
}

export async function registerOperationsRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await operationsRoutes(app, options);
}
