import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';

describe('exchange api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('upserts and returns the active exchange schedule', async () => {
    const upsert = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/exchange/schedule',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        name: 'Hyperwood Weekday Schedule',
        timezone: 'America/Sao_Paulo',
        weeklyWindows: [
          {
            weekday: 'monday',
            opensAt: '09:00',
            closesAt: '18:00',
          },
          {
            weekday: 'tuesday',
            opensAt: '09:00',
            closesAt: '18:00',
          },
        ],
        maintenanceWindows: [
          {
            startsAt: '2026-04-20T02:00:00.000Z',
            endsAt: '2026-04-20T03:00:00.000Z',
            message: 'Database maintenance.',
          },
        ],
        notes: 'Weekday operation with planned maintenance windows.',
      },
    });

    expect(upsert.statusCode).toBe(201);
    expect(upsert.json()).toMatchObject({
      created: true,
      schedule: {
        name: 'Hyperwood Weekday Schedule',
        timezone: 'America/Sao_Paulo',
      },
    });
    expect(upsert.json().schedule.weeklyWindows).toHaveLength(2);

    const read = await app.inject({
      method: 'GET',
      url: '/api/v1/exchange/schedule',
    });

    expect(read.statusCode).toBe(200);
    expect(read.json().schedule).toMatchObject({
      name: 'Hyperwood Weekday Schedule',
      timezone: 'America/Sao_Paulo',
      notes: 'Weekday operation with planned maintenance windows.',
    });
    expect(read.json().schedule.maintenanceWindows).toHaveLength(1);
  });

  it('rejects internal exchange schedule updates without the bootstrap token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/exchange/schedule',
      payload: {
        name: 'Unauthorized schedule',
        timezone: 'UTC',
        weeklyWindows: [],
        maintenanceWindows: [],
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'invalid_bootstrap_token',
    });
  });
});
