import { AppError } from '../../lib/errors';
import {
  isHistoricalMarketStatus,
  listTrades,
  loadTradeAccessMarket,
} from './market-workflow-support';

type CandleInterval = '1h' | '1d';

type TradeRow = {
  priceBps: number;
  quantity: number;
  executedAt: Date;
};

export class MarketCandleHistoryService {
  /**
   * Return archived candles for one historical market.
   *
   * Example:
   * `await marketCandleHistoryService.listHistoricalCandles(marketId, { interval: '1h', limit: 24 })`
   */
  async listHistoricalCandles(
    marketId: string,
    input: { interval: CandleInterval; limit: number },
  ) {
    const market = await loadTradeAccessMarket(marketId);

    if (!isHistoricalMarketStatus(market.status)) {
      throw new AppError(
        409,
        'market_not_archived',
        `market status ${market.status} is not archived`,
      );
    }

    const trades = await listTrades(market.id, 500);
    const candles = this.buildCandles(
      trades.trades,
      input.interval,
      input.limit,
    );

    return {
      marketId: market.id,
      interval: input.interval,
      candles,
    };
  }

  private buildCandles(
    trades: TradeRow[],
    interval: CandleInterval,
    limit: number,
  ) {
    const buckets = new Map<
      string,
      {
        bucketStart: Date;
        bucketEnd: Date;
        openPriceBps: number;
        highPriceBps: number;
        lowPriceBps: number;
        closePriceBps: number;
        volume: number;
        tradeCount: number;
      }
    >();
    const sortedTrades = [...trades].sort(
      (left, right) =>
        new Date(left.executedAt).getTime() -
        new Date(right.executedAt).getTime(),
    );

    for (const trade of sortedTrades) {
      const executedAt = new Date(trade.executedAt);
      const bucketStart = truncateToInterval(executedAt, interval);
      const bucketKey = bucketStart.toISOString();
      const existing = buckets.get(bucketKey);

      if (!existing) {
        buckets.set(bucketKey, {
          bucketStart,
          bucketEnd: addInterval(bucketStart, interval),
          openPriceBps: trade.priceBps,
          highPriceBps: trade.priceBps,
          lowPriceBps: trade.priceBps,
          closePriceBps: trade.priceBps,
          volume: trade.quantity,
          tradeCount: 1,
        });
        continue;
      }

      existing.highPriceBps = Math.max(existing.highPriceBps, trade.priceBps);
      existing.lowPriceBps = Math.min(existing.lowPriceBps, trade.priceBps);
      existing.closePriceBps = trade.priceBps;
      existing.volume += trade.quantity;
      existing.tradeCount += 1;
    }

    return Array.from(buckets.values())
      .sort(
        (left, right) =>
          right.bucketStart.getTime() - left.bucketStart.getTime(),
      )
      .slice(0, Math.min(limit, 200))
      .map((candle) => ({
        bucketStart: candle.bucketStart.toISOString(),
        bucketEnd: candle.bucketEnd.toISOString(),
        openPriceBps: candle.openPriceBps,
        highPriceBps: candle.highPriceBps,
        lowPriceBps: candle.lowPriceBps,
        closePriceBps: candle.closePriceBps,
        volume: candle.volume,
        tradeCount: candle.tradeCount,
      }));
  }
}

function truncateToInterval(timestamp: Date, interval: CandleInterval) {
  const bucket = new Date(timestamp);
  bucket.setUTCMinutes(0, 0, 0);

  if (interval === '1d') {
    bucket.setUTCHours(0, 0, 0, 0);
  }

  return bucket;
}

function addInterval(bucketStart: Date, interval: CandleInterval) {
  const bucketEnd = new Date(bucketStart);

  if (interval === '1h') {
    bucketEnd.setUTCHours(bucketEnd.getUTCHours() + 1);
    return bucketEnd;
  }

  bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 1);
  return bucketEnd;
}
