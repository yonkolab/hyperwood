import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import {
  ledgerInvariantScanBodySchema,
  listAlertsQuerySchema,
  listAuditEventsQuerySchema,
  listRateLimitEventsQuerySchema,
  listReviewQueueQuerySchema,
  realtimeStreamHealthScanBodySchema,
  settlementFailureScanBodySchema,
  tradingConditionScanBodySchema,
} from './schema';
import { OperationsService } from './service';

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

async function operationsRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const operationsService = new OperationsService();

  app.get('/internal/operations/reviews', async (request) => {
    assertBootstrapToken(request);
    const query = listReviewQueueQuerySchema.parse(request.query);

    return operationsService.listActiveReviewQueue({
      limit: query.limit,
    });
  });

  app.get('/internal/operations/audit-events', async (request) => {
    assertBootstrapToken(request);
    const query = listAuditEventsQuerySchema.parse(request.query);

    return operationsService.listAuditEvents({
      limit: query.limit,
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.action ? { action: query.action } : {}),
    });
  });

  app.get('/internal/operations/rate-limit-events', async (request) => {
    assertBootstrapToken(request);
    const query = listRateLimitEventsQuerySchema.parse(request.query);

    return operationsService.listRateLimitEvents({
      limit: query.limit,
      ...(query.bucket ? { bucket: query.bucket } : {}),
      ...(query.scopeType ? { scopeType: query.scopeType } : {}),
      ...(query.scopeKey ? { scopeKey: query.scopeKey } : {}),
      ...(query.path ? { path: query.path } : {}),
    });
  });

  app.get('/internal/operations/alerts', async (request) => {
    assertBootstrapToken(request);
    const query = listAlertsQuerySchema.parse(request.query);

    return operationsService.listAlerts({
      limit: query.limit,
      ...(query.category ? { category: query.category } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    });
  });

  app.post('/internal/operations/ledger-invariant-scan', async (request) => {
    assertBootstrapToken(request);
    const body = ledgerInvariantScanBodySchema.parse(request.body ?? {});

    return operationsService.scanLedgerInvariants({
      limit: body.limit,
    });
  });

  app.post('/internal/operations/settlement-failure-scan', async (request) => {
    assertBootstrapToken(request);
    const body = settlementFailureScanBodySchema.parse(request.body ?? {});

    return operationsService.scanSettlementFailures({
      limit: body.limit,
    });
  });

  app.post('/internal/operations/trading-condition-scan', async (request) => {
    assertBootstrapToken(request);
    const body = tradingConditionScanBodySchema.parse(request.body ?? {});

    return operationsService.scanTradingConditions({
      limit: body.limit,
    });
  });

  app.post(
    '/internal/operations/realtime-stream-health-scan',
    async (request) => {
      assertBootstrapToken(request);
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
