import { eq } from 'drizzle-orm';
import type { MarketCurrency } from '../../config/currency';
import { db } from '../../db/client';
import { markets } from '../../db/schema';
import { MarketsService } from '../markets/service';
import { OperationsAlertService } from './alerts';

type CrossedOutcome = {
  outcome: 'yes' | 'no';
  bestBidPriceBps: number;
  bestAskPriceBps: number;
};

type UnusualTradingConditionCandidate = {
  marketId: string;
  marketTitle: string;
  marketCurrency: MarketCurrency;
  marketStatus: string;
  crossedOutcomes: CrossedOutcome[];
};

export class TradingConditionAlertService {
  private readonly marketsService = new MarketsService();
  private readonly operationsAlertService = new OperationsAlertService();

  /**
   * Scan active markets for crossed resting books and persist alerts.
   *
   * Example:
   * `await tradingConditionAlertService.scan({ limit: 25 })`
   */
  async scan(input: { limit: number }) {
    const candidates = await this.listCandidates(input.limit);
    let alertsCreated = 0;

    for (const candidate of candidates) {
      const alert = await this.operationsAlertService.createAlert({
        category: 'unusual_trading_condition',
        severity: 'critical',
        sourceType: 'market',
        sourceId: candidate.marketId,
        message: 'active market has a crossed resting book',
        metadata: {
          marketTitle: candidate.marketTitle,
          marketCurrency: candidate.marketCurrency,
          marketStatus: candidate.marketStatus,
          crossedOutcomes: candidate.crossedOutcomes,
        },
      });

      alertsCreated += alert ? 1 : 0;
    }

    return {
      generatedAt: new Date().toISOString(),
      alertsCreated,
      affectedMarkets: candidates,
    };
  }

  private async listCandidates(limit: number) {
    const activeMarkets = await db
      .select({
        marketId: markets.id,
        marketTitle: markets.title,
        marketCurrency: markets.currency,
        marketStatus: markets.status,
      })
      .from(markets)
      .where(eq(markets.status, 'active'))
      .limit(Math.min(limit, 100));

    const candidates: UnusualTradingConditionCandidate[] = [];

    for (const activeMarket of activeMarkets) {
      const orderBook = await this.marketsService.getOrderBookSnapshot(
        activeMarket.marketId,
      );
      const crossedOutcomes = this.getCrossedOutcomes(orderBook);

      if (crossedOutcomes.length === 0) {
        continue;
      }

      candidates.push({
        marketId: activeMarket.marketId,
        marketTitle: activeMarket.marketTitle,
        marketCurrency: activeMarket.marketCurrency,
        marketStatus: activeMarket.marketStatus,
        crossedOutcomes,
      });
    }

    return candidates;
  }

  private getCrossedOutcomes(orderBook: {
    books: {
      yes: { bestBidPriceBps: number | null; bestAskPriceBps: number | null };
      no: { bestBidPriceBps: number | null; bestAskPriceBps: number | null };
    };
  }) {
    const crossedOutcomes: CrossedOutcome[] = [];

    for (const [outcome, book] of [
      ['yes', orderBook.books.yes],
      ['no', orderBook.books.no],
    ] as const) {
      if (
        typeof book.bestBidPriceBps !== 'number' ||
        typeof book.bestAskPriceBps !== 'number'
      ) {
        continue;
      }

      if (book.bestBidPriceBps < book.bestAskPriceBps) {
        continue;
      }

      crossedOutcomes.push({
        outcome,
        bestBidPriceBps: book.bestBidPriceBps,
        bestAskPriceBps: book.bestAskPriceBps,
      });
    }

    return crossedOutcomes;
  }
}
