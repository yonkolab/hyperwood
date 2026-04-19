import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { createAuthenticatedSession } from '../helpers/auth';

describe('orders api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects order submission without an idempotency key', async () => {
    const session = await createAuthenticatedSession(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        marketId: '00000000-0000-0000-0000-000000000001',
        type: 'market',
        side: 'buy',
        outcome: 'yes',
        quantity: 10,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'missing_idempotency_key',
      message: 'missing idempotency-key header',
    });
  });

  it('returns a 400 for invalid limit-order payloads before reaching service logic', async () => {
    const session = await createAuthenticatedSession(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
        'idempotency-key': 'test-order-1',
      },
      payload: {
        marketId: '00000000-0000-0000-0000-000000000001',
        type: 'limit',
        side: 'buy',
        outcome: 'yes',
        quantity: 10,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'invalid_request',
    });
    expect(response.json().message).toContain(
      'limitPriceBps is required for limit orders',
    );
  });
});
