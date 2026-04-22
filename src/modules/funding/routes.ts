import { eq } from 'drizzle-orm';
import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { fundingTransfers } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { logWorkflowEvent } from '../../lib/observability';
import { verifyFundingWebhookSignature } from '../../lib/webhooks';
import {
  getSessionAuthContext,
  requireInternalAuth,
  requireSessionAuth,
} from '../identity/auth-guards';
import { IdentityService } from '../identity/service';
import { accountRealtimeService } from '../portfolio/account-realtime.service';
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

type FundingCurrency = 'USD' | 'BRL';

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

async function getFundingTransferOwner(transferId: string) {
  const rows = await db
    .select({
      userId: fundingTransfers.userId,
      currency: fundingTransfers.currency,
    })
    .from(fundingTransfers)
    .where(eq(fundingTransfers.id, transferId))
    .limit(1);
  const transfer = rows[0];

  if (!transfer) {
    throw new AppError(
      404,
      'funding_transfer_not_found',
      `funding transfer was not found for id ${transferId}`,
    );
  }

  return {
    userId: transfer.userId,
    currency: transfer.currency as FundingCurrency,
  };
}

async function publishTransferAndBalanceEvent(
  fundingService: FundingService,
  input: {
    userId: string;
    currency: FundingCurrency;
    transfer: Record<string, unknown>;
    trigger: string;
  },
) {
  const balance = await fundingService.getWalletBalance(
    input.userId,
    input.currency,
  );

  accountRealtimeService.publish({
    userId: input.userId,
    currency: input.currency,
    type: 'transfer_updated',
    data: {
      trigger: input.trigger,
      transfer: input.transfer,
    },
  });
  accountRealtimeService.publish({
    userId: input.userId,
    currency: input.currency,
    type: 'balance_updated',
    data: {
      trigger: input.trigger,
      balance,
    },
  });
}

