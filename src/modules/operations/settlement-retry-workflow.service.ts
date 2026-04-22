import { AppError } from '../../lib/errors';
import { MarketsService } from '../markets/service';
import { AdminAuditService } from './audit';

export class SettlementRetryWorkflowService {
  private readonly adminAuditService = new AdminAuditService();
  private readonly marketsService = new MarketsService();

  /**
   * Retry settlement for a resolved market that remains unsettled.
   *
   * Example:
   * `await settlementRetryWorkflowService.retrySettlement({ marketId, requestedBy: 'ops-admin' })`
   */
  async retrySettlement(input: { marketId: string; requestedBy?: string }) {
    const actor = input.requestedBy?.trim() || 'bootstrap';

    try {
      const result = await this.marketsService.settleMarket(input.marketId);

      await this.adminAuditService.recordEvent({
        action: 'market.settlement_retry_requested',
        actor,
        targetType: 'market',
        targetId: input.marketId,
        payload: {
          alreadySettled: result.alreadySettled,
          outcome: result.settlement.outcome,
          settlementId: result.settlement.id,
        },
      });

      return result;
    } catch (error) {
      await this.adminAuditService.recordEvent({
        action: 'market.settlement_retry_failed',
        actor,
        targetType: 'market',
        targetId: input.marketId,
        payload: this.serializeErrorPayload(error),
      });
      throw error;
    }
  }

  private serializeErrorPayload(error: unknown) {
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return {
        code: 'unexpected_error',
        message: error.message,
      };
    }

    return {
      code: 'unexpected_error',
      message: 'unknown settlement retry failure',
    };
  }
}
