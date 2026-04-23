import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';

const bootstrapHeaders = {
  'x-bootstrap-token':
    process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
};

async function createOperator(
  app: FastifyInstance,
  input: {
    email: string;
    displayName: string;
    roles: string[];
  },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/operators',
    headers: bootstrapHeaders,
    payload: input,
  });

  return {
    response,
    body: response.json(),
  };
}

async function createOperatorToken(
  app: FastifyInstance,
  operatorId: string,
  label: string,
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/operators/${operatorId}/tokens`,
    headers: bootstrapHeaders,
    payload: {
      label,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

describe('operator rbac api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows an operations operator to read feeds but not run scans', async () => {
    const operator = await createOperator(app, {
      email: 'operations-admin@example.com',
      displayName: 'Operations Admin',
      roles: ['operations_reader'],
    });

    expect(operator.response.statusCode).toBe(201);

    const token = await createOperatorToken(
      app,
      operator.body.operator.id as string,
      'read-only',
    );

    expect(token.response.statusCode).toBe(201);

    const reviews = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/operations/reviews?limit=10',
      headers: {
        'x-operator-token': token.body.token.rawToken,
      },
    });

    expect(reviews.statusCode).toBe(200);

    const scan = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/operations/settlement-failure-scan',
      headers: {
        'x-operator-token': token.body.token.rawToken,
      },
      payload: {
        limit: 10,
      },
    });

    expect(scan.statusCode).toBe(403);
    expect(scan.json()).toMatchObject({
      error: 'insufficient_operator_permission',
    });
  });

  it('allows a market operator to write markets but blocks settlement actions', async () => {
    const operator = await createOperator(app, {
      email: 'market-admin@example.com',
      displayName: 'Market Admin',
      roles: ['market_writer'],
    });

    expect(operator.response.statusCode).toBe(201);

    const token = await createOperatorToken(
      app,
      operator.body.operator.id as string,
      'market-write',
    );

    expect(token.response.statusCode).toBe(201);

    const event = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/markets/events',
      headers: {
        'x-operator-token': token.body.token.rawToken,
      },
      payload: {
        slug: `operator-market-${Date.now().toString(36)}`,
        title: 'Operator created event',
        category: 'politics',
      },
    });

    expect(event.statusCode).toBe(201);
    const eventBody = event.json();

    const market = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/markets',
      headers: {
        'x-operator-token': token.body.token.rawToken,
      },
      payload: {
        eventId: eventBody.event.id,
        slug: `operator-market-${Date.now().toString(36)}-market`,
        title: 'Operator created market',
        currency: 'USD',
        status: 'active',
        resolutionRules: 'Resolves YES if the event happens.',
        yesPriceBps: 5200,
        noPriceBps: 4800,
      },
    });

    expect(market.statusCode).toBe(201);
    const marketBody = market.json();

    const resolve = await app.inject({
      method: 'POST',
      url: `/api/v1/internal/markets/${marketBody.market.id}/resolve`,
      headers: {
        'x-operator-token': token.body.token.rawToken,
      },
      payload: {
        outcome: 'yes',
        evidenceSummary: 'Operator attempted settlement action.',
      },
    });

    expect(resolve.statusCode).toBe(403);
    expect(resolve.json()).toMatchObject({
      error: 'insufficient_operator_permission',
    });
  });

  it('rejects invalid operator tokens on internal routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/operations/reviews?limit=10',
      headers: {
        'x-operator-token': 'invalid-operator-token',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'invalid_operator_token',
    });
  });
});
