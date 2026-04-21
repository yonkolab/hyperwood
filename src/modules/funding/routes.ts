import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { logWorkflowEvent } from '../../lib/observability';
import { verifyFundingWebhookSignature } from '../../lib/webhooks';
import { IdentityService } from '../identity/service';
import {
  callbackDelayScanBodySchema,
  createDepositBodySchema,
  createWithdrawalBodySchema,
  fundingDepositParamsSchema,
  fundingMethodBodySchema,
  fundingMethodsQuerySchema,
  fundingProviderWebhookBodySchema,
  fundingUserParamsSchema,
  fundingWebhookProviderParamsSchema,
  fundingWithdrawalParamsSchema,
  listDepositsQuerySchema,
  listWithdrawalsQuerySchema,
  reconciliationDiscrepanciesQuerySchema,
  reconciliationRunBodySchema,
  seedWalletBodySchema,
  walletBalanceQuerySchema,
} from './schema';
import { FundingService } from './service';

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'missing_session', 'missing bearer session token');
  }

  return header.slice('Bearer '.length);
}

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

function getWebhookTimestampFromRequest(request: FastifyRequest) {
  const header = request.headers['x-webhook-timestamp'];

  if (typeof header !== 'string' || header.length === 0) {
    throw new AppError(
      401,
      'missing_webhook_timestamp',
      'missing webhook timestamp',
    );
  }

  const timestamp = Number.parseInt(header, 10);

  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    throw new AppError(
      401,
      'invalid_webhook_timestamp',
      'webhook timestamp is invalid',
    );
  }

  const skewSeconds = Math.abs(Date.now() - timestamp * 1000) / 1000;

  if (skewSeconds > env.FUNDING_PROVIDER_WEBHOOK_MAX_SKEW_SECONDS) {
    throw new AppError(
      401,
      'expired_webhook_signature',
      'webhook timestamp is outside the accepted window',
    );
  }

  return timestamp;
}

function getWebhookSignatureFromRequest(request: FastifyRequest) {
  const header = request.headers['x-webhook-signature'];

  if (typeof header !== 'string' || header.length === 0) {
    throw new AppError(
      401,
      'missing_webhook_signature',
      'missing webhook signature',
    );
  }

  return header;
}

