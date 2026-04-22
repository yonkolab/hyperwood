import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { createVerifiedSession } from '../helpers/auth';
import {
  createMarket,
  createMarketEvent,
  publishMarketAnnouncement,
  resolveMarket,
  runMarketMatch,
  seedWallet,
  settleMarket,
  transitionMarketStatus,
  upsertApprovedComplianceProfile,
  upsertExchangeSchedule,
} from '../helpers/bootstrap';
import { createMatchedMarketScenario } from '../helpers/trading';

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

async function readSseEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  eventName: string,
  timeoutMs = 5000,
) {
  const decoder = new TextDecoder();
  const timeoutAt = Date.now() + timeoutMs;
  let buffer = '';

  while (Date.now() < timeoutAt) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      if (!chunk.includes(`event: ${eventName}`)) {
        continue;
      }

      const dataLine = chunk
        .split('\n')
        .find((line) => line.startsWith('data: '));

      if (!dataLine) {
        continue;
      }

      return JSON.parse(dataLine.slice('data: '.length)) as Record<
        string,
        unknown
      >;
    }
  }

  throw new Error(`timed out waiting for SSE event ${eventName}`);
}

describe('markets api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists a bootstrapped market and returns its detail', async () => {
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/markets?limit=10',
    });

    expect(list.statusCode).toBe(200);
    expect(list.json().markets).toHaveLength(1);
    expect(list.json().markets[0].id).toBe(market.body.market.id);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${market.body.market.id}`,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().market.id).toBe(market.body.market.id);
    expect(detail.json().market.currency).toBe('USD');
  });

  it('returns empty order book and trade collections for a new market', async () => {
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string);

    const orderBook = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${market.body.market.id}/order-book`,
    });
    const trades = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${market.body.market.id}/trades`,
    });
    const deltas = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${market.body.market.id}/order-book/deltas`,
    });

    expect(orderBook.statusCode).toBe(200);
    expect(orderBook.json().books.yes.bids).toEqual([]);
    expect(orderBook.json().books.no.asks).toEqual([]);

    expect(trades.statusCode).toBe(200);
    expect(trades.json().trades).toEqual([]);

    expect(deltas.statusCode).toBe(200);
    expect(deltas.json().deltas).toEqual([]);
  });

  it('streams a market snapshot and subsequent public status updates', async () => {
    const streamApp = await buildTestApp();
    const event = await createMarketEvent(streamApp);
    const market = await createMarket(streamApp, event.body.event.id as string);
    const baseUrl = await streamApp.listen({ host: '127.0.0.1', port: 0 });
    const controller = new AbortController();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/markets/${market.body.market.id}/stream`,
        {
          signal: controller.signal,
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream',
      );

      const reader = response.body?.getReader();

      expect(reader).toBeDefined();

      if (!reader) {
        throw new Error('expected stream reader for market realtime response');
      }

      const snapshot = await readSseEvent(reader, 'snapshot');
      expect(snapshot.marketId).toBe(market.body.market.id);
      expect(snapshot.type).toBe('snapshot');
      expect(snapshot.data).toMatchObject({
        market: {
          id: market.body.market.id,
        },
      });

      await transitionMarketStatus(streamApp, market.body.market.id as string, {
        status: 'halted',
        reason: 'Realtime stream test transition.',
        changedBy: 'ops-stream-test',
      });

      const statusChanged = await readSseEvent(reader, 'status_changed');
      expect(statusChanged.marketId).toBe(market.body.market.id);
      expect(statusChanged.type).toBe('status_changed');
      expect(statusChanged.data).toMatchObject({
        trigger: 'market_status_updated',
        market: {
          id: market.body.market.id,
          status: 'halted',
        },
      });

      controller.abort();
    } finally {
      controller.abort();
      await streamApp.close();
    }
  });

  it('publishes and lists market announcements', async () => {
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string);

    const publish = await publishMarketAnnouncement(
      app,
      market.body.market.id as string,
      {
        title: 'Market under review',
        message:
          'Operations is reviewing the latest data feed for this market.',
        publishedBy: 'ops-admin',
      },
    );

    expect(publish.response.statusCode).toBe(201);
    expect(publish.body.announcement).toMatchObject({
      marketId: market.body.market.id,
      title: 'Market under review',
      message: 'Operations is reviewing the latest data feed for this market.',
      publishedBy: 'ops-admin',
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${market.body.market.id}/announcements`,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      marketId: market.body.market.id,
    });
    expect(list.json().announcements).toHaveLength(1);
    expect(list.json().announcements[0]).toMatchObject({
      title: 'Market under review',
      publishedBy: 'ops-admin',
    });
  });

  it('rejects internal market creation without the bootstrap token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/markets/events',
      payload: {
        slug: 'missing-token',
        title: 'Missing token',
        category: 'sports',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'invalid_bootstrap_token',
    });
  });

  it('resolves and settles a matched market through internal endpoints', async () => {
    const scenario = await createMatchedMarketScenario(app, {
      currency: 'USD',
      quantity: 10,
      limitPriceBps: 4800,
    });

    expect(scenario.buyOrder.statusCode).toBe(201);
    expect(scenario.sellOrder.statusCode).toBe(201);
    expect(scenario.match.response.statusCode).toBe(200);
    expect(scenario.match.body.summary.matchedTradeCount).toBe(1);

    const resolve = await resolveMarket(
      app,
      scenario.market.body.market.id as string,
      {
        outcome: 'yes',
        evidenceSummary: 'Official election authority certified the result.',
        evidenceSources: ['https://example.com/election-result'],
      },
    );

    expect(resolve.response.statusCode).toBe(200);
    expect(resolve.body.market.status).toBe('awaiting_resolution');
    expect(resolve.body.resolution.outcome).toBe('yes');

    const settle = await settleMarket(
      app,
      scenario.market.body.market.id as string,
    );

    expect(settle.response.statusCode).toBe(201);
    expect(settle.body.alreadySettled).toBe(false);
    expect(settle.body.settlement.outcome).toBe('yes');
    expect(settle.body.settlement.totalPayoutMinor).toBe(1_000);
    expect(settle.body.payouts).toHaveLength(2);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${scenario.market.body.market.id}`,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().market.status).toBe('settled');
    expect(detail.json().market.resolution.outcome).toBe('yes');
    expect(detail.json().market.settlement.totalPayoutMinor).toBe(1_000);
    expect(detail.json().market.yesPriceBps).toBe(10000);
    expect(detail.json().market.noPriceBps).toBe(0);
  });

  it('serves archived market trades through the historical path after settlement', async () => {
    const scenario = await createMatchedMarketScenario(app, {
      currency: 'USD',
      quantity: 10,
      limitPriceBps: 4800,
    });

    await resolveMarket(app, scenario.market.body.market.id as string, {
      outcome: 'yes',
      evidenceSummary: 'Official election authority certified the result.',
      evidenceSources: ['https://example.com/election-result'],
    });
    await settleMarket(app, scenario.market.body.market.id as string);

    const liveTrades = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${scenario.market.body.market.id}/trades`,
    });

    expect(liveTrades.statusCode).toBe(410);
    expect(liveTrades.json()).toMatchObject({
      error: 'historical_market_data',
    });

    const historicalTrades = await app.inject({
      method: 'GET',
      url: `/api/v1/historical/markets/${scenario.market.body.market.id}/trades?limit=10`,
    });

    expect(historicalTrades.statusCode).toBe(200);
    expect(historicalTrades.json().marketId).toBe(
      scenario.market.body.market.id,
    );
    expect(historicalTrades.json().trades).toHaveLength(1);
    expect(historicalTrades.json().trades[0]).toMatchObject({
      marketId: scenario.market.body.market.id,
      quantity: 10,
      priceBps: 4800,
      outcome: 'yes',
    });
  });

  it('halts a market, records transition history, and blocks new order entry until resumed', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 10_000,
      currency: 'USD',
      referenceId: 'halted-market-seed',
    });
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string, {
      status: 'active',
      currency: 'USD',
    });
    await upsertExchangeSchedule(app, {
      name: 'Open exchange for halted market test',
      timezone: 'UTC',
      weeklyWindows: [
        {
          weekday: getCurrentUtcWeekday(),
          opensAt: '00:00',
          closesAt: '23:59',
        },
      ],
      maintenanceWindows: [],
      notes:
        'Keeps exchange open so the halted market gate is the asserted behavior.',
    });

    const halt = await transitionMarketStatus(
      app,
      market.body.market.id as string,
      {
        status: 'halted',
        reason: 'Circuit breaker triggered.',
        changedBy: 'ops-admin',
      },
    );

    expect(halt.response.statusCode).toBe(200);
    expect(halt.body.alreadyApplied).toBe(false);
    expect(halt.body.market.status).toBe('halted');
    expect(halt.body.transition.toStatus).toBe('halted');

    const haltedOrder = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
        'idempotency-key': 'halted-market-order',
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

    expect(haltedOrder.statusCode).toBe(409);
    expect(haltedOrder.json().error).toBe('market_not_tradable');

    const resume = await transitionMarketStatus(
      app,
      market.body.market.id as string,
      {
        status: 'active',
        reason: 'Circuit breaker cleared.',
        changedBy: 'ops-admin',
      },
    );

    expect(resume.response.statusCode).toBe(200);
    expect(resume.body.market.status).toBe('active');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${market.body.market.id}`,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().market.statusTransitions).toHaveLength(3);
    expect(detail.json().market.statusTransitions[1]).toMatchObject({
      fromStatus: 'active',
      toStatus: 'halted',
      reason: 'Circuit breaker triggered.',
    });
    expect(detail.json().market.statusTransitions[2]).toMatchObject({
      fromStatus: 'halted',
      toStatus: 'active',
      reason: 'Circuit breaker cleared.',
    });
  });

  it('blocks settlement when a resolved market is marked as disputed', async () => {
    const scenario = await createMatchedMarketScenario(app, {
      currency: 'USD',
      quantity: 10,
      limitPriceBps: 4800,
    });

    await resolveMarket(app, scenario.market.body.market.id as string, {
      outcome: 'yes',
      evidenceSummary: 'Official election authority certified the result.',
      evidenceSources: ['https://example.com/election-result'],
    });

    const dispute = await transitionMarketStatus(
      app,
      scenario.market.body.market.id as string,
      {
        status: 'disputed',
        reason: 'Outcome challenged by review team.',
        changedBy: 'ops-review',
      },
    );

    expect(dispute.response.statusCode).toBe(200);
    expect(dispute.body.market.status).toBe('disputed');

    const settle = await settleMarket(
      app,
      scenario.market.body.market.id as string,
    );

    expect(settle.response.statusCode).toBe(409);
    expect(settle.body.error).toBe('market_not_settleable');
  });

  it('blocks internal matching while the exchange is under maintenance', async () => {
    const scenario = await createMatchedMarketScenario(app, {
      currency: 'USD',
      quantity: 10,
      limitPriceBps: 4800,
      match: false,
    });
    const now = Date.now();

    expect(scenario.buyOrder.statusCode).toBe(201);
    expect(scenario.sellOrder.statusCode).toBe(201);

    await upsertExchangeSchedule(app, {
      name: 'Maintenance matching gate schedule',
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
          message: 'Matching is disabled during maintenance.',
        },
      ],
      notes: 'Exchange should block internal matching during maintenance.',
    });

    const match = await runMarketMatch(
      app,
      scenario.market.body.market.id as string,
    );

    expect(match.response.statusCode).toBe(409);
    expect(match.body).toMatchObject({
      error: 'exchange_not_open',
    });
  });
});
