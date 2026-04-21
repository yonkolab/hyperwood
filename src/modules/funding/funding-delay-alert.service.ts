import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { fundingMethods, fundingTransfers } from '../../db/schema';
import type { OperationsAlertService } from '../operations/alerts';

export class FundingDelayAlertService {
  constructor(
    private readonly operationsAlertService: OperationsAlertService,
  ) {}

  /**
   * Scan provider-backed transfers that have waited too long for a callback.
   *
   * Example:
   * `await fundingDelayAlertService.scanDelayedProviderCallbacks({ limit: 50 })`
   */
  async scanDelayedProviderCallbacks(input: {
    limit: number;
    provider?: string;
  }) {
    const limit = Math.min(input.limit, 100);
    const thresholdMinutes = env.FUNDING_PROVIDER_CALLBACK_DELAY_MINUTES;
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);

    const rows = await db
      .select({
        id: fundingTransfers.id,
        type: fundingTransfers.type,
        status: fundingTransfers.status,
        amountMinor: fundingTransfers.amountMinor,
        currency: fundingTransfers.currency,
        requestedAt: fundingTransfers.requestedAt,
        fundingMethodId: fundingMethods.id,
        fundingMethodRail: fundingMethods.rail,
        fundingMethodDisplayName: fundingMethods.displayName,
        provider: fundingMethods.provider,
      })
      .from(fundingTransfers)
      .innerJoin(
        fundingMethods,
        eq(fundingMethods.id, fundingTransfers.fundingMethodId),
      )
      .where(
        and(
          input.provider
            ? eq(fundingMethods.provider, input.provider)
            : undefined,
          sql`${fundingMethods.provider} is not null`,
          sql`${fundingTransfers.requestedAt} <= ${cutoff}`,
          inArray(fundingTransfers.status, ['pending', 'in_review']),
        ),
      )
      .orderBy(desc(fundingTransfers.requestedAt))
      .limit(limit);

    const createdAlerts = [];

    for (const row of rows) {
      const delayMinutes = Math.floor(
        (Date.now() - row.requestedAt.getTime()) / 60_000,
      );
      const alert = await this.operationsAlertService.createAlert({
        category: 'funding_callback_delay',
        severity: 'critical',
        sourceType: 'funding_callback_delay',
        sourceId: row.id,
        message: `provider callback is delayed for ${row.type} transfer ${row.id}`,
        metadata: {
          transferId: row.id,
          transferType: row.type,
          transferStatus: row.status,
          amountMinor: row.amountMinor,
          currency: row.currency,
          provider: row.provider,
          fundingMethodId: row.fundingMethodId,
          fundingMethodRail: row.fundingMethodRail,
          requestedAt: row.requestedAt.toISOString(),
          thresholdMinutes,
          observedDelayMinutes: delayMinutes,
        },
      });

      if (alert) {
        createdAlerts.push(alert);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      thresholdMinutes,
      delayedTransfers: rows.map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        amountMinor: row.amountMinor,
        currency: row.currency,
        requestedAt: row.requestedAt.toISOString(),
        provider: row.provider,
        fundingMethod: {
          id: row.fundingMethodId,
          rail: row.fundingMethodRail,
          displayName: row.fundingMethodDisplayName,
        },
      })),
      alertsCreated: createdAlerts.length,
    };
  }
}
