import type { PortfolioSupportService } from './portfolio-support';
import type { MarketCurrency } from './types';

export class PortfolioFillQueryService {
  constructor(
    private readonly portfolioSupportService: PortfolioSupportService,
  ) {}

  /**
   * Return recent fills for one user and currency.
   *
   * Example:
   * `await portfolioFillQueryService.listFills(userId, 20, 'USD')`
   */
  async listFills(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    await this.portfolioSupportService.assertUserExists(userId);

    const rows = await this.portfolioSupportService.loadUserFillRows(
      userId,
      currency,
    );
    const fills = rows
      .sort(
        (left, right) => right.executedAt.getTime() - left.executedAt.getTime(),
      )
      .slice(0, Math.min(limit, 100))
      .map((row) => this.portfolioSupportService.mapFill(row));

    return {
      currency,
      fills,
    };
  }
}
