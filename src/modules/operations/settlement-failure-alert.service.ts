import { and, eq, isNull, lte } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { marketResolutions, marketSettlements, markets } from '../../db/schema';
import { OperationsAlertService } from './alerts';

type SettlementFailureCandidate = {
  marketId: string;
  marketTitle: string;
  marketCurrency: string;
  marketStatus: string;
  resolutionId: string;
  outcome: string;
  approvedAt: string;
  retryEligibleAt: string;
  thresholdMinutes: number;
};

export class SettlementFailureAlertService {
  private readonly operationsAlertService = new OperationsAlertService();

  /**
   * Scan for resolved markets that remain unsettled beyond the configured threshold.
   *
   * Example:
   * `await settlementFailureAlertService.scan({ limit: 25 })`
   */
  async scan(input: { limit: number }) {
    const stalledSettlements = await this.listStalledSettlements({
      limit: input.limit,
    });
    const thresholdMinutes =
      stalledSettlements[0]?.thresholdMinutes ??
      env.MARKET_SETTLEMENT_FAILURE_MINUTES;

    let alertsCreated = 0;

    for (const stalledSettlement of stalledSettlements) {
      const alert = await this.operationsAlertService.createAlert({
        category: 'market_settlement_failure',
        severity: 'critical',
        sourceType: 'market',
        sourceId: stalledSettlement.marketId,
        message:
          'resolved market has not been settled within the configured threshold',
        metadata: {
          marketTitle: stalledSettlement.marketTitle,
          marketCurrency: stalledSettlement.marketCurrency,
          marketStatus: stalledSettlement.marketStatus,
          resolutionId: stalledSettlement.resolutionId,
          outcome: stalledSettlement.outcome,
          approvedAt: stalledSettlement.approvedAt,
          thresholdMinutes,
        },
      });

      alertsCreated += alert ? 1 : 0;
    }

    return {
      generatedAt: new Date().toISOString(),
      thresholdMinutes,
      alertsCreated,
      stalledSettlements,
    };
  }

  async listStalledSettlements(input: { limit: number; thresholdDate?: Date }) {
    const thresholdMinutes = env.MARKET_SETTLEMENT_FAILURE_MINUTES;
    const thresholdDate =
      input.thresholdDate ?? new Date(Date.now() - thresholdMinutes * 60_000);
    const rows = await db
      .select({
        marketId: markets.id,
        marketTitle: markets.title,
        marketCurrency: markets.currency,
        marketStatus: markets.status,
        resolutionId: marketResolutions.id,
        outcome: marketResolutions.outcome,
        approvedAt: marketResolutions.approvedAt,
      })
      .from(markets)
      .innerJoin(marketResolutions, eq(marketResolutions.marketId, markets.id))
      .leftJoin(marketSettlements, eq(marketSettlements.marketId, markets.id))
      .where(
        and(
          eq(markets.status, 'awaiting_resolution'),
          isNull(marketSettlements.id),
          lte(marketResolutions.approvedAt, thresholdDate),
        ),
      )
      .limit(Math.min(input.limit, 100));

    return rows.map(
      (row): SettlementFailureCandidate => ({
        marketId: row.marketId,
        marketTitle: row.marketTitle,
        marketCurrency: row.marketCurrency,
        marketStatus: row.marketStatus,
        resolutionId: row.resolutionId,
        outcome: row.outcome,
        approvedAt: row.approvedAt.toISOString(),
        retryEligibleAt: new Date(
          row.approvedAt.getTime() + thresholdMinutes * 60_000,
        ).toISOString(),
        thresholdMinutes,
      }),
    );
  }
}
