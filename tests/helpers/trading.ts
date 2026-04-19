import type { FastifyInstance } from 'fastify';
import { createVerifiedSession } from './auth';
import {
  createMarket,
  createMarketEvent,
  runMarketMatch,
  seedWallet,
  upsertApprovedComplianceProfile,
  upsertExchangeSchedule,
} from './bootstrap';

export async function createMatchedMarketScenario(
  app: FastifyInstance,
  overrides: Partial<{
    currency: 'USD' | 'BRL';
    quantity: number;
    limitPriceBps: number;
    match: boolean;
  }> = {},
) {
  const currency = overrides.currency ?? 'USD';
  const quantity = overrides.quantity ?? 10;
  const limitPriceBps = overrides.limitPriceBps ?? 4800;
  const shouldMatch = overrides.match ?? true;
  const weekdayNames = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;
  const currentWeekday = weekdayNames[new Date().getUTCDay()];

  const buyer = await createVerifiedSession(app);
  const seller = await createVerifiedSession(app);

  await Promise.all([
    upsertApprovedComplianceProfile(app, buyer.body.user.id as string),
    upsertApprovedComplianceProfile(app, seller.body.user.id as string),
    seedWallet(app, buyer.body.user.id as string, {
      amountMinor: 10_000,
      currency,
      referenceId: `seed-${currency.toLowerCase()}-buyer`,
    }),
    seedWallet(app, seller.body.user.id as string, {
      amountMinor: 10_000,
      currency,
      referenceId: `seed-${currency.toLowerCase()}-seller`,
    }),
  ]);

  await upsertExchangeSchedule(app, {
    name: 'Always-on API test schedule',
    timezone: 'UTC',
    weeklyWindows: [
      {
        weekday: currentWeekday,
        opensAt: '00:00',
        closesAt: '23:59',
      },
    ],
    maintenanceWindows: [],
    notes: 'Keeps exchange trading open during API matching tests.',
  });

  const event = await createMarketEvent(app, {
    category: 'politics',
  });
  const market = await createMarket(app, event.body.event.id as string, {
    currency,
    status: 'active',
    yesPriceBps: limitPriceBps,
    noPriceBps: 10000 - limitPriceBps,
  });

  const buyOrder = await app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    headers: {
      authorization: `Bearer ${buyer.sessionToken}`,
      'idempotency-key': `buy-${Date.now().toString(36)}`,
    },
    payload: {
      marketId: market.body.market.id,
      type: 'limit',
      side: 'buy',
      outcome: 'yes',
      quantity,
      limitPriceBps,
    },
  });

  const sellOrder = await app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    headers: {
      authorization: `Bearer ${seller.sessionToken}`,
      'idempotency-key': `sell-${Date.now().toString(36)}`,
    },
    payload: {
      marketId: market.body.market.id,
      type: 'limit',
      side: 'sell',
      outcome: 'yes',
      quantity,
      limitPriceBps,
    },
  });

  const match = shouldMatch
    ? await runMarketMatch(app, market.body.market.id as string)
    : null;

  return {
    currency,
    quantity,
    limitPriceBps,
    buyer,
    seller,
    event,
    market,
    buyOrder,
    sellOrder,
    match,
  };
}
