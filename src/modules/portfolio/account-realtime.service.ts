import { randomUUID } from 'node:crypto';

import type { MarketCurrency } from './types';

export type PrivateAccountStreamEventType =
  | 'account_snapshot'
  | 'order_updated'
  | 'balance_updated'
  | 'transfer_updated'
  | 'fill_batch'
  | 'settlement_updated';

export type PrivateAccountStreamEvent = {
  id: string;
  type: PrivateAccountStreamEventType;
  userId: string;
  currency: MarketCurrency;
  emittedAt: string;
  data: Record<string, unknown>;
};

type AccountStreamListener = (event: PrivateAccountStreamEvent) => void;

export type PrivateAccountStreamSubscription = {
  subscriptionId: string;
  userId: string;
  currency: MarketCurrency;
  connectedAt: string;
  lastDeliveredAt: string;
};

function getAccountStreamKey(userId: string, currency: MarketCurrency) {
  return `${userId}:${currency}`;
}

export class AccountRealtimeService {
  private readonly listenersByAccountKey = new Map<
    string,
    Set<AccountStreamListener>
  >();
  private readonly subscriptionsByAccountKey = new Map<
    string,
    Map<AccountStreamListener, PrivateAccountStreamSubscription>
  >();

  /**
   * Subscribe one listener to account events for a user and currency.
   *
   * Example:
   * `const unsubscribe = accountRealtimeService.subscribe(userId, 'USD', (event) => console.log(event.type))`
   */
  subscribe(
    userId: string,
    currency: MarketCurrency,
    listener: AccountStreamListener,
  ) {
    const key = getAccountStreamKey(userId, currency);
    const listeners = this.listenersByAccountKey.get(key) ?? new Set();
    const subscriptions = this.subscriptionsByAccountKey.get(key) ?? new Map();
    const now = new Date().toISOString();

    listeners.add(listener);
    this.listenersByAccountKey.set(key, listeners);
    subscriptions.set(listener, {
      subscriptionId: randomUUID(),
      userId,
      currency,
      connectedAt: now,
      lastDeliveredAt: now,
    });
    this.subscriptionsByAccountKey.set(key, subscriptions);

    return () => {
      const currentListeners = this.listenersByAccountKey.get(key);
      const currentSubscriptions = this.subscriptionsByAccountKey.get(key);

      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      currentSubscriptions?.delete(listener);

      if (currentListeners.size === 0) {
        this.listenersByAccountKey.delete(key);
      }

      if (currentSubscriptions?.size === 0) {
        this.subscriptionsByAccountKey.delete(key);
      }
    };
  }

  /**
   * Publish one account-scoped event to active listeners.
   *
   * Example:
   * `accountRealtimeService.publish({ userId, currency: 'USD', type: 'balance_updated', data: { balance } })`
   */
  publish(input: {
    userId: string;
    currency: MarketCurrency;
    type: PrivateAccountStreamEventType;
    data: Record<string, unknown>;
  }) {
    const listeners = this.listenersByAccountKey.get(
      getAccountStreamKey(input.userId, input.currency),
    );

    if (!listeners || listeners.size === 0) {
      return;
    }

    const event: PrivateAccountStreamEvent = {
      id: randomUUID(),
      type: input.type,
      userId: input.userId,
      currency: input.currency,
      emittedAt: new Date().toISOString(),
      data: input.data,
    };
    const subscriptions = this.subscriptionsByAccountKey.get(
      getAccountStreamKey(input.userId, input.currency),
    );

    for (const listener of listeners) {
      const subscription = subscriptions?.get(listener);

      if (subscription) {
        subscription.lastDeliveredAt = event.emittedAt;
      }

      listener(event);
    }
  }

  /**
   * Mark one account stream subscription as having delivered a heartbeat or snapshot.
   *
   * Example:
   * `accountRealtimeService.markSubscriptionActivity(userId, 'USD', listener)`
   */
  markSubscriptionActivity(
    userId: string,
    currency: MarketCurrency,
    listener: AccountStreamListener,
  ) {
    const subscription = this.subscriptionsByAccountKey
      .get(getAccountStreamKey(userId, currency))
      ?.get(listener);

    if (subscription) {
      subscription.lastDeliveredAt = new Date().toISOString();
    }
  }

  /**
   * List live private account stream subscriptions for health scans.
   *
   * Example:
   * `accountRealtimeService.listSubscriptions()`
   */
  listSubscriptions() {
    return Array.from(this.subscriptionsByAccountKey.values()).flatMap(
      (subscriptions) => Array.from(subscriptions.values()),
    );
  }

  /**
   * Format one account event as an SSE frame.
   *
   * Example:
   * `reply.raw.write(accountRealtimeService.toSseFrame(event))`
   */
  toSseFrame(event: PrivateAccountStreamEvent) {
    return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(
      event,
    )}\n\n`;
  }
}

export const accountRealtimeService = new AccountRealtimeService();
