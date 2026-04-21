import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  marketSettlementPayouts,
  marketSettlements,
  markets,
} from '../../db/schema';
import type { PortfolioSupportService } from './portfolio-support';
import type { MarketCurrency } from './types';

export class PortfolioSettlementQueryService {
  constructor(
    private readonly portfolioSupportService: PortfolioSupportService,
  ) {}

  /**
   * Return recent market settlements for one user.
   *
   * Example:
   * `await portfolioSettlementQueryService.listSettlements(userId, 20, 'USD')`
   */
  async listSettlements(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    await this.portfolioSupportService.assertUserExists(userId);

    const rows = await db
      .select({
        settlementId: marketSettlements.id,
        marketId: marketSettlementPayouts.marketId,
        marketSlug: markets.slug,
        marketTitle: markets.title,
        outcome: marketSettlements.outcome,
        quantity: marketSettlementPayouts.quantity,
        costBasisMinor: marketSettlementPayouts.costBasisMinor,
        payoutMinor: marketSettlementPayouts.payoutMinor,
        settledAt: marketSettlements.settledAt,
      })
      .from(marketSettlementPayouts)
      .innerJoin(
        marketSettlements,
        eq(marketSettlements.id, marketSettlementPayouts.settlementId),
      )
      .innerJoin(markets, eq(markets.id, marketSettlementPayouts.marketId))
      .where(
        and(
          eq(marketSettlementPayouts.userId, userId),
          eq(markets.currency, currency),
        ),
      )
      .orderBy(
        desc(marketSettlements.settledAt),
        desc(marketSettlementPayouts.createdAt),
      )
      .limit(Math.min(limit, 100));

    return {
      currency,
      settlements: rows.map((row) => ({
        settlementId: row.settlementId,
        marketId: row.marketId,
        marketSlug: row.marketSlug,
        marketTitle: row.marketTitle,
        outcome: row.outcome,
        quantity: row.quantity,
        costBasisMinor: row.costBasisMinor,
        payoutMinor: row.payoutMinor,
        netPnlMinor: row.payoutMinor - row.costBasisMinor,
        settledAt: row.settledAt.toISOString(),
      })),
    };
  }
}
