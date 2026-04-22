import type { MarketCurrency } from '../../config/currency';

export type FillRole = 'maker' | 'taker';
export type { MarketCurrency };
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
