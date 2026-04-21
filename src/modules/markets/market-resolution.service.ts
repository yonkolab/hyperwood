import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { marketResolutions, marketSettlements, markets } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { AdminAuditService } from '../operations/audit';
import {
  acquireMarketWriteLock,
  assertNoOpenOrders,
  loadMarketForResolution,
  mapResolution,
} from './market-workflow-support';
import type { MarketResolutionOutcome } from './types';

export class MarketResolutionService {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  async resolveMarket(
    marketId: string,
    input: {
      outcome: MarketResolutionOutcome;
      evidenceSummary: string;
      evidenceSources?: string[];
      approvedBy?: string;
    },
  ) {
    return db.transaction(async (tx) => {
      const market = await loadMarketForResolution(tx, marketId);
      await acquireMarketWriteLock(tx, market.id);
      await assertNoOpenOrders(tx, market.id);

      const existingResolutionRows = await tx
        .select()
        .from(marketResolutions)
        .where(eq(marketResolutions.marketId, market.id))
        .limit(1);

      if (existingResolutionRows[0]) {
        throw new AppError(
          409,
          'market_already_resolved',
          'market already has a recorded resolution',
        );
      }

      const existingSettlementRows = await tx
        .select({ id: marketSettlements.id })
        .from(marketSettlements)
        .where(eq(marketSettlements.marketId, market.id))
        .limit(1);

      if (existingSettlementRows[0]) {
        throw new AppError(
          409,
          'market_already_settled',
          'market has already been settled',
        );
      }

      const now = new Date();
      const updatedMarketRows = await tx
        .update(markets)
        .set({
          status: 'awaiting_resolution',
          statusChangedAt: now,
          updatedAt: now,
        })
        .where(eq(markets.id, market.id))
        .returning();
      const updatedMarket = updatedMarketRows[0];

      if (!updatedMarket) {
        throw new AppError(
          500,
          'market_resolution_failed',
          `failed to update market status for ${market.id}`,
        );
      }

      const insertedResolutionRows = await tx
        .insert(marketResolutions)
        .values({
          marketId: market.id,
          outcome: input.outcome,
          evidenceSummary: input.evidenceSummary,
          evidenceSources: input.evidenceSources ?? [],
          approvedBy: input.approvedBy,
          approvedAt: now,
          updatedAt: now,
        })
        .returning();
      const resolution = insertedResolutionRows[0];

      if (!resolution) {
        throw new AppError(
          500,
          'market_resolution_failed',
          `failed to persist market resolution for ${market.id}`,
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'market.resolved',
          actor: input.approvedBy ?? 'bootstrap',
          targetType: 'market',
          targetId: market.id,
          payload: {
            resolutionId: resolution.id,
            outcome: resolution.outcome,
            evidenceSummary: resolution.evidenceSummary,
            evidenceSources: resolution.evidenceSources,
          },
        },
        tx,
      );

      return {
        market: updatedMarket,
        resolution: mapResolution(resolution),
      };
    });
  }
}