async function fundingRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const fundingService = new FundingService();

  app.get('/funding/methods', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = fundingMethodsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return fundingService.listEligibleFundingMethods(user.id, query.currency);
  });

  app.get('/wallet/balance', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = walletBalanceQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return fundingService.getWalletBalance(user.id, query.currency);
  });

  app.get('/funding/deposits', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = listDepositsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return fundingService.listDeposits(user.id, {
      limit: query.limit,
      ...(query.currency ? { currency: query.currency } : {}),
    });
  });

  app.post('/funding/deposits', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const body = createDepositBodySchema.parse(request.body);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await fundingService.createDeposit({
      userId: user.id,
      fundingMethodId: body.fundingMethodId,
      amountMinor: body.amountMinor,
      currency: body.currency,
    });

    logWorkflowEvent(request, 'funding.deposit.created', {
      userId: user.id,
      transferId: result.deposit.id,
      amountMinor: result.deposit.amountMinor,
      currency: result.deposit.currency,
      rail: result.deposit.fundingMethod.rail,
      status: result.deposit.status,
    });

    reply.status(201).send(result);
  });

  app.get('/funding/withdrawals', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = listWithdrawalsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return fundingService.listWithdrawals(user.id, {
      limit: query.limit,
      ...(query.currency ? { currency: query.currency } : {}),
    });
  });

  app.post('/funding/withdrawals', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const body = createWithdrawalBodySchema.parse(request.body);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await fundingService.createWithdrawal({
      userId: user.id,
      fundingMethodId: body.fundingMethodId,
      amountMinor: body.amountMinor,
      currency: body.currency,
    });

    logWorkflowEvent(request, 'funding.withdrawal.created', {
      userId: user.id,
      transferId: result.withdrawal.id,
      amountMinor: result.withdrawal.amountMinor,
      currency: result.withdrawal.currency,
      rail: result.withdrawal.fundingMethod.rail,
      status: result.withdrawal.status,
    });

    reply.status(201).send(result);
  });

  app.post(
    '/internal/funding/users/:userId/methods',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = fundingUserParamsSchema.parse(request.params);
      const body = fundingMethodBodySchema.parse(request.body);
      const result = await fundingService.linkFundingMethod({
        userId: params.userId,
        rail: body.rail,
        status: body.status,
        displayName: body.displayName,
        countryCode: body.countryCode,
        ...(body.provider ? { provider: body.provider } : {}),
        ...(body.providerReference
          ? { providerReference: body.providerReference }
          : {}),
        ...(body.last4 ? { last4: body.last4 } : {}),
        ...(body.metadata ? { metadata: body.metadata } : {}),
      });

      reply.status(201).send(result);
    },
  );

  app.post(
    '/internal/funding/users/:userId/wallet/seed',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = fundingUserParamsSchema.parse(request.params);
      const body = seedWalletBodySchema.parse(request.body);
      const result = await fundingService.seedWalletBalance({
        userId: params.userId,
        amountMinor: body.amountMinor,
        currency: body.currency,
        ...(body.referenceId ? { referenceId: body.referenceId } : {}),
      });

      reply.status(201).send(result);
    },
  );

  app.post(
    '/internal/funding/deposits/:depositId/settle',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = fundingDepositParamsSchema.parse(request.params);
      const result = await fundingService.settleDeposit(params.depositId);

      logWorkflowEvent(request, 'funding.deposit.settled', {
        transferId: result.deposit.id,
        amountMinor: result.deposit.amountMinor,
        currency: result.deposit.currency,
        alreadySettled: result.alreadySettled,
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/funding/withdrawals/:withdrawalId/approve',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = fundingWithdrawalParamsSchema.parse(request.params);
      const result = await fundingService.approveWithdrawalReview(
        params.withdrawalId,
      );

      logWorkflowEvent(request, 'funding.withdrawal.review_approved', {
        transferId: result.withdrawal.id,
        amountMinor: result.withdrawal.amountMinor,
        currency: result.withdrawal.currency,
        alreadyApproved: result.alreadyApproved,
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/funding/withdrawals/:withdrawalId/fail',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = fundingWithdrawalParamsSchema.parse(request.params);
      const result = await fundingService.failWithdrawal(
        params.withdrawalId,
        'manual_review_failure',
      );

      logWorkflowEvent(request, 'funding.withdrawal.failed', {
        transferId: result.withdrawal.id,
        amountMinor: result.withdrawal.amountMinor,
        currency: result.withdrawal.currency,
        alreadyFailed: result.alreadyFailed,
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/funding/withdrawals/:withdrawalId/settle',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = fundingWithdrawalParamsSchema.parse(request.params);
      const result = await fundingService.settleWithdrawal(params.withdrawalId);

      logWorkflowEvent(request, 'funding.withdrawal.settled', {
        transferId: result.withdrawal.id,
        amountMinor: result.withdrawal.amountMinor,
        currency: result.withdrawal.currency,
        alreadySettled: result.alreadySettled,
      });

      reply.status(200).send(result);
    },
  );

  app.post('/internal/funding/reconciliation/runs', async (request, reply) => {
    assertBootstrapToken(request);
    const body = reconciliationRunBodySchema.parse(request.body);
    const result = await fundingService.runTransferReconciliation({
      ...(body.provider ? { provider: body.provider } : {}),
      snapshots: body.snapshots,
    });

    logWorkflowEvent(request, 'funding.reconciliation.completed', {
      runId: result.run.id,
      scope: result.run.scope,
      status: result.run.status,
      discrepancyCount: result.discrepancies.length,
      provider: result.run.provider,
    });

    reply.status(201).send(result);
  });

  app.get('/internal/funding/reconciliation/discrepancies', async (request) => {
    assertBootstrapToken(request);
    const query = reconciliationDiscrepanciesQuerySchema.parse(request.query);

    return fundingService.listReconciliationDiscrepancies({
      unresolvedOnly: query.unresolvedOnly,
      limit: query.limit,
    });
  });

  app.post('/internal/funding/webhook-delay-scan', async (request, reply) => {
    assertBootstrapToken(request);
    const body = callbackDelayScanBodySchema.parse(request.body ?? {});
    const result = await fundingService.scanDelayedProviderCallbacks({
      limit: body.limit,
      ...(body.provider ? { provider: body.provider } : {}),
    });

    logWorkflowEvent(request, 'funding.callback_delay_scan.completed', {
      provider: body.provider ?? null,
      delayedTransferCount: result.delayedTransfers.length,
      alertsCreated: result.alertsCreated,
      thresholdMinutes: result.thresholdMinutes,
    });

    reply.status(200).send(result);
  });

  app.post('/webhooks/funding/providers/:provider', async (request, reply) => {
    const params = fundingWebhookProviderParamsSchema.parse(request.params);
    const body = fundingProviderWebhookBodySchema.parse(request.body);
    const timestamp = getWebhookTimestampFromRequest(request);
    const signature = getWebhookSignatureFromRequest(request);
    const signatureValid = verifyFundingWebhookSignature({
      secret: env.FUNDING_PROVIDER_WEBHOOK_SECRET,
      signature,
      timestamp,
      provider: params.provider,
      eventId: body.eventId,
      eventType: body.eventType,
      transferId: body.transferId,
      status: body.status,
      occurredAt: body.occurredAt,
      ...(body.providerTransferReference
        ? { providerTransferReference: body.providerTransferReference }
        : {}),
      ...(body.failureReason ? { failureReason: body.failureReason } : {}),
    });

    if (!signatureValid) {
      request.log.warn(
        {
          event: 'funding.provider_webhook.invalid_signature',
          requestId: request.id,
          provider: params.provider,
          eventId: body.eventId,
          transferId: body.transferId,
        },
        'funding.provider_webhook.invalid_signature',
      );

      throw new AppError(
        401,
        'invalid_webhook_signature',
        'webhook signature is invalid',
      );
    }

    const result = await fundingService.processProviderFundingWebhook({
      provider: params.provider,
      eventId: body.eventId,
      eventType: body.eventType,
      occurredAt: new Date(body.occurredAt),
      transferId: body.transferId,
      status: body.status,
      ...(body.providerTransferReference
        ? { providerTransferReference: body.providerTransferReference }
        : {}),
      ...(body.failureReason ? { failureReason: body.failureReason } : {}),
      payload: body,
    });

    logWorkflowEvent(request, 'funding.provider_webhook.applied', {
      provider: params.provider,
      eventId: result.webhookEvent.eventId,
      transferId: result.transfer.id,
      transferStatus: result.transfer.status,
      alreadyProcessed: result.alreadyProcessed,
    });

    reply.status(200).send(result);
  });
}

export async function registerFundingRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await fundingRoutes(app, options);
}
