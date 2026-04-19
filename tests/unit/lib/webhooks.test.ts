import { describe, expect, it } from 'vitest';
import {
  buildFundingWebhookSignaturePayload,
  signFundingWebhookPayload,
  verifyFundingWebhookSignature,
} from '../../../src/lib/webhooks';

describe('funding webhook helpers', () => {
  it('builds a deterministic canonical signature payload', () => {
    const payload = buildFundingWebhookSignaturePayload({
      timestamp: 1_776_624_000,
      provider: 'test-bank',
      eventId: 'evt_123',
      eventType: 'funding.transfer.updated',
      transferId: '11111111-1111-4111-8111-111111111111',
      status: 'settled',
      occurredAt: '2026-04-19T22:00:00.000Z',
      providerTransferReference: 'provider-transfer-123',
      failureReason: 'none',
    });

    expect(payload).toBe(
      '1776624000\ntest-bank\nevt_123\nfunding.transfer.updated\n11111111-1111-4111-8111-111111111111\nsettled\n2026-04-19T22:00:00.000Z\nprovider-transfer-123\nnone',
    );
  });

  it('verifies a matching HMAC signature', () => {
    const signature = signFundingWebhookPayload('test-secret', {
      timestamp: 1_776_624_000,
      provider: 'test-bank',
      eventId: 'evt_456',
      eventType: 'funding.transfer.updated',
      transferId: '22222222-2222-4222-8222-222222222222',
      status: 'failed',
      occurredAt: '2026-04-19T22:05:00.000Z',
      failureReason: 'provider_timeout',
    });

    expect(
      verifyFundingWebhookSignature({
        secret: 'test-secret',
        signature,
        timestamp: 1_776_624_000,
        provider: 'test-bank',
        eventId: 'evt_456',
        eventType: 'funding.transfer.updated',
        transferId: '22222222-2222-4222-8222-222222222222',
        status: 'failed',
        occurredAt: '2026-04-19T22:05:00.000Z',
        failureReason: 'provider_timeout',
      }),
    ).toBe(true);
  });
});
