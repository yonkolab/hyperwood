import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { createVerifiedSession } from '../helpers/auth';
import {
  linkFundingMethod,
  seedWallet,
  upsertApprovedComplianceProfile,
} from '../helpers/bootstrap';
import {
  buildFundingWebhookPayload,
  sendFundingWebhook,
} from '../helpers/webhooks';

describe('funding api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists only funding methods eligible for the requested currency', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    await linkFundingMethod(app, session.body.user.id as string, {
      rail: 'ach',
      countryCode: 'US',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/funding/methods?currency=USD',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().fundingAllowed).toBe(true);
    expect(response.json().fundingMethods).toHaveLength(1);
    expect(response.json().fundingMethods[0].rail).toBe('ach');
  });

  it('creates a deposit and shows the settled cash balance', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    const fundingMethod = await linkFundingMethod(
      app,
      session.body.user.id as string,
      {
        rail: 'ach',
        countryCode: 'US',
      },
    );

    const createDeposit = await app.inject({
      method: 'POST',
      url: '/api/v1/funding/deposits',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        fundingMethodId: fundingMethod.body.fundingMethod.id,
        amountMinor: 12_500,
        currency: 'USD',
      },
    });

    expect(createDeposit.statusCode).toBe(201);
    expect(createDeposit.json().deposit.status).toBe('pending');

    const settle = await app.inject({
      method: 'POST',
      url: `/api/v1/internal/funding/deposits/${createDeposit.json().deposit.id}/settle`,
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(settle.statusCode).toBe(200);
    expect(settle.json().deposit.status).toBe('settled');

    const wallet = await app.inject({
      method: 'GET',
      url: '/api/v1/wallet/balance?currency=USD',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(wallet.statusCode).toBe(200);
    expect(wallet.json().availableBalanceMinor).toBe(12_500);
    expect(wallet.json().currency).toBe('USD');
  });

  it('creates an in-review withdrawal when the amount exceeds the review threshold', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    const fundingMethod = await linkFundingMethod(
      app,
      session.body.user.id as string,
      {
        rail: 'ach',
        countryCode: 'US',
      },
    );
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 500_000,
      currency: 'USD',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/funding/withdrawals',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        fundingMethodId: fundingMethod.body.fundingMethod.id,
        amountMinor: 300_000,
        currency: 'USD',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().withdrawal.status).toBe('in_review');
  });

  it('settles a pending deposit from a valid signed provider webhook', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    const fundingMethod = await linkFundingMethod(
      app,
      session.body.user.id as string,
      {
        rail: 'ach',
        countryCode: 'US',
        provider: 'test-bank',
      },
    );

    const createDeposit = await app.inject({
      method: 'POST',
      url: '/api/v1/funding/deposits',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        fundingMethodId: fundingMethod.body.fundingMethod.id,
        amountMinor: 9_900,
        currency: 'USD',
      },
    });

    expect(createDeposit.statusCode).toBe(201);

    const payload = buildFundingWebhookPayload({
      transferId: createDeposit.json().deposit.id,
      status: 'settled',
      providerTransferReference: 'provider-deposit-123',
    });

    const response = await sendFundingWebhook(app, {
      provider: 'test-bank',
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().alreadyProcessed).toBe(false);
    expect(response.json().transfer.status).toBe('settled');
    expect(response.json().transfer.providerTransferReference).toBe(
      'provider-deposit-123',
    );

    const duplicate = await sendFundingWebhook(app, {
      provider: 'test-bank',
      payload,
    });

    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().alreadyProcessed).toBe(true);

    const wallet = await app.inject({
      method: 'GET',
      url: '/api/v1/wallet/balance?currency=USD',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(wallet.statusCode).toBe(200);
    expect(wallet.json().availableBalanceMinor).toBe(9_900);
  });

  it('rejects a funding provider webhook with an invalid signature', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    const fundingMethod = await linkFundingMethod(
      app,
      session.body.user.id as string,
      {
        rail: 'ach',
        countryCode: 'US',
        provider: 'test-bank',
      },
    );

    const createDeposit = await app.inject({
      method: 'POST',
      url: '/api/v1/funding/deposits',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        fundingMethodId: fundingMethod.body.fundingMethod.id,
        amountMinor: 4_200,
        currency: 'USD',
      },
    });

    expect(createDeposit.statusCode).toBe(201);

    const response = await sendFundingWebhook(app, {
      provider: 'test-bank',
      payload: buildFundingWebhookPayload({
        transferId: createDeposit.json().deposit.id,
        status: 'settled',
      }),
      secret: 'wrong-secret',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'invalid_webhook_signature',
      message: 'webhook signature is invalid',
    });
  });
});
