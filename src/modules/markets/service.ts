import { AdminAuditService } from '../operations/audit';
import { MarketAnnouncementService } from './market-announcement.service';
import { MarketCandleHistoryService } from './market-candle-history.service';
import { MarketCatalogQueryService } from './market-catalog-query.service';
import { MarketLifecycleService } from './market-lifecycle.service';
import { MarketOrderBookQueryService } from './market-order-book-query.service';
import { MarketResolutionService } from './market-resolution.service';
import { MarketSettlementService } from './market-settlement.service';
import { MarketTradeHistoryService } from './market-trade-history.service';
import type {
  CreateMarketEventInput,
  CreateMarketInput,
  ListMarketsInput,
  MarketResolutionOutcome,
  MarketStatus,
  PublishMarketAnnouncementInput,
} from './types';

export class MarketsService {
  private readonly adminAuditService = new AdminAuditService();
  private readonly marketCatalogQueryService = new MarketCatalogQueryService();
  private readonly marketAnnouncementService = new MarketAnnouncementService(
    this.adminAuditService,
  );
  private readonly marketLifecycleService = new MarketLifecycleService(
    this.adminAuditService,
  );
  private readonly marketResolutionService = new MarketResolutionService(
    this.adminAuditService,
  );
  private readonly marketSettlementService = new MarketSettlementService(
    this.adminAuditService,
  );
  private readonly marketOrderBookQueryService =
    new MarketOrderBookQueryService();
  private readonly marketTradeHistoryService = new MarketTradeHistoryService();
  private readonly marketCandleHistoryService =
    new MarketCandleHistoryService();

  async createEvent(input: CreateMarketEventInput) {
    return this.marketLifecycleService.createEvent(input);
  }

  async createMarket(input: CreateMarketInput) {
    return this.marketLifecycleService.createMarket(input);
  }

  async listMarkets(input: ListMarketsInput) {
    return this.marketCatalogQueryService.listMarkets(input);
  }

  async getMarketDetail(marketId: string) {
    return this.marketCatalogQueryService.getMarketDetail(marketId);
  }

  async listMarketAnnouncements(marketId: string) {
    return this.marketAnnouncementService.listMarketAnnouncements(marketId);
  }

  async listRecentTrades(marketId: string, limit: number) {
    return this.marketTradeHistoryService.listRecentTrades(marketId, limit);
  }

  async listHistoricalTrades(marketId: string, limit: number) {
    return this.marketTradeHistoryService.listHistoricalTrades(marketId, limit);
  }

  async listHistoricalCandles(
    marketId: string,
    input: { interval: '1h' | '1d'; limit: number },
  ) {
    return this.marketCandleHistoryService.listHistoricalCandles(
      marketId,
      input,
    );
  }

  async publishMarketAnnouncement(
    marketId: string,
    input: PublishMarketAnnouncementInput,
  ) {
    return this.marketAnnouncementService.publishMarketAnnouncement(
      marketId,
      input,
    );
  }

  async resolveMarket(
    marketId: string,
    input: {
      outcome: MarketResolutionOutcome;
      evidenceSummary: string;
      evidenceSources?: string[];
      approvedBy?: string;
    },
  ) {
    return this.marketResolutionService.resolveMarket(marketId, input);
  }

  async updateMarketStatus(
    marketId: string,
    input: {
      status: MarketStatus;
      reason: string;
      changedBy?: string;
    },
  ) {
    return this.marketLifecycleService.updateMarketStatus(marketId, input);
  }

  async settleMarket(marketId: string) {
    return this.marketSettlementService.settleMarket(marketId);
  }

  async getOrderBookSnapshot(marketId: string) {
    return this.marketOrderBookQueryService.getOrderBookSnapshot(marketId);
  }

  async getOrderBookDeltas(
    marketId: string,
    input: {
      afterSequence: number;
      limit: number;
    },
  ) {
    return this.marketOrderBookQueryService.getOrderBookDeltas(marketId, input);
  }
}