async function fundingRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const fundingService = new FundingService();
  const requireSession = requireSessionAuth(identityService);
  const requireInternal = requireInternalAuth();

  app.get(
    '/funding/methods',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = fundingMethodsQuerySchema.parse(request.query);

      return fundingService.listEligibleFundingMethods(
        auth.user.id,
        query.currency,
      );
    },
  );

  app.get(
    '/wallet/balance',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = walletBalanceQuerySchema.parse(request.query);

      return fundingService.getWalletBalance(auth.user.id, query.currency);
    },
  );

  app.get(
    '/funding/deposits',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = listDepositsQuerySchema.parse(request.query);

      return fundingService.listDeposits(auth.user.id, {
        limit: query.limit,
        ...(query.currency ? { currency: query.currency } : {}),
      });
    },
  );

  app.post(
    '/funding/deposits',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const body = createDepositBodySchema.parse(request.body);
      const result = await fundingService.createDeposit({
        userId: auth.user.id,
        fundingMethodId: body.fundingMethodId,
        amountMinor: body.amountMinor,
        currency: body.currency,
      });

      logWorkflowEvent(request, 'funding.deposit.created', {
        userId: auth.user.id,
        transferId: result.deposit.id,
        amountMinor: result.deposit.amountMinor,
        currency: result.deposit.currency,
        rail: result.deposit.fundingMethod.rail,
        status: result.deposit.status,
      });

      await publishTransferAndBalanceEvent(fundingService, {
        userId: auth.user.id,
        currency: result.deposit.currency as 'USD' | 'BRL',
        transfer: result.deposit,
        trigger: 'deposit_created',
      });

      reply.status(201).send(result);
    },
  );

  app.get(
    '/funding/withdrawals',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);
      const query = listWithdrawalsQuerySchema.parse(request.query);

      return fundingService.listWithdrawals(auth.user.id, {
        limit: query.limit,
        ...(query.currency ? { currency: query.currency } : {}),
      });
    },
  );

  app.post(
    '/funding/withdrawals',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const body = createWithdrawalBodySchema.parse(request.body);
      const result = await fundingService.createWithdrawal({
        userId: auth.user.id,
        fundingMethodId: body.fundingMethodId,
        amountMinor: body.amountMinor,
        currency: body.currency,
      });

      logWorkflowEvent(request, 'funding.withdrawal.created', {
        userId: auth.user.id,
        transferId: result.withdrawal.id,
        amountMinor: result.withdrawal.amountMinor,
        currency: result.withdrawal.currency,
        rail: result.withdrawal.fundingMethod.rail,
        status: result.withdrawal.status,
      });

      await publishTransferAndBalanceEvent(fundingService, {
        userId: auth.user.id,
        currency: result.withdrawal.currency as 'USD' | 'BRL',
        transfer: result.withdrawal,
        trigger: 'withdrawal_created',
      });

      reply.status(201).send(result);
    },
  );

  app.post(
    '/internal/funding/users/:userId/methods',
    { preHandler: requireInternal },
    async (request, reply) => {
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
    { preHandler: requireInternal },
    async (request, reply) => {
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
    { preHandler: requireInternal },
    async (request, reply) => {
      const params = fundingDepositParamsSchema.parse(request.params);
      const result = await fundingService.settleDeposit(params.depositId);

      logWorkflowEvent(request, 'funding.deposit.settled', {
        transferId: result.deposit.id,
        amountMinor: result.deposit.amountMinor,
        currency: result.deposit.currency,
        alreadySettled: result.alreadySettled,
      });

      const transferOwner = await getFundingTransferOwner(result.deposit.id);

      await publishTransferAndBalanceEvent(fundingService, {
        userId: transferOwner.userId,
        currency: transferOwner.currency,
        transfer: result.deposit,
        trigger: result.alreadySettled
          ? 'deposit_settlement_replay'
          : 'deposit_settled',
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/funding/withdrawals/:withdrawalId/approve',
    { preHandler: requireInternal },
    async (request, reply) => {
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

      const transferOwner = await getFundingTransferOwner(result.withdrawal.id);

      await publishTransferAndBalanceEvent(fundingService, {
        userId: transferOwner.userId,
        currency: transferOwner.currency,
        transfer: result.withdrawal,
        trigger: result.alreadyApproved
          ? 'withdrawal_review_approval_replay'
          : 'withdrawal_review_approved',
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/funding/withdrawals/:withdrawalId/fail',
    { preHandler: requireInternal },
    async (request, reply) => {
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

      const transferOwner = await getFundingTransferOwner(result.withdrawal.id);

      await publishTransferAndBalanceEvent(fundingService, {
        userId: transferOwner.userId,
        currency: transferOwner.currency,
        transfer: result.withdrawal,
        trigger: result.alreadyFailed
          ? 'withdrawal_failure_replay'
          : 'withdrawal_failed',
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/funding/withdrawals/:withdrawalId/settle',
    { preHandler: requireInternal },
    async (request, reply) => {
      const params = fundingWithdrawalParamsSchema.parse(request.params);
      const result = await fundingService.settleWithdrawal(params.withdrawalId);

      logWorkflowEvent(request, 'funding.withdrawal.settled', {
        transferId: result.withdrawal.id,
        amountMinor: result.withdrawal.amountMinor,
        currency: result.withdrawal.currency,
        alreadySettled: result.alreadySettled,
      });

      const transferOwner = await getFundingTransferOwner(result.withdrawal.id);

      await publishTransferAndBalanceEvent(fundingService, {
        userId: transferOwner.userId,
        currency: transferOwner.currency,
        transfer: result.withdrawal,
        trigger: result.alreadySettled
          ? 'withdrawal_settlement_replay'
          : 'withdrawal_settled',
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/funding/reconciliation/runs',
    { preHandler: requireInternal },
    async (request, reply) => {
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
    },
  );

  app.get(
    '/internal/funding/reconciliation/discrepancies',
    { preHandler: requireInternal },
    async (request) => {
      const query = reconciliationDiscrepanciesQuerySchema.parse(request.query);

      return fundingService.listReconciliationDiscrepancies({
        unresolvedOnly: query.unresolvedOnly,
        limit: query.limit,
      });
    },
  );

  app.post(
    '/internal/funding/webhook-delay-scan',
    { preHandler: requireInternal },
    async (request, reply) => {
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
    },
  );

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

    const transferOwner = await getFundingTransferOwner(result.transfer.id);

    await publishTransferAndBalanceEvent(fundingService, {
      userId: transferOwner.userId,
      currency: transferOwner.currency,
      transfer: result.transfer,
      trigger: result.alreadyProcessed
        ? 'provider_webhook_replay'
        : 'provider_webhook_applied',
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
