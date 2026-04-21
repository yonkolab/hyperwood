import { and, count, eq, gte, or } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { loginEvents } from '../../db/schema';
import type { LoginEventOutcome } from './types';

export class LoginAuditService {
  /**
   * Load failed-login counters for the configured risk window.
   *
   * Example:
   * `await loginAuditService.getRecentFailedLoginCounts({ email, ipAddress })`
   */
  async getRecentFailedLoginCounts(input: {
    email: string;
    ipAddress: string | undefined;
  }) {
    const windowStart = new Date(
      Date.now() - env.LOGIN_RISK_WINDOW_MINUTES * 60 * 1000,
    );
    const failedOutcomes = or(
      eq(loginEvents.outcome, 'invalid_credentials'),
      eq(loginEvents.outcome, 'blocked_suspicious'),
    );

    const emailRows = await db
      .select({ value: count() })
      .from(loginEvents)
      .where(
        and(
          eq(loginEvents.email, input.email),
          gte(loginEvents.createdAt, windowStart),
          failedOutcomes,
        ),
      );

    if (!input.ipAddress) {
      return {
        emailFailures: Number(emailRows[0]?.value ?? 0),
        ipFailures: 0,
      };
    }

    const ipRows = await db
      .select({ value: count() })
      .from(loginEvents)
      .where(
        and(
          eq(loginEvents.ipAddress, input.ipAddress),
          gte(loginEvents.createdAt, windowStart),
          failedOutcomes,
        ),
      );

    return {
      emailFailures: Number(emailRows[0]?.value ?? 0),
      ipFailures: Number(ipRows[0]?.value ?? 0),
    };
  }

  exceedsLoginFailureThreshold(input: {
    emailFailures: number;
    ipFailures: number;
  }) {
    return (
      input.emailFailures >= env.LOGIN_MAX_FAILURES_PER_EMAIL ||
      input.ipFailures >= env.LOGIN_MAX_FAILURES_PER_IP
    );
  }

  /**
   * Persist one login security event for audit and throttling decisions.
   *
   * Example:
   * `await loginAuditService.recordLoginEvent({ ... })`
   */
  async recordLoginEvent(input: {
    userId: string | null;
    email: string;
    ipAddress: string | undefined;
    userAgent: string | undefined;
    outcome: LoginEventOutcome;
    suspicious: boolean;
    reason: string | undefined;
  }) {
    await db.insert(loginEvents).values({
      userId: input.userId,
      email: input.email,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      outcome: input.outcome,
      suspicious: input.suspicious,
      reason: input.reason,
    });
  }
}
