import type { FastifyInstance } from 'fastify';
import { signFundingWebhookPayload } from '../../src/lib/webhooks';

type FundingWebhookPayload = {
  eventId: string;
  eventType: 'funding.transfer.updated';
  occurredAt: string;
  transferId: string;
  status: 'pending' | 'in_review' | 'settled' | 'failed';
  providerTransferReference?: string;
  failureReason?: string;
};

export function buildFundingWebhookPayload(
  overrides: Partial<FundingWebhookPayload> & {
    transferId: string;
  },
): FundingWebhookPayload {
  return {
    eventId: `evt_${Date.now().toString(36)}`,
    eventType: 'funding.transfer.updated',
    occurredAt: new Date().toISOString(),
    status: 'settled',
    ...overrides,
  };
}

export function buildFundingWebhookHeaders(input: {
  provider: string;
  payload: FundingWebhookPayload;
  timestamp?: number;
  secret?: string;
}) {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = signFundingWebhookPayload(
    input.secret ?? (process.env.FUNDING_PROVIDER_WEBHOOK_SECRET as string),
    {
      timestamp,
      provider: input.provider,
      eventId: input.payload.eventId,
      eventType: input.payload.eventType,
      transferId: input.payload.transferId,
      status: input.payload.status,
      occurredAt: input.payload.occurredAt,
      ...(input.payload.providerTransferReference
        ? {
            providerTransferReference: input.payload.providerTransferReference,
          }
        : {}),
      ...(input.payload.failureReason
        ? { failureReason: input.payload.failureReason }
        : {}),
    },
  );

  return {
    'x-webhook-timestamp': String(timestamp),
    'x-webhook-signature': signature,
  };
}

export async function sendFundingWebhook(
  app: FastifyInstance,
  input: {
    provider: string;
    payload: FundingWebhookPayload;
    timestamp?: number;
    secret?: string;
  },
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/webhooks/funding/providers/${input.provider}`,
    headers: buildFundingWebhookHeaders(input),
    payload: input.payload,
  });
}
