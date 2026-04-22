import type { PortfolioSupportService } from './portfolio-support';
import type { MarketCurrency } from './types';

export class PortfolioOrderHistoryQueryService {
  constructor(
    private readonly portfolioSupportService: PortfolioSupportService,
  ) {}

  /**
   * Return historical orders for one user and currency.
   *
   * Example:
   * `await portfolioOrderHistoryQueryService.listOrders(userId, 20, 'USD')`
   */
  async listOrders(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    await this.portfolioSupportService.assertUserExists(userId);

    const rows = await this.portfolioSupportService.loadUserOrderRows(
      userId,
      currency,
    );
    const orders = rows
      .sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )
      .slice(0, Math.min(limit, 100))
      .map((row) => this.portfolioSupportService.mapOrder(row));

    return {
      currency,
      orders,
    };
  }
}
