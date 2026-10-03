import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { markets } from '../../db/schema';
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
  outcome: 'yes' | 'no';
};

export class MarketCandleHistoryService {
  /**
   * Return archived candles for one historical market.
   *
   * Example:
   * `await marketCandleHistoryService.listHistoricalCandles(marketId, { interval: '1h', limit: 24 })`
   */
  /**
   * Return candles for any market, live or archived.
   *
   * Markets without executed trades return a flat baseline at the current
   * yes price so the chart always renders.
   *
   * Example:
   * `await marketCandleHistoryService.listMarketCandles(marketId, { interval: '1h', limit: 24 })`
   */
  async listMarketCandles(
    marketId: string,
    input: { interval: CandleInterval; limit: number },
  ) {
    const market = await loadTradeAccessMarket(marketId);
    const trades = await listTrades(market.id, 500);
    const candles = this.buildCandles(
      trades.trades,
      input.interval,
      input.limit,
    );

    if (candles.length > 0) {
      return {
        marketId: market.id,
        interval: input.interval,
        candles,
      };
    }

    const baselineCandles = await this.buildBaselineCandles(market.id, input);

    return {
      marketId: market.id,
      interval: input.interval,
      candles: baselineCandles,
    };
  }

  private async buildBaselineCandles(
    marketId: string,
    input: { interval: CandleInterval; limit: number },
  ) {
    const [market] = await db
      .select({
        id: markets.id,
        yesPriceBps: markets.yesPriceBps,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      return [];
    }

    const now = new Date();
    const intervalMs = input.interval === '1h' ? 3_600_000 : 86_400_000;
    const bucketStart = new Date(
      Math.floor(now.getTime() / intervalMs) * intervalMs,
    );
    const previousBucketStart = new Date(bucketStart.getTime() - intervalMs);

    return [previousBucketStart, bucketStart].map((start) => ({
      bucketStart: start,
      bucketEnd: new Date(start.getTime() + intervalMs),
      openPriceBps: market.yesPriceBps,
      highPriceBps: market.yesPriceBps,
      lowPriceBps: market.yesPriceBps,
      closePriceBps: market.yesPriceBps,
      volume: 0,
      volumeYes: 0,
      volumeNo: 0,
      tradeCount: 0,
    }));
  }

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

  private buildCandleBuckets(trades: TradeRow[], interval: CandleInterval) {
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
        volumeYes: number;
        volumeNo: number;
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
          volumeYes: trade.outcome === 'yes' ? trade.quantity : 0,
          volumeNo: trade.outcome === 'no' ? trade.quantity : 0,
          tradeCount: 1,
        });
        continue;
      }

      existing.highPriceBps = Math.max(existing.highPriceBps, trade.priceBps);
      existing.lowPriceBps = Math.min(existing.lowPriceBps, trade.priceBps);
      existing.closePriceBps = trade.priceBps;
      existing.volume += trade.quantity;

      if (trade.outcome === 'yes') {
        existing.volumeYes += trade.quantity;
      } else {
        existing.volumeNo += trade.quantity;
      }

      existing.tradeCount += 1;
    }

    return buckets;
  }

  private buildCandles(
    trades: TradeRow[],
    interval: CandleInterval,
    limit: number,
  ) {
    const buckets = this.buildCandleBuckets(trades, interval);

    return Array.from(buckets.values())
      .sort(
        (left, right) =>
          right.bucketStart.getTime() - left.bucketStart.getTime(),
      )
      .slice(0, Math.min(limit, 200))
      .map((candle) => this.serializeCandle(candle));
  }

  private serializeCandle(candle: {
    bucketStart: Date;
    bucketEnd: Date;
    openPriceBps: number;
    highPriceBps: number;
    lowPriceBps: number;
    closePriceBps: number;
    volume: number;
    volumeYes: number;
    volumeNo: number;
    tradeCount: number;
  }) {
    return {
      bucketStart: candle.bucketStart.toISOString(),
      bucketEnd: candle.bucketEnd.toISOString(),
      openPriceBps: candle.openPriceBps,
      highPriceBps: candle.highPriceBps,
      lowPriceBps: candle.lowPriceBps,
      closePriceBps: candle.closePriceBps,
      volume: candle.volume,
      volumeYes: candle.volumeYes,
      volumeNo: candle.volumeNo,
      tradeCount: candle.tradeCount,
    };
  }

  private async buildContinuousDailyCandles(
    market: {
      id: string;
      opensAt: Date | null;
      createdAt: Date;
      closesAt: Date | null;
      yesPriceBps: number;
    },
    trades: TradeRow[],
  ) {
    const buckets = this.buildCandleBuckets(trades, '1d');
    const startRef = market.opensAt ?? market.createdAt;
    const startDay = truncateToInterval(startRef, '1d');
    const endRef = market.closesAt
      ? new Date(Math.min(market.closesAt.getTime(), Date.now()))
      : new Date();
    const endDay = truncateToInterval(endRef, '1d');
    const candles: ReturnType<MarketCandleHistoryService['serializeCandle']>[] =
      [];
    let lastClose = market.yesPriceBps;

    for (
      let cursor = new Date(startDay);
      cursor.getTime() <= endDay.getTime() && candles.length < 400;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const bucket = buckets.get(cursor.toISOString());
      const bucketEnd = new Date(cursor.getTime() + 86_400_000);

      if (bucket) {
        candles.push(this.serializeCandle(bucket));
        lastClose = bucket.closePriceBps;
        continue;
      }

      candles.push({
        bucketStart: cursor.toISOString(),
        bucketEnd: bucketEnd.toISOString(),
        openPriceBps: lastClose,
        highPriceBps: lastClose,
        lowPriceBps: lastClose,
        closePriceBps: lastClose,
        volume: 0,
        volumeYes: 0,
        volumeNo: 0,
        tradeCount: 0,
      });
    }

    return candles;
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
