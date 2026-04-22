import { primaryMarketCurrency } from '../../config/currency';
import type { PortfolioFillQueryService } from './portfolio-fill-query.service';
import type { PortfolioSupportService } from './portfolio-support';
import type { MarketCurrency, PositionRecord } from './types';

const DEFAULT_RECENT_FILL_LIMIT = 20;
const DEFAULT_RECENT_ACTIVITY_LIMIT = 20;

export class PortfolioSummaryQueryService {
  constructor(
    private readonly portfolioSupportService: PortfolioSupportService,
    private readonly portfolioFillQueryService: PortfolioFillQueryService,
  ) {}

  /**
   * Build the top-level portfolio summary for one user.
   *
   * Example:
   * `await portfolioSummaryQueryService.getPortfolioSummary(userId, 'USD')`
   */
  async getPortfolioSummary(
    userId: string,
    currency: MarketCurrency = primaryMarketCurrency,
  ) {
    const cash = await this.getCashSummary(userId, currency);
    const positions = await this.getDerivedPositions(userId, currency);
    const recentFills = await this.portfolioFillQueryService.listFills(
      userId,
      DEFAULT_RECENT_FILL_LIMIT,
      currency,
    );
    const recentLedgerActivity =
      await this.portfolioSupportService.listLedgerActivity(
        userId,
        DEFAULT_RECENT_ACTIVITY_LIMIT,
        currency,
      );

    return {
      currency,
      cash: {
        ...cash,
      },
      positions,
      recentFills: recentFills.fills,
      recentLedgerActivity,
    };
  }

  private async getCashSummary(userId: string, currency: MarketCurrency) {
    await this.portfolioSupportService.assertUserExists(userId);

    const [
      cashWallet,
      reservedWallet,
      positionCollateralWallet,
      withdrawalHoldWallet,
    ] = await Promise.all([
      this.portfolioSupportService.getOrCreateWalletAccount(
        userId,
        'user_cash',
        currency,
      ),
      this.portfolioSupportService.getOrCreateWalletAccount(
        userId,
        'user_order_reserved',
        currency,
      ),
      this.portfolioSupportService.getOrCreateWalletAccount(
        userId,
        'user_position_collateral',
        currency,
      ),
      this.portfolioSupportService.getOrCreateWalletAccount(
        userId,
        'user_withdrawal_hold',
        currency,
      ),
    ]);

    const [
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
      withdrawalHoldMinor,
      restingOrderValueMinor,
    ] = await Promise.all([
      this.portfolioSupportService.getWalletAccountBalance(cashWallet.id),
      this.portfolioSupportService.getWalletAccountBalance(reservedWallet.id),
      this.portfolioSupportService.getWalletAccountBalance(
        positionCollateralWallet.id,
      ),
      this.portfolioSupportService.getWalletAccountBalance(
        withdrawalHoldWallet.id,
      ),
      this.portfolioSupportService.getRestingOrderValueMinor(userId, currency),
    ]);

    return {
      currency,
      walletAccountId: cashWallet.id,
      reservedWalletAccountId: reservedWallet.id,
      positionCollateralWalletAccountId: positionCollateralWallet.id,
      withdrawalHoldWalletAccountId: withdrawalHoldWallet.id,
      availableBalanceMinor,
      reservedBalanceMinor,
      positionCollateralMinor,
      withdrawalHoldMinor,
      totalBalanceMinor:
        availableBalanceMinor +
        reservedBalanceMinor +
        positionCollateralMinor +
        withdrawalHoldMinor,
      restingOrderValueMinor,
    };
  }

  private async getDerivedPositions(userId: string, currency: MarketCurrency) {
    const fills = await this.portfolioSupportService.loadUserFillRows(
      userId,
      currency,
    );
    const grouped = fills.reduce<
      Map<string, PositionRecord & { totalWeightedPriceBpsQuantity: number }>
    >((positions, fill) => {
      if (fill.marketStatus === 'settled' || fill.marketStatus === 'voided') {
        return positions;
      }

      const normalized = this.portfolioSupportService.normalizeExposure(fill);
      const key = `${normalized.marketId}:${normalized.outcome}`;
      const existing = positions.get(key);
      const totalWeightedPriceBpsQuantity =
        (existing?.totalWeightedPriceBpsQuantity ?? 0) +
        normalized.averageEntryPriceBps * normalized.quantity;
      const quantity = (existing?.quantity ?? 0) + normalized.quantity;
      const costBasisMinor =
        (existing?.costBasisMinor ?? 0) + normalized.costBasisMinor;

      positions.set(key, {
        ...normalized,
        quantity,
        costBasisMinor,
        totalWeightedPriceBpsQuantity,
        averageEntryPriceBps: Math.round(
          totalWeightedPriceBpsQuantity / quantity,
        ),
      });

      return positions;
    }, new Map());

    return Array.from(grouped.values())
      .map(
        ({ totalWeightedPriceBpsQuantity: _ignored, ...position }) => position,
      )
      .sort((left, right) => left.marketTitle.localeCompare(right.marketTitle));
  }
}
