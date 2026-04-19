import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { upsertExchangeSchedule } from '../helpers/bootstrap';

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

function getActiveMaintenanceWindow() {
  const now = Date.now();

  return {
    startsAt: new Date(now - 5 * 60 * 1000).toISOString(),
    endsAt: new Date(now + 5 * 60 * 1000).toISOString(),
    message: 'Scheduled maintenance in progress.',
  };
}

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

  it('returns open status when the current time is inside a scheduled trading window', async () => {
    await upsertExchangeSchedule(app, {
      name: 'Open exchange status schedule',
      timezone: 'UTC',
      weeklyWindows: [
        {
          weekday: getCurrentUtcWeekday(),
          opensAt: '00:00',
          closesAt: '23:59',
        },
      ],
      maintenanceWindows: [],
      notes: 'Exchange stays open for the full current UTC day.',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/exchange/status',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'open',
      reason: 'within_scheduled_hours',
      tradingAllowed: true,
      activeWindow: {
        weekday: getCurrentUtcWeekday(),
      },
    });
  });

  it('returns maintenance status when an active maintenance window is present', async () => {
    await upsertExchangeSchedule(app, {
      name: 'Maintenance status schedule',
      timezone: 'UTC',
      weeklyWindows: [
        {
          weekday: getCurrentUtcWeekday(),
          opensAt: '00:00',
          closesAt: '23:59',
        },
      ],
      maintenanceWindows: [getActiveMaintenanceWindow()],
      notes: 'Exchange is in active maintenance for this test.',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/exchange/status',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'maintenance',
      reason: 'maintenance_window',
      tradingAllowed: false,
      activeWindow: null,
      activeMaintenanceWindow: {
        message: 'Scheduled maintenance in progress.',
      },
    });
  });

  it('publishes and returns the active exchange fee schedule by currency', async () => {
    const firstPublish = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/exchange/fees',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        name: 'Hyperwood BRL launch fees',
        currency: 'BRL',
        makerFeeBps: 20,
        takerFeeBps: 55,
        effectiveFrom: '2026-04-17T00:00:00.000Z',
        notes: 'Launch fee schedule for BRL markets.',
        publishedBy: 'ops@hyperwood.internal',
      },
    });

    expect(firstPublish.statusCode).toBe(201);
    expect(firstPublish.json()).toMatchObject({
      feeSchedule: {
        currency: 'BRL',
        makerFeeBps: 20,
        takerFeeBps: 55,
      },
    });

    const secondPublish = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/exchange/fees',
      headers: {
        'x-bootstrap-token':
          process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
      },
      payload: {
        name: 'Hyperwood BRL standard fees',
        currency: 'BRL',
        makerFeeBps: 25,
        takerFeeBps: 60,
        effectiveFrom: '2026-04-18T00:00:00.000Z',
        notes: 'Standard fee schedule for BRL markets.',
      },
    });

    expect(secondPublish.statusCode).toBe(201);

    const read = await app.inject({
      method: 'GET',
      url: '/api/v1/exchange/fees?currency=BRL',
    });

    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({
      feeSchedules: [
        {
          currency: 'BRL',
          makerFeeBps: 25,
          takerFeeBps: 60,
          notes: 'Standard fee schedule for BRL markets.',
        },
      ],
    });
  });

  it('rejects internal exchange fee publishes without the bootstrap token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/exchange/fees',
      payload: {
        name: 'Unauthorized fee schedule',
        currency: 'USD',
        makerFeeBps: 10,
        takerFeeBps: 20,
        effectiveFrom: '2026-04-20T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'invalid_bootstrap_token',
    });
  });
});
