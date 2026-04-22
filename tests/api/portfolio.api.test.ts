import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { createVerifiedSession } from '../helpers/auth';
import {
  createMarket,
  createMarketEvent,
  resolveMarket,
  seedWallet,
  settleMarket,
  upsertApprovedComplianceProfile,
  upsertExchangeSchedule,
} from '../helpers/bootstrap';
import { createMatchedMarketScenario } from '../helpers/trading';

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

describe('portfolio api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns wallet-derived portfolio cash and empty positions', async () => {
    const session = await createVerifiedSession(app);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 20_000,
      currency: 'USD',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio?currency=USD',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().currency).toBe('USD');
    expect(response.json().cash.availableBalanceMinor).toBe(20_000);
    expect(response.json().positions).toEqual([]);
    expect(response.json().recentFills).toEqual([]);
  });

  it('returns an empty fills collection for a new user', async () => {
    const session = await createVerifiedSession(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio/fills?currency=USD&limit=10',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      currency: 'USD',
      fills: [],
    });
  });

  it('streams an authenticated account snapshot and subsequent order updates', async () => {
    const streamApp = await buildTestApp();
    const session = await createVerifiedSession(streamApp);
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

    await upsertApprovedComplianceProfile(
      streamApp,
      session.body.user.id as string,
    );
    await seedWallet(streamApp, session.body.user.id as string, {
      amountMinor: 10_000,
      currency: 'USD',
      referenceId: 'account-stream-seed',
    });
    await upsertExchangeSchedule(streamApp, {
      name: 'Account stream open schedule',
      timezone: 'UTC',
      weeklyWindows: [
        {
          weekday: currentWeekday,
          opensAt: '00:00',
          closesAt: '23:59',
        },
      ],
      maintenanceWindows: [],
      notes: 'Keeps exchange open during private account realtime test.',
    });
    const event = await createMarketEvent(streamApp);
    const market = await createMarket(
      streamApp,
      event.body.event.id as string,
      {
        currency: 'USD',
        status: 'active',
        yesPriceBps: 5200,
        noPriceBps: 4800,
      },
    );
    const baseUrl = await streamApp.listen({ host: '127.0.0.1', port: 0 });
    const controller = new AbortController();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/portfolio/stream?currency=USD`,
        {
          headers: {
            Authorization: `Bearer ${session.sessionToken}`,
          },
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
        throw new Error('expected stream reader for account realtime response');
      }

      const snapshot = await readSseEvent(reader, 'account_snapshot');
      expect(snapshot.userId).toBe(session.body.user.id);
      expect(snapshot.currency).toBe('USD');
      expect(snapshot.data).toMatchObject({
        portfolioSummary: {
          currency: 'USD',
        },
      });

      const orderResponse = await streamApp.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
          authorization: `Bearer ${session.sessionToken}`,
          'idempotency-key': 'account-stream-order',
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

      expect(orderResponse.statusCode).toBe(201);

      const orderUpdated = await readSseEvent(reader, 'order_updated');
      expect(orderUpdated.userId).toBe(session.body.user.id);
      expect(orderUpdated.currency).toBe('USD');
      expect(orderUpdated.data).toMatchObject({
        order: {
          marketId: market.body.market.id,
          status: 'queued_for_matching',
        },
      });

      controller.abort();
    } finally {
      controller.abort();
      await streamApp.close();
    }
  });

  it('returns settlement history and clears open positions after settlement', async () => {
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

    const summary = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio?currency=USD',
      headers: {
        authorization: `Bearer ${scenario.buyer.sessionToken}`,
      },
    });

    expect(summary.statusCode).toBe(200);
    expect(summary.json().positions).toEqual([]);
    expect(summary.json().cash.positionCollateralMinor).toBe(0);
    expect(summary.json().cash.availableBalanceMinor).toBe(10_520);

    const settlements = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio/settlements?currency=USD&limit=10',
      headers: {
        authorization: `Bearer ${scenario.buyer.sessionToken}`,
      },
    });

    expect(settlements.statusCode).toBe(200);
    expect(settlements.json().currency).toBe('USD');
    expect(settlements.json().settlements).toHaveLength(1);
    expect(settlements.json().settlements[0]).toMatchObject({
      marketId: scenario.market.body.market.id,
      outcome: 'yes',
      quantity: 10,
      costBasisMinor: 480,
      payoutMinor: 1000,
      netPnlMinor: 520,
    });
  });

  it('creates, lists, and retrieves account history export jobs', async () => {
    const session = await createVerifiedSession(app);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 12_500,
      currency: 'USD',
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/portfolio/exports',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        currency: 'USD',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().exportJob).toMatchObject({
      scope: 'account_history',
      status: 'completed',
      format: 'json',
      currency: 'USD',
    });

    const exportJobId = createResponse.json().exportJob.id as string;

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio/exports?currency=USD&limit=10',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().currency).toBe('USD');
    expect(listResponse.json().exportJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: exportJobId,
          scope: 'account_history',
          status: 'completed',
        }),
      ]),
    );

    const artifactResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/portfolio/exports/${exportJobId}`,
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(artifactResponse.statusCode).toBe(200);
    expect(artifactResponse.json()).toMatchObject({
      exportJob: {
        id: exportJobId,
        currency: 'USD',
      },
      artifact: {
        exportType: 'account_history',
        currency: 'USD',
        portfolioSummary: {
          currency: 'USD',
          cash: {
            availableBalanceMinor: 12_500,
          },
        },
        fills: [],
        settlements: [],
      },
    });
    expect(artifactResponse.json().artifact.ledgerActivity).toEqual(
      expect.any(Array),
    );
    expect(artifactResponse.json().artifact.generatedAt).toEqual(
      expect.any(String),
    );
  });
});
