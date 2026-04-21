import type { db } from '../../db/client';
import type {
  orderOutcomeEnum,
  orderSideEnum,
  walletAccountTypeEnum,
} from '../../db/schema';

export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];
export type OrderOutcome = (typeof orderOutcomeEnum.enumValues)[number];
export type OrderSide = (typeof orderSideEnum.enumValues)[number];
export type WalletAccountType =
  (typeof walletAccountTypeEnum.enumValues)[number];

export type MatchableOrder = {
  id: string;
  userId: string;
  marketId: string;
  outcome: OrderOutcome;
  side: OrderSide;
  quantity: number;
  filledQuantity: number;
  limitPriceBps: number;
  referencePriceBps: number;
  reservedAmountMinor: number;
  currency: string;
  status: 'queued_for_matching' | 'partially_filled';
  createSequence: number;
};

export type OrderState = MatchableOrder & {
  nextFilledQuantity: number;
  nextReservedAmountMinor: number;
};

export type PendingTrade = {
  makerOrderId: string;
  takerOrderId: string;
  marketId: string;
  outcome: OrderOutcome;
  priceBps: number;
  quantity: number;
  makerRemainingQuantity: number;
  takerRemainingQuantity: number;
  executedAt: Date;
};

export type TradeCollateralMove = {
  orderId: string;
  userId: string;
  currency: string;
  reserveConsumedMinor: number;
  positionCollateralMinor: number;
  cashReleaseMinor: number;
};
