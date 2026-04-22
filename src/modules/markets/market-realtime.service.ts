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

export type PublicMarketStreamSubscription = {
  subscriptionId: string;
  marketId: string;
  connectedAt: string;
  lastDeliveredAt: string;
};

export class MarketRealtimeService {
  private readonly listenersByMarketId = new Map<
    string,
    Set<MarketStreamListener>
  >();
  private readonly subscriptionsByMarketId = new Map<
    string,
    Map<MarketStreamListener, PublicMarketStreamSubscription>
  >();

  /**
   * Subscribe one listener to public events for a market.
   *
   * Example:
   * `const unsubscribe = marketRealtimeService.subscribe(marketId, (event) => console.log(event.type))`
   */
  subscribe(marketId: string, listener: MarketStreamListener) {
    const listeners = this.listenersByMarketId.get(marketId) ?? new Set();
    const subscriptions =
      this.subscriptionsByMarketId.get(marketId) ?? new Map();
    const now = new Date().toISOString();

    listeners.add(listener);
    this.listenersByMarketId.set(marketId, listeners);
    subscriptions.set(listener, {
      subscriptionId: randomUUID(),
      marketId,
      connectedAt: now,
      lastDeliveredAt: now,
    });
    this.subscriptionsByMarketId.set(marketId, subscriptions);

    return () => {
      const currentListeners = this.listenersByMarketId.get(marketId);
      const currentSubscriptions = this.subscriptionsByMarketId.get(marketId);

      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      currentSubscriptions?.delete(listener);

      if (currentListeners.size === 0) {
        this.listenersByMarketId.delete(marketId);
      }

      if (currentSubscriptions?.size === 0) {
        this.subscriptionsByMarketId.delete(marketId);
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
    const subscriptions = this.subscriptionsByMarketId.get(input.marketId);

    for (const listener of listeners) {
      const subscription = subscriptions?.get(listener);

      if (subscription) {
        subscription.lastDeliveredAt = event.emittedAt;
      }

      listener(event);
    }
  }

  /**
   * Mark one market stream subscription as having delivered a heartbeat or snapshot.
   *
   * Example:
   * `marketRealtimeService.markSubscriptionActivity(marketId, listener)`
   */
  markSubscriptionActivity(marketId: string, listener: MarketStreamListener) {
    const subscription = this.subscriptionsByMarketId
      .get(marketId)
      ?.get(listener);

    if (subscription) {
      subscription.lastDeliveredAt = new Date().toISOString();
    }
  }

  /**
   * List live public market stream subscriptions for health scans.
   *
   * Example:
   * `marketRealtimeService.listSubscriptions()`
   */
  listSubscriptions() {
    return Array.from(this.subscriptionsByMarketId.values()).flatMap(
      (subscriptions) => Array.from(subscriptions.values()),
    );
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
