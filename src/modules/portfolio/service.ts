import { PortfolioExportService } from './portfolio-export.service';
import { PortfolioFillQueryService } from './portfolio-fill-query.service';
import { PortfolioSettlementQueryService } from './portfolio-settlement-query.service';
import { PortfolioSummaryQueryService } from './portfolio-summary-query.service';
import { PortfolioSupportService } from './portfolio-support';
import type { MarketCurrency } from './types';

export class PortfolioService {
  private readonly portfolioSupportService = new PortfolioSupportService();
  private readonly portfolioFillQueryService = new PortfolioFillQueryService(
    this.portfolioSupportService,
  );
  private readonly portfolioSettlementQueryService =
    new PortfolioSettlementQueryService(this.portfolioSupportService);
  private readonly portfolioSummaryQueryService =
    new PortfolioSummaryQueryService(
      this.portfolioSupportService,
      this.portfolioFillQueryService,
    );
  private readonly portfolioExportService = new PortfolioExportService(
    this.portfolioSupportService,
    this.portfolioSummaryQueryService,
    this.portfolioFillQueryService,
    this.portfolioSettlementQueryService,
  );

  async getPortfolioSummary(userId: string, currency: MarketCurrency = 'USD') {
    return this.portfolioSummaryQueryService.getPortfolioSummary(
      userId,
      currency,
    );
  }

  async listFills(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    return this.portfolioFillQueryService.listFills(userId, limit, currency);
  }

  async listSettlements(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    return this.portfolioSettlementQueryService.listSettlements(
      userId,
      limit,
      currency,
    );
  }

  async createAccountHistoryExport(
    userId: string,
    currency: MarketCurrency = 'USD',
  ) {
    return this.portfolioExportService.createAccountHistoryExport(
      userId,
      currency,
    );
  }

  async listAccountHistoryExports(
    userId: string,
    limit: number,
    currency: MarketCurrency = 'USD',
  ) {
    return this.portfolioExportService.listAccountHistoryExports(
      userId,
      limit,
      currency,
    );
  }

  async getAccountHistoryExport(userId: string, exportJobId: string) {
    return this.portfolioExportService.getAccountHistoryExport(
      userId,
      exportJobId,
    );
  }
}
