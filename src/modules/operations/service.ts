import { EmailWebhookService } from '../identity/email-webhook.service';
import { OperationsAlertService } from './alerts';
import { AdminAuditService } from './audit';
import { LedgerInvariantAlertService } from './ledger-invariant-alert.service';
import { OperationsReviewQueueService } from './operations-review-queue.service';
import { RateLimitEventService } from './rate-limit';
import { RealtimeStreamHealthAlertService } from './realtime-stream-health-alert.service';
import { SettlementFailureAlertService } from './settlement-failure-alert.service';
import { SettlementRetryWorkflowService } from './settlement-retry-workflow.service';
import { TradingConditionAlertService } from './trading-condition-alert.service';

export class OperationsService {
  private readonly operationsAlertService = new OperationsAlertService();
  private readonly adminAuditService = new AdminAuditService();
  private readonly emailWebhookService = new EmailWebhookService();
  private readonly ledgerInvariantAlertService =
    new LedgerInvariantAlertService();
  private readonly operationsReviewQueueService =
    new OperationsReviewQueueService();
  private readonly rateLimitEventService = new RateLimitEventService();
  private readonly realtimeStreamHealthAlertService =
    new RealtimeStreamHealthAlertService();
  private readonly settlementFailureAlertService =
    new SettlementFailureAlertService();
  private readonly settlementRetryWorkflowService =
    new SettlementRetryWorkflowService();
  private readonly tradingConditionAlertService =
    new TradingConditionAlertService();

  async listActiveReviewQueue(input: { limit: number }) {
    return this.operationsReviewQueueService.listActiveReviewQueue({
      limit: Math.min(input.limit, 100),
    });
  }

  async listAuditEvents(input: {
    limit: number;
    targetType?: string;
    targetId?: string;
    action?: string;
  }) {
    const limit = Math.min(input.limit, 100);

    return {
      generatedAt: new Date().toISOString(),
      events: await this.adminAuditService.listEvents({
        limit,
        ...(input.targetType ? { targetType: input.targetType } : {}),
        ...(input.targetId ? { targetId: input.targetId } : {}),
        ...(input.action ? { action: input.action } : {}),
      }),
    };
  }

  async listRateLimitEvents(input: {
    bucket?: string;
    limit: number;
    path?: string;
    scopeKey?: string;
    scopeType?: string;
  }) {
    const limit = Math.min(input.limit, 100);

    return {
      generatedAt: new Date().toISOString(),
      events: await this.rateLimitEventService.listEvents({
        limit,
        ...(input.bucket ? { bucket: input.bucket } : {}),
        ...(input.scopeType ? { scopeType: input.scopeType } : {}),
        ...(input.scopeKey ? { scopeKey: input.scopeKey } : {}),
        ...(input.path ? { path: input.path } : {}),
      }),
    };
  }

  async listAlerts(input: {
    limit: number;
    category?: string;
    severity?: 'warning' | 'critical';
    sourceType?: string;
    status?: 'open' | 'acknowledged' | 'resolved';
  }) {
    const limit = Math.min(input.limit, 100);

    return {
      generatedAt: new Date().toISOString(),
      alerts: await this.operationsAlertService.listAlerts({
        limit,
        ...(input.category ? { category: input.category } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      }),
    };
  }

  async listEmailFeedbackEvents(input: {
    limit: number;
    recipientEmail?: string;
    status?:
      | 'sent'
      | 'delivered'
      | 'deferred'
      | 'soft_bounced'
      | 'hard_bounced'
      | 'complained';
  }) {
    return {
      generatedAt: new Date().toISOString(),
      events: await this.emailWebhookService.listEmailFeedbackEvents({
        limit: Math.min(input.limit, 100),
        ...(input.recipientEmail
          ? { recipientEmail: input.recipientEmail }
          : {}),
        ...(input.status ? { status: input.status } : {}),
      }),
    };
  }

  async listEmailSuppressions(input: {
    limit: number;
    email?: string;
    reason?: string;
  }) {
    return {
      generatedAt: new Date().toISOString(),
      suppressions: await this.emailWebhookService.listSuppressedRecipients({
        limit: Math.min(input.limit, 100),
        ...(input.email ? { email: input.email } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    };
  }

  async scanLedgerInvariants(input: { limit: number }) {
    return this.ledgerInvariantAlertService.scan({
      limit: Math.min(input.limit, 100),
    });
  }

  async scanSettlementFailures(input: { limit: number }) {
    return this.settlementFailureAlertService.scan({
      limit: Math.min(input.limit, 100),
    });
  }

  async scanTradingConditions(input: { limit: number }) {
    return this.tradingConditionAlertService.scan({
      limit: Math.min(input.limit, 100),
    });
  }

  async scanRealtimeStreamHealth(input: {
    limit: number;
    maxIdleSeconds?: number;
  }) {
    return this.realtimeStreamHealthAlertService.scan({
      limit: Math.min(input.limit, 100),
      ...(input.maxIdleSeconds !== undefined
        ? { maxIdleSeconds: input.maxIdleSeconds }
        : {}),
    });
  }

  async retrySettlement(input: { marketId: string; requestedBy?: string }) {
    return this.settlementRetryWorkflowService.retrySettlement(input);
  }
}
