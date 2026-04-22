import { and, desc, eq } from 'drizzle-orm';
import { primaryMarketCurrency } from '../../config/currency';
import { db } from '../../db/client';
import { historicalExportJobs } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PortfolioFillQueryService } from './portfolio-fill-query.service';
import type { PortfolioSettlementQueryService } from './portfolio-settlement-query.service';
import type { PortfolioSummaryQueryService } from './portfolio-summary-query.service';
import type { PortfolioSupportService } from './portfolio-support';
import type { MarketCurrency } from './types';

export class PortfolioExportService {
  constructor(
    private readonly portfolioSupportService: PortfolioSupportService,
    private readonly portfolioSummaryQueryService: PortfolioSummaryQueryService,
    private readonly portfolioFillQueryService: PortfolioFillQueryService,
    private readonly portfolioSettlementQueryService: PortfolioSettlementQueryService,
  ) {}

  /**
   * Create one completed account-history export artifact.
   *
   * Example:
   * `await portfolioExportService.createAccountHistoryExport(userId, 'USD')`
   */
  async createAccountHistoryExport(
    userId: string,
    currency: MarketCurrency = primaryMarketCurrency,
  ) {
    await this.portfolioSupportService.assertUserExists(userId);

    const [portfolioSummary, fills, settlements, ledgerActivity] =
      await Promise.all([
        this.portfolioSummaryQueryService.getPortfolioSummary(userId, currency),
        this.portfolioFillQueryService.listFills(userId, 100, currency),
        this.portfolioSettlementQueryService.listSettlements(
          userId,
          100,
          currency,
        ),
        this.portfolioSupportService.listLedgerActivity(userId, 100, currency),
      ]);

    const completedAt = new Date();
    const artifact = {
      exportType: 'account_history',
      currency,
      generatedAt: completedAt.toISOString(),
      portfolioSummary,
      fills: fills.fills,
      settlements: settlements.settlements,
      ledgerActivity,
    };

    const rows = await db
      .insert(historicalExportJobs)
      .values({
        userId,
        scope: 'account_history',
        status: 'completed',
        format: 'json',
        currency,
        artifact,
        createdAt: completedAt,
        completedAt,
      })
      .returning();
    const exportJob = rows[0];

    if (!exportJob) {
      throw new AppError(
        500,
        'historical_export_creation_failed',
        `failed to create historical export job for user ${userId}`,
      );
    }

    return {
      exportJob: this.portfolioSupportService.mapExportJob(exportJob),
    };
  }

  /**
   * Return recent account-history export jobs for one user.
   *
   * Example:
   * `await portfolioExportService.listAccountHistoryExports(userId, 20, 'USD')`
   */
  async listAccountHistoryExports(
    userId: string,
    limit: number,
    currency: MarketCurrency = primaryMarketCurrency,
  ) {
    await this.portfolioSupportService.assertUserExists(userId);

    const rows = await db
      .select()
      .from(historicalExportJobs)
      .where(
        and(
          eq(historicalExportJobs.userId, userId),
          eq(historicalExportJobs.scope, 'account_history'),
          eq(historicalExportJobs.currency, currency),
        ),
      )
      .orderBy(desc(historicalExportJobs.createdAt))
      .limit(Math.min(limit, 100));

    return {
      currency,
      exportJobs: rows.map((row) =>
        this.portfolioSupportService.mapExportJob(row),
      ),
    };
  }

  /**
   * Return one account-history export and its artifact payload.
   *
   * Example:
   * `await portfolioExportService.getAccountHistoryExport(userId, exportJobId)`
   */
  async getAccountHistoryExport(userId: string, exportJobId: string) {
    await this.portfolioSupportService.assertUserExists(userId);

    const rows = await db
      .select()
      .from(historicalExportJobs)
      .where(
        and(
          eq(historicalExportJobs.id, exportJobId),
          eq(historicalExportJobs.userId, userId),
          eq(historicalExportJobs.scope, 'account_history'),
        ),
      )
      .limit(1);
    const exportJob = rows[0];

    if (!exportJob) {
      throw new AppError(
        404,
        'historical_export_not_found',
        `historical export job was not found for id ${exportJobId}`,
      );
    }

    return {
      exportJob: this.portfolioSupportService.mapExportJob(exportJob),
      artifact: this.portfolioSupportService.asRecord(exportJob.artifact),
    };
  }
}
