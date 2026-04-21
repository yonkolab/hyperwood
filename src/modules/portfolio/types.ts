import type { marketCurrencyEnum } from '../../db/schema';

export type FillRole = 'maker' | 'taker';
export type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];
export type WalletAccountType =
  | 'user_cash'
  | 'user_order_reserved'
  | 'user_position_collateral'
  | 'user_withdrawal_hold';

export type PositionRecord = {
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  outcome: 'yes' | 'no';
  quantity: number;
  averageEntryPriceBps: number;
  costBasisMinor: number;
};
