import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  ledgerEntries,
  ledgerTransactions,
  marketResolutions,
  marketSettlementPayouts,
  marketSettlements,
  markets,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { AdminAuditService } from '../operations/audit';
import {
  acquireMarketWriteLock,
  assertNoOpenOrders,
  getOrCreateWalletAccount,
  getSettlementPriceSnapshot,
  listSettlementPayouts,
  loadMarketForSettlement,
  loadNormalizedPositions,
  mapResolution,
  mapSettlement,
} from './market-workflow-support';

export class MarketSettlementService {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  async settleMarket(marketId: string, input?: { settledBy?: string }) {
    return db.transaction(async (tx) => {
      const market = await loadMarketForSettlement(tx, marketId);
      await acquireMarketWriteLock(tx, market.id);
      await assertNoOpenOrders(tx, market.id);

      const resolutionRows = await tx
        .select()
        .from(marketResolutions)
        .where(eq(marketResolutions.marketId, market.id))
        .limit(1);
      const resolution = resolutionRows[0];

      if (!resolution) {
        throw new AppError(
          409,
          'market_resolution_missing',
          'market must be resolved before settlement',
        );
      }

      const existingSettlementRows = await tx
        .select()
        .from(marketSettlements)
        .where(eq(marketSettlements.marketId, market.id))
        .limit(1);
      const existingSettlement = existingSettlementRows[0];

      if (existingSettlement) {
        return {
          marketId: market.id,
          alreadySettled: true,
          resolution: mapResolution(resolution),
          settlement: mapSettlement(existingSettlement),
          payouts: await listSettlementPayouts(
            tx,
            existingSettlement.id,
            market.currency,
          ),
        };
      }

      const positions = await loadNormalizedPositions(tx, market.id);
      const payouts = positions.map((position) => {
        const payoutMinor =
          resolution.outcome === 'void'
            ? position.costBasisMinor
            : position.outcome === resolution.outcome
              ? position.quantity * 100
              : 0;

        return {
          userId: position.userId,
          marketId: market.id,
          outcome: resolution.outcome,
          quantity: position.quantity,
          costBasisMinor: position.costBasisMinor,
          payoutMinor,
        };
      });

      const settlementStatus =
        resolution.outcome === 'void' ? 'voided' : 'settled';
      const settledAt = new Date();

      const transactionRows = await tx
        .insert(ledgerTransactions)
        .values({
          referenceType: 'market_settlement',
          referenceId: market.id,
          metadata: {
            marketId: market.id,
            resolutionId: resolution.id,
            outcome: resolution.outcome,
            settledAt: settledAt.toISOString(),
          },
        })
        .returning({ id: ledgerTransactions.id });
      const transaction = transactionRows[0];

      if (!transaction) {
        throw new AppError(
          500,
          'ledger_transaction_failed',
          `failed to create settlement ledger transaction for ${market.id}`,
        );
      }

      const ledgerEntriesToInsert = [];

      for (const payout of payouts) {
        const positionWallet = await getOrCreateWalletAccount(tx, {
          ownerUserId: payout.userId,
          type: 'user_position_collateral',
          currency: market.currency,
        });

        if (payout.costBasisMinor > 0) {
          ledgerEntriesToInsert.push({
            transactionId: transaction.id,
            walletAccountId: positionWallet.id,
            side: 'debit' as const,
            amountMinor: payout.costBasisMinor,
            currency: market.currency,
          });
        }

        if (payout.payoutMinor > 0) {
          const cashWallet = await getOrCreateWalletAccount(tx, {
            ownerUserId: payout.userId,
            type: 'user_cash',
            currency: market.currency,
          });

          ledgerEntriesToInsert.push({
            transactionId: transaction.id,
            walletAccountId: cashWallet.id,
            side: 'credit' as const,
            amountMinor: payout.payoutMinor,
            currency: market.currency,
          });
        }
      }

      if (ledgerEntriesToInsert.length > 0) {
        await tx.insert(ledgerEntries).values(ledgerEntriesToInsert);
      }

      const settlementRows = await tx
        .insert(marketSettlements)
        .values({
          marketId: market.id,
          resolutionId: resolution.id,
          outcome: resolution.outcome,
          settledAt,
          totalPayoutMinor: payouts.reduce(
            (total, payout) => total + payout.payoutMinor,
            0,
          ),
          affectedUserCount: payouts.length,
          metadata: {
            currency: market.currency,
            ledgerTransactionId: transaction.id,
          },
        })
        .returning();
      const settlement = settlementRows[0];

      if (!settlement) {
        throw new AppError(
          500,
          'market_settlement_failed',
          `failed to persist market settlement for ${market.id}`,
        );
      }

      if (payouts.length > 0) {
        await tx.insert(marketSettlementPayouts).values(
          payouts.map((payout) => ({
            settlementId: settlement.id,
            marketId: payout.marketId,
            userId: payout.userId,
            outcome: payout.outcome,
            quantity: payout.quantity,
            costBasisMinor: payout.costBasisMinor,
            payoutMinor: payout.payoutMinor,
          })),
        );
      }

      const nextPriceSnapshot = getSettlementPriceSnapshot(resolution.outcome);

      const updatedMarketRows = await tx
        .update(markets)
        .set({
          status: settlementStatus,
          yesPriceBps: nextPriceSnapshot.yesPriceBps,
          noPriceBps: nextPriceSnapshot.noPriceBps,
          statusChangedAt: settledAt,
          updatedAt: settledAt,
        })
        .where(eq(markets.id, market.id))
        .returning();
      const updatedMarket = updatedMarketRows[0];

      if (!updatedMarket) {
        throw new AppError(
          500,
          'market_settlement_failed',
          `failed to update settled market state for ${market.id}`,
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'market.settled',
          actor: input?.settledBy ?? 'bootstrap',
          targetType: 'market',
          targetId: market.id,
          payload: {
            resolutionId: resolution.id,
            settlementId: settlement.id,
            outcome: resolution.outcome,
            totalPayoutMinor: settlement.totalPayoutMinor,
            affectedUserCount: settlement.affectedUserCount,
          },
        },
        tx,
      );

      return {
        marketId: market.id,
        alreadySettled: false,
        market: updatedMarket,
        resolution: mapResolution(resolution),
        settlement: mapSettlement(settlement),
        payouts: payouts.map((payout) => ({
          ...payout,
          currency: market.currency,
          netPnlMinor: payout.payoutMinor - payout.costBasisMinor,
        })),
      };
    });
  }
}
