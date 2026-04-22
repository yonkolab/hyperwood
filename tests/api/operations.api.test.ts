import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../src/db/client';
import {
  ledgerEntries,
  ledgerTransactions,
  marketResolutions,
  walletAccounts,
} from '../../src/db/schema';
import { buildTestApp } from '../helpers/app';
import { createVerifiedSession, registerUser } from '../helpers/auth';
import {
  createMarket,
  createMarketEvent,
  linkFundingMethod,
  resolveMarket,
  seedWallet,
  transitionMarketStatus,
  upsertApprovedComplianceProfile,
  upsertExchangeSchedule,
} from '../helpers/bootstrap';

describe('operations api', () => {
  let app: FastifyInstance;
  const authRateLimitMaxRequests = Number.parseInt(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS ?? '100',
    10,
  );

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists active withdrawal review items for internal operators', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    const fundingMethod = await linkFundingMethod(
      app,
      session.body.user.id as string,
    );
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 500_000,
      currency: 'USD',
    });

    const withdrawal = await app.inject({
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

    expect(withdrawal.statusCode).toBe(201);

    const queue = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/operations/reviews?limit=10',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(queue.statusCode).toBe(200);
    expect(queue.json().withdrawalReviews).toHaveLength(1);
    expect(queue.json().withdrawalReviews[0].withdrawalId).toBe(
      withdrawal.json().withdrawal.id,
    );
  });

  it('lists administrative audit events for market status transitions', async () => {
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string, {
      status: 'active',
      currency: 'USD',
    });

    const transition = await transitionMarketStatus(
      app,
      market.body.market.id as string,
      {
        status: 'halted',
        reason: 'Circuit breaker triggered.',
        changedBy: 'ops-admin',
      },
    );

    expect(transition.response.statusCode).toBe(200);

    const audit = await app.inject({
      method: 'GET',
      url: `/api/v1/internal/operations/audit-events?limit=10&targetType=market&targetId=${market.body.market.id}&action=market.status_updated`,
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(audit.statusCode).toBe(200);
    expect(audit.json().events).toHaveLength(1);
    expect(audit.json().events[0]).toMatchObject({
      action: 'market.status_updated',
      actor: 'ops-admin',
      targetType: 'market',
      targetId: market.body.market.id,
    });
    expect(audit.json().events[0].payload).toMatchObject({
      fromStatus: 'active',
      toStatus: 'halted',
      reason: 'Circuit breaker triggered.',
    });
  });

  it('lists persisted rate-limit exceed events for internal operators', async () => {
    const registration = await registerUser(app);

    expect(registration.response.statusCode).toBe(201);

    for (
      let attempt = 0;
      attempt < authRateLimitMaxRequests + 1;
      attempt += 1
    ) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/request-email-verification',
        payload: {
          email: registration.credentials.email,
        },
      });
    }

    const events = await app.inject({
      method: 'GET',
      url:
        '/api/v1/internal/operations/rate-limit-events' +
        `?limit=10&bucket=auth_external&scopeType=email&scopeKey=${encodeURIComponent(
          registration.credentials.email,
        )}&path=${encodeURIComponent('/api/v1/auth/request-email-verification')}`,
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(events.statusCode).toBe(200);
    expect(events.json().events).toHaveLength(1);
    expect(events.json().events[0]).toMatchObject({
      bucket: 'auth_external',
      scopeType: 'email',
      scopeKey: registration.credentials.email,
      method: 'POST',
      path: '/api/v1/auth/request-email-verification',
      limit: authRateLimitMaxRequests,
    });
    expect(events.json().events[0].observedCount).toBeGreaterThanOrEqual(
      authRateLimitMaxRequests + 1,
    );
  });

  it('lists persisted operational alerts for critical reconciliation discrepancies', async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    const fundingMethod = await linkFundingMethod(
      app,
      session.body.user.id as string,
    );

    const deposit = await app.inject({
      method: 'POST',
      url: '/api/v1/funding/deposits',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        fundingMethodId: fundingMethod.body.fundingMethod.id,
        amountMinor: 25_000,
        currency: 'USD',
      },
    });

    expect(deposit.statusCode).toBe(201);

    const reconciliation = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/funding/reconciliation/runs',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        provider: 'test-bank',
        snapshots: [
          {
            transferId: deposit.json().deposit.id,
            expectedStatus: 'settled',
          },
        ],
      },
    });

    expect(reconciliation.statusCode).toBe(201);
    expect(reconciliation.json().discrepancies).toHaveLength(1);

    const alerts = await app.inject({
      method: 'GET',
      url:
        '/api/v1/internal/operations/alerts' +
        '?limit=10&category=funding_reconciliation&severity=critical&status=open&sourceType=reconciliation_discrepancy',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(alerts.statusCode).toBe(200);
    expect(alerts.json().alerts).toHaveLength(1);
    expect(alerts.json().alerts[0]).toMatchObject({
      category: 'funding_reconciliation',
      severity: 'critical',
      status: 'open',
      sourceType: 'reconciliation_discrepancy',
      message:
        'authoritative transfer status did not match the internal status',
    });
    expect(alerts.json().alerts[0].metadata).toMatchObject({
      discrepancyType: 'status_mismatch',
      expectedStatus: 'settled',
      actualStatus: 'pending',
      provider: 'test-bank',
      transferId: deposit.json().deposit.id,
    });
  });

  it('scans ledger invariants and persists alerts for broken transactions and negative wallets', async () => {
    const session = await createVerifiedSession(app);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 500,
      currency: 'USD',
    });

    const walletRows = await db
      .select({
        id: walletAccounts.id,
      })
      .from(walletAccounts)
      .where(
        and(
          eq(walletAccounts.ownerUserId, session.body.user.id as string),
          eq(walletAccounts.type, 'user_cash'),
          eq(walletAccounts.currency, 'USD'),
        ),
      )
      .limit(1);
    const wallet = walletRows[0];

    expect(wallet).toBeDefined();

    if (!wallet) {
      throw new Error(
        'expected seeded USD cash wallet for invariant scan test',
      );
    }

    const transactionRows = await db
      .insert(ledgerTransactions)
      .values({
        referenceType: 'test_invariant_failure',
        referenceId: `wallet-${wallet.id}`,
      })
      .returning({ id: ledgerTransactions.id });
    const transaction = transactionRows[0];

    expect(transaction).toBeDefined();

    if (!transaction) {
      throw new Error(
        'expected test invariant transaction insert to return one id',
      );
    }

    await db.insert(ledgerEntries).values({
      transactionId: transaction.id,
      walletAccountId: wallet.id,
      side: 'debit',
      amountMinor: 1_000,
      currency: 'USD',
    });

    const scan = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/operations/ledger-invariant-scan',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        limit: 10,
      },
    });

    expect(scan.statusCode).toBe(200);
    expect(scan.json().alertsCreated).toBeGreaterThanOrEqual(2);
    expect(scan.json().imbalancedTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionId: transaction.id,
          debitTotalMinor: 1_000,
          creditTotalMinor: 0,
        }),
      ]),
    );
    expect(scan.json().negativeWalletBalances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletAccountId: wallet.id,
          balanceMinor: -500,
          currency: 'USD',
        }),
      ]),
    );

    const alerts = await app.inject({
      method: 'GET',
      url:
        '/api/v1/internal/operations/alerts' +
        '?limit=10&category=ledger_invariant&severity=critical&status=open',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(alerts.statusCode).toBe(200);
    expect(alerts.json().alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'ledger_invariant',
          severity: 'critical',
          sourceType: 'ledger_transaction',
          sourceId: transaction.id,
          message: 'ledger transaction debits and credits are not balanced',
        }),
        expect.objectContaining({
          category: 'ledger_invariant',
          severity: 'critical',
          sourceType: 'wallet_account',
          sourceId: wallet.id,
          message: 'user wallet balance is negative',
        }),
      ]),
    );
  });

  it('scans stalled settlements and persists alerts for resolved markets that were not settled', async () => {
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string, {
      status: 'active',
      currency: 'USD',
    });

    const resolution = await resolveMarket(
      app,
      market.body.market.id as string,
      {
        outcome: 'yes',
        evidenceSummary: 'Settlement failure alert test resolution.',
        evidenceSources: ['https://example.com/settlement-failure-test'],
        approvedBy: 'ops-alert-test',
      },
    );

    const oldApprovedAt = new Date(Date.now() - 31 * 60_000);

    await db
      .update(marketResolutions)
      .set({
        approvedAt: oldApprovedAt,
        updatedAt: oldApprovedAt,
      })
      .where(eq(marketResolutions.id, resolution.body.resolution.id as string));

    const scan = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/operations/settlement-failure-scan',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        limit: 10,
      },
    });

    expect(scan.statusCode).toBe(200);
    expect(scan.json().alertsCreated).toBeGreaterThanOrEqual(1);
    expect(scan.json().stalledSettlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marketId: market.body.market.id,
          marketCurrency: 'USD',
          marketStatus: 'awaiting_resolution',
          resolutionId: resolution.body.resolution.id,
          outcome: 'yes',
        }),
      ]),
    );

    const alerts = await app.inject({
      method: 'GET',
      url:
        '/api/v1/internal/operations/alerts' +
        '?limit=10&category=market_settlement_failure&severity=critical&status=open&sourceType=market',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(alerts.statusCode).toBe(200);
    expect(alerts.json().alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'market_settlement_failure',
          severity: 'critical',
          sourceType: 'market',
          sourceId: market.body.market.id,
          message:
            'resolved market has not been settled within the configured threshold',
        }),
      ]),
    );
    expect(alerts.json().alerts[0].metadata).toMatchObject({
      marketTitle: market.body.market.title,
      marketCurrency: 'USD',
      marketStatus: 'awaiting_resolution',
      resolutionId: resolution.body.resolution.id,
      outcome: 'yes',
      thresholdMinutes: 30,
    });
  });

  it('scans unusual trading conditions and persists alerts for crossed active books', async () => {
    const buyer = await createVerifiedSession(app);
    const seller = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, buyer.body.user.id as string);
    await upsertApprovedComplianceProfile(app, seller.body.user.id as string);
    await seedWallet(app, buyer.body.user.id as string, {
      amountMinor: 10_000,
      currency: 'USD',
    });
    await seedWallet(app, seller.body.user.id as string, {
      amountMinor: 10_000,
      currency: 'USD',
    });
    await upsertExchangeSchedule(app, {
      name: 'Trading condition open schedule',
      timezone: 'UTC',
      weeklyWindows: [
        {
          weekday: 'monday',
          opensAt: '00:00',
          closesAt: '23:59',
        },
        {
          weekday: 'tuesday',
          opensAt: '00:00',
          closesAt: '23:59',
        },
        {
          weekday: 'wednesday',
          opensAt: '00:00',
          closesAt: '23:59',
        },
        {
          weekday: 'thursday',
          opensAt: '00:00',
          closesAt: '23:59',
        },
        {
          weekday: 'friday',
          opensAt: '00:00',
          closesAt: '23:59',
        },
        {
          weekday: 'saturday',
          opensAt: '00:00',
          closesAt: '23:59',
        },
        {
          weekday: 'sunday',
          opensAt: '00:00',
          closesAt: '23:59',
        },
      ],
      maintenanceWindows: [],
      notes: 'Keeps exchange open during trading condition alert test.',
    });

    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string, {
      status: 'active',
      currency: 'USD',
      yesPriceBps: 5000,
      noPriceBps: 5000,
    });

    const buyOrder = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${buyer.sessionToken}`,
        'idempotency-key': 'trading-condition-buy-order',
      },
      payload: {
        marketId: market.body.market.id,
        type: 'limit',
        side: 'buy',
        outcome: 'yes',
        quantity: 10,
        limitPriceBps: 5600,
      },
    });

    expect(buyOrder.statusCode).toBe(201);

    const sellOrder = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${seller.sessionToken}`,
        'idempotency-key': 'trading-condition-sell-order',
      },
      payload: {
        marketId: market.body.market.id,
        type: 'limit',
        side: 'sell',
        outcome: 'yes',
        quantity: 10,
        limitPriceBps: 5400,
      },
    });

    expect(sellOrder.statusCode).toBe(201);

    const scan = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/operations/trading-condition-scan',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        limit: 10,
      },
    });

    expect(scan.statusCode).toBe(200);
    expect(scan.json().alertsCreated).toBeGreaterThanOrEqual(1);
    expect(scan.json().affectedMarkets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marketId: market.body.market.id,
          marketCurrency: 'USD',
          marketStatus: 'active',
          crossedOutcomes: [
            expect.objectContaining({
              outcome: 'yes',
              bestBidPriceBps: 5600,
              bestAskPriceBps: 5400,
            }),
          ],
        }),
      ]),
    );

    const alerts = await app.inject({
      method: 'GET',
      url:
        '/api/v1/internal/operations/alerts' +
        '?limit=10&category=unusual_trading_condition&severity=critical&status=open&sourceType=market',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(alerts.statusCode).toBe(200);
    expect(alerts.json().alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'unusual_trading_condition',
          severity: 'critical',
          sourceType: 'market',
          sourceId: market.body.market.id,
          message: 'active market has a crossed resting book',
        }),
      ]),
    );
    expect(alerts.json().alerts[0].metadata).toMatchObject({
      marketTitle: market.body.market.title,
      marketCurrency: 'USD',
      marketStatus: 'active',
      crossedOutcomes: [
        expect.objectContaining({
          outcome: 'yes',
          bestBidPriceBps: 5600,
          bestAskPriceBps: 5400,
        }),
      ],
    });
  });

  it('scans stale realtime streams and persists alerts for idle SSE subscriptions', async () => {
    const streamApp = await buildTestApp();
    const event = await createMarketEvent(streamApp);
    const market = await createMarket(
      streamApp,
      event.body.event.id as string,
      {
        status: 'active',
        currency: 'USD',
      },
    );
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
      await new Promise((resolve) => setTimeout(resolve, 25));

      const scan = await streamApp.inject({
        method: 'POST',
        url: '/api/v1/internal/operations/realtime-stream-health-scan',
        headers: {
          'x-bootstrap-token':
            process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
        },
        payload: {
          limit: 10,
          maxIdleSeconds: 0,
        },
      });

      expect(scan.statusCode).toBe(200);
      expect(scan.json().alertsCreated).toBeGreaterThanOrEqual(1);
      expect(scan.json().thresholdSeconds).toBe(0);
      expect(scan.json().staleStreams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            streamType: 'market',
            marketId: market.body.market.id,
            idleSeconds: expect.any(Number),
          }),
        ]),
      );

      const staleStream = scan
        .json()
        .staleStreams.find(
          (entry: { marketId?: string; streamType?: string }) =>
            entry.marketId === market.body.market.id &&
            entry.streamType === 'market',
        );

      expect(staleStream).toBeDefined();

      const alerts = await streamApp.inject({
        method: 'GET',
        url:
          '/api/v1/internal/operations/alerts' +
          '?limit=10&category=realtime_stream_outage&severity=critical&status=open&sourceType=realtime_market_stream',
        headers: {
          'x-bootstrap-token':
            process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
        },
      });

      expect(alerts.statusCode).toBe(200);
      expect(alerts.json().alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'realtime_stream_outage',
            severity: 'critical',
            sourceType: 'realtime_market_stream',
            sourceId: staleStream.subscriptionId,
          }),
        ]),
      );
      expect(alerts.json().alerts[0].metadata).toMatchObject({
        streamType: 'market',
        marketId: market.body.market.id,
        thresholdSeconds: 0,
      });

      controller.abort();
    } finally {
      controller.abort();
      await streamApp.close();
    }
  });
});
