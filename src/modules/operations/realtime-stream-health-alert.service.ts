import { env } from '../../config/env';
import { marketRealtimeService } from '../markets/market-realtime.service';
import { accountRealtimeService } from '../portfolio/account-realtime.service';
import { OperationsAlertService } from './alerts';

type StaleRealtimeStream = {
  subscriptionId: string;
  streamType: 'market' | 'account';
  marketId: string | null;
  userId: string | null;
  currency: 'USD' | 'BRL' | null;
  connectedAt: string;
  lastDeliveredAt: string;
  idleSeconds: number;
};

export class RealtimeStreamHealthAlertService {
  constructor(
    private readonly operationsAlertService = new OperationsAlertService(),
  ) {}

  /**
   * Scan live SSE subscriptions for stale delivery and persist operator alerts.
   *
   * Example:
   * `await realtimeStreamHealthAlertService.scan({ limit: 25 })`
   */
  async scan(input: { limit: number; maxIdleSeconds?: number }) {
    const thresholdSeconds =
      input.maxIdleSeconds ?? env.REALTIME_STREAM_STALE_SECONDS;
    const staleStreams = this.listStaleStreams(thresholdSeconds, input.limit);
    const createdAlerts = await Promise.all(
      staleStreams.map((stream) =>
        this.operationsAlertService.createAlert({
          category: 'realtime_stream_outage',
          severity: 'critical',
          sourceType:
            stream.streamType === 'market'
              ? 'realtime_market_stream'
              : 'realtime_account_stream',
          sourceId: stream.subscriptionId,
          message:
            `realtime ${stream.streamType} stream ${stream.subscriptionId} ` +
            `was idle for ${stream.idleSeconds}s; expected activity within ${thresholdSeconds}s`,
          metadata: {
            streamType: stream.streamType,
            marketId: stream.marketId,
            userId: stream.userId,
            currency: stream.currency,
            connectedAt: stream.connectedAt,
            lastDeliveredAt: stream.lastDeliveredAt,
            idleSeconds: stream.idleSeconds,
            thresholdSeconds,
          },
        }),
      ),
    );

    return {
      generatedAt: new Date().toISOString(),
      thresholdSeconds,
      alertsCreated: createdAlerts.filter(Boolean).length,
      staleStreams,
    };
  }

  private listStaleStreams(
    thresholdSeconds: number,
    limit: number,
  ): StaleRealtimeStream[] {
    return [...this.listMarketStreams(), ...this.listAccountStreams()]
      .filter((stream) => stream.idleSeconds >= thresholdSeconds)
      .sort((left, right) => right.idleSeconds - left.idleSeconds)
      .slice(0, Math.min(limit, 100));
  }

  private listMarketStreams() {
    const now = Date.now();

    return marketRealtimeService.listSubscriptions().map((subscription) => ({
      subscriptionId: subscription.subscriptionId,
      streamType: 'market' as const,
      marketId: subscription.marketId,
      userId: null,
      currency: null,
      connectedAt: subscription.connectedAt,
      lastDeliveredAt: subscription.lastDeliveredAt,
      idleSeconds: Math.max(
        0,
        Math.floor(
          (now - new Date(subscription.lastDeliveredAt).getTime()) / 1000,
        ),
      ),
    }));
  }

  private listAccountStreams() {
    const now = Date.now();

    return accountRealtimeService.listSubscriptions().map((subscription) => ({
      subscriptionId: subscription.subscriptionId,
      streamType: 'account' as const,
      marketId: null,
      userId: subscription.userId,
      currency: subscription.currency,
      connectedAt: subscription.connectedAt,
      lastDeliveredAt: subscription.lastDeliveredAt,
      idleSeconds: Math.max(
        0,
        Math.floor(
          (now - new Date(subscription.lastDeliveredAt).getTime()) / 1000,
        ),
      ),
    }));
  }
}
