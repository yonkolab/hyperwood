import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import {
  createAuthenticatedSession,
  createVerifiedSession,
} from '../helpers/auth';
import {
  createMarket,
  createMarketEvent,
  seedWallet,
  upsertApprovedComplianceProfile,
  upsertExchangeSchedule,
} from '../helpers/bootstrap';

const weekdayNames = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function getCurrentUtcWeekday() {
  return weekdayNames[new Date().getUTCDay()];
}

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

  it('blocks new order entry while the exchange is under maintenance', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 10_000,
      currency: 'USD',
      referenceId: 'exchange-maintenance-seed',
    });
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string, {
      status: 'active',
      currency: 'USD',
    });
    const now = Date.now();

    await upsertExchangeSchedule(app, {
      name: 'Maintenance trading gate schedule',
      timezone: 'UTC',
      weeklyWindows: [
        {
          weekday: getCurrentUtcWeekday(),
          opensAt: '00:00',
          closesAt: '23:59',
        },
      ],
      maintenanceWindows: [
        {
          startsAt: new Date(now - 5 * 60 * 1000).toISOString(),
          endsAt: new Date(now + 5 * 60 * 1000).toISOString(),
          message: 'Emergency maintenance in progress.',
        },
      ],
      notes: 'Exchange should reject new orders during maintenance.',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
        'idempotency-key': 'exchange-maintenance-order',
      },
      payload: {
        marketId: market.body.market.id,
        type: 'limit',
        side: 'buy',
        outcome: 'yes',
        quantity: 10,
        limitPriceBps: 5200,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: 'exchange_not_open',
    });
  });
});
