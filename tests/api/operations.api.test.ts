import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { createVerifiedSession, registerUser } from '../helpers/auth';
import {
  createMarket,
  createMarketEvent,
  linkFundingMethod,
  seedWallet,
  transitionMarketStatus,
  upsertApprovedComplianceProfile,
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
});
