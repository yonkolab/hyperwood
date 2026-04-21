import { AppError } from '../../lib/errors';
import {
  isHistoricalMarketStatus,
  listTrades,
  loadTradeAccessMarket,
} from './market-workflow-support';

export class MarketTradeHistoryService {
  async listRecentTrades(marketId: string, limit: number) {
    const market = await loadTradeAccessMarket(marketId);

    if (isHistoricalMarketStatus(market.status)) {
      throw new AppError(
        410,
        'historical_market_data',
        'archived market trades are available through /api/v1/historical/markets/:marketId/trades',
      );
    }

    return listTrades(market.id, limit);
  }

  async listHistoricalTrades(marketId: string, limit: number) {
    const market = await loadTradeAccessMarket(marketId);

    if (!isHistoricalMarketStatus(market.status)) {
      throw new AppError(
        409,
        'market_not_archived',
        `market status ${market.status} is not archived`,
      );
    }

    return listTrades(market.id, limit);
  }
}
