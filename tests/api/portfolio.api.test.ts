import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { createVerifiedSession } from '../helpers/auth';
import { resolveMarket, seedWallet, settleMarket } from '../helpers/bootstrap';
import { createMatchedMarketScenario } from '../helpers/trading';

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
