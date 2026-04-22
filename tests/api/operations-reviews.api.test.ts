import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../src/db/client';
import { marketResolutions } from '../../src/db/schema';
import { buildTestApp } from '../helpers/app';
import {
  createMarket,
  createMarketEvent,
  resolveMarket,
} from '../helpers/bootstrap';

describe('operations review workflows api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists stalled market settlements in the operations review queue', async () => {
    const { marketId, resolutionId } =
      await createStalledSettlementCandidate(app);

    const queue = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/operations/reviews?limit=10',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(queue.statusCode).toBe(200);
    expect(queue.json().settlementRetries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marketId,
          resolutionId,
          marketStatus: 'awaiting_resolution',
          outcome: 'yes',
          thresholdMinutes: 30,
        }),
      ]),
    );
  });

  it('retries a stalled market settlement for internal operators', async () => {
    const { marketId } = await createStalledSettlementCandidate(app);

    const retry = await app.inject({
      method: 'POST',
      url: `/api/v1/internal/operations/settlement-retries/${marketId}`,
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        requestedBy: 'ops-retry-test',
      },
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toMatchObject({
      marketId,
      alreadySettled: false,
      settlement: expect.objectContaining({
        outcome: 'yes',
        totalPayoutMinor: 0,
      }),
    });

    const queue = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/operations/reviews?limit=10',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(queue.statusCode).toBe(200);
    expect(queue.json().settlementRetries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marketId,
        }),
      ]),
    );

    const audit = await app.inject({
      method: 'GET',
      url: `/api/v1/internal/operations/audit-events?limit=10&targetType=market&targetId=${marketId}&action=market.settlement_retry_requested`,
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
    });

    expect(audit.statusCode).toBe(200);
    expect(audit.json().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'market.settlement_retry_requested',
          actor: 'ops-retry-test',
          targetType: 'market',
          targetId: marketId,
        }),
      ]),
    );
  });
});

async function createStalledSettlementCandidate(app: FastifyInstance) {
  const event = await createMarketEvent(app);
  const market = await createMarket(app, event.body.event.id as string, {
    status: 'active',
    currency: 'USD',
  });
  const resolution = await resolveMarket(app, market.body.market.id as string, {
    outcome: 'yes',
    evidenceSummary: 'Settlement retry review test resolution.',
    evidenceSources: ['https://example.com/settlement-retry-review-test'],
    approvedBy: 'ops-review-test',
  });
  const oldApprovedAt = new Date(Date.now() - 31 * 60_000);

  await db
    .update(marketResolutions)
    .set({
      approvedAt: oldApprovedAt,
      updatedAt: oldApprovedAt,
    })
    .where(eq(marketResolutions.id, resolution.body.resolution.id as string));

  return {
    marketId: market.body.market.id as string,
    resolutionId: resolution.body.resolution.id as string,
  };
}
