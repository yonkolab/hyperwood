import { randomUUID } from 'node:crypto';

export type PublicMarketStreamEventType =
  | 'snapshot'
  | 'order_book_updated'
  | 'trade_batch'
  | 'status_changed'
  | 'announcement_published';

export type PublicMarketStreamEvent = {
  id: string;
  type: PublicMarketStreamEventType;
  marketId: string;
  emittedAt: string;
  data: Record<string, unknown>;
};

type MarketStreamListener = (event: PublicMarketStreamEvent) => void;

export class MarketRealtimeService {
  private readonly listenersByMarketId = new Map<
    string,
    Set<MarketStreamListener>
  >();

  /**
   * Subscribe one listener to public events for a market.
   *
   * Example:
   * `const unsubscribe = marketRealtimeService.subscribe(marketId, (event) => console.log(event.type))`
   */
  subscribe(marketId: string, listener: MarketStreamListener) {
    const listeners = this.listenersByMarketId.get(marketId) ?? new Set();
    listeners.add(listener);
    this.listenersByMarketId.set(marketId, listeners);

    return () => {
      const currentListeners = this.listenersByMarketId.get(marketId);

      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);

      if (currentListeners.size === 0) {
        this.listenersByMarketId.delete(marketId);
      }
    };
  }

  /**
   * Publish one public market event to all current subscribers.
   *
   * Example:
   * `marketRealtimeService.publish({ marketId, type: 'status_changed', data: { market } })`
   */
  publish(input: {
    marketId: string;
    type: PublicMarketStreamEventType;
    data: Record<string, unknown>;
  }) {
    const listeners = this.listenersByMarketId.get(input.marketId);

    if (!listeners || listeners.size === 0) {
      return;
    }

    const event: PublicMarketStreamEvent = {
      id: randomUUID(),
      type: input.type,
      marketId: input.marketId,
      emittedAt: new Date().toISOString(),
      data: input.data,
    };

    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * Format one event as an SSE frame payload.
   *
   * Example:
   * `reply.raw.write(marketRealtimeService.toSseFrame(event))`
   */
  toSseFrame(event: PublicMarketStreamEvent) {
    return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(
      event,
    )}\n\n`;
  }
}

export const marketRealtimeService = new MarketRealtimeService();
