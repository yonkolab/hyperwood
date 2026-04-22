import { describe, expect, it } from 'vitest';
import {
  calculateSessionIdleExpiresAt,
  isSessionIdleExpired,
  shouldTouchSessionActivity,
} from '../../../../src/modules/identity/session-policy';

describe('session policy', () => {
  it('calculates idle expiry from the last seen timestamp', () => {
    const lastSeenAt = new Date('2026-04-22T12:00:00.000Z');

    expect(calculateSessionIdleExpiresAt(lastSeenAt, 24).toISOString()).toBe(
      '2026-04-23T12:00:00.000Z',
    );
  });

  it('detects idle-expired sessions', () => {
    const lastSeenAt = new Date('2026-04-20T12:00:00.000Z');
    const now = new Date('2026-04-22T12:00:00.000Z');

    expect(isSessionIdleExpired(lastSeenAt, now, 24)).toBe(true);
    expect(isSessionIdleExpired(lastSeenAt, now, 72)).toBe(false);
  });

  it('touches session activity only after the minimum interval', () => {
    const lastSeenAt = new Date('2026-04-22T12:00:00.000Z');

    expect(
      shouldTouchSessionActivity(
        lastSeenAt,
        new Date('2026-04-22T12:00:30.000Z'),
        60,
      ),
    ).toBe(false);
    expect(
      shouldTouchSessionActivity(
        lastSeenAt,
        new Date('2026-04-22T12:01:00.000Z'),
        60,
      ),
    ).toBe(true);
  });
});
