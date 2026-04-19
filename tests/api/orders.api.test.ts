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
  runMarketMatch,
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

async function openExchangeForCurrentDay(app: FastifyInstance) {
  await upsertExchangeSchedule(app, {
    name: 'Open exchange schedule for order tests',
    timezone: 'UTC',
    weeklyWindows: [
      {
        weekday: getCurrentUtcWeekday(),
        opensAt: '00:00',
        closesAt: '23:59',
      },
    ],
    maintenanceWindows: [],
    notes: 'Keeps the exchange open for order workflow API tests.',
  });
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

  it('amends a resting limit order and releases excess reserve', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 10_000,
      currency: 'USD',
      referenceId: 'order-amend-seed',
    });
    await openExchangeForCurrentDay(app);
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string, {
      status: 'active',
      currency: 'USD',
    });

    const order = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
        'idempotency-key': 'resting-order-amend',
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

    expect(order.statusCode).toBe(201);

    const amended = await app.inject({
      method: 'PATCH',
      url: `/api/v1/orders/${order.json().order.id}`,
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        quantity: 8,
        limitPriceBps: 5000,
      },
    });

    expect(amended.statusCode).toBe(200);
    expect(amended.json()).toMatchObject({
      alreadyApplied: false,
      order: {
        quantity: 8,
        filledQuantity: 0,
        limitPriceBps: 5000,
        referencePriceBps: 5000,
        reservedAmountMinor: 400,
      },
      marketCommand: {
        commandType: 'order_amend',
      },
    });
  });

  it('decreases a partially-filled limit order without affecting filled quantity', async () => {
    const buyer = await createVerifiedSession(app);
    const seller = await createVerifiedSession(app);

    await Promise.all([
      upsertApprovedComplianceProfile(app, buyer.body.user.id as string),
      upsertApprovedComplianceProfile(app, seller.body.user.id as string),
      seedWallet(app, buyer.body.user.id as string, {
        amountMinor: 10_000,
        currency: 'USD',
        referenceId: 'partial-amend-buyer-seed',
      }),
      seedWallet(app, seller.body.user.id as string, {
        amountMinor: 10_000,
        currency: 'USD',
        referenceId: 'partial-amend-seller-seed',
      }),
    ]);

    await openExchangeForCurrentDay(app);
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string, {
      status: 'active',
      currency: 'USD',
      yesPriceBps: 5200,
      noPriceBps: 4800,
    });

    const buyOrder = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${buyer.sessionToken}`,
        'idempotency-key': 'partial-amend-buy',
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

    const sellOrder = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${seller.sessionToken}`,
        'idempotency-key': 'partial-amend-sell',
      },
      payload: {
        marketId: market.body.market.id,
        type: 'limit',
        side: 'sell',
        outcome: 'yes',
        quantity: 4,
        limitPriceBps: 5200,
      },
    });

    expect(buyOrder.statusCode).toBe(201);
    expect(sellOrder.statusCode).toBe(201);

    const match = await runMarketMatch(app, market.body.market.id as string);

    expect(match.response.statusCode).toBe(200);
    expect(match.body.summary.matchedTradeCount).toBe(1);

    const amended = await app.inject({
      method: 'PATCH',
      url: `/api/v1/orders/${buyOrder.json().order.id}`,
      headers: {
        authorization: `Bearer ${buyer.sessionToken}`,
      },
      payload: {
        quantity: 7,
      },
    });

    expect(amended.statusCode).toBe(200);
    expect(amended.json()).toMatchObject({
      alreadyApplied: false,
      order: {
        status: 'partially_filled',
        quantity: 7,
        filledQuantity: 4,
        limitPriceBps: 5200,
        reservedAmountMinor: 156,
      },
      marketCommand: {
        commandType: 'order_amend',
      },
    });
  });
});
