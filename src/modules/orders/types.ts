import type { db } from '../../db/client';
import type {
  marketCommandTypeEnum,
  marketCurrencyEnum,
  marketStatusEnum,
  orderOutcomeEnum,
  orderSideEnum,
  orderTypeEnum,
  selfTradePreventionEnum,
  walletAccountTypeEnum,
} from '../../db/schema';

export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OrderType = (typeof orderTypeEnum.enumValues)[number];
export type OrderSide = (typeof orderSideEnum.enumValues)[number];
export type OrderOutcome = (typeof orderOutcomeEnum.enumValues)[number];
export type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];
export type WalletAccountType =
  (typeof walletAccountTypeEnum.enumValues)[number];
export type SelfTradePrevention =
  (typeof selfTradePreventionEnum.enumValues)[number];
export type MarketStatus = (typeof marketStatusEnum.enumValues)[number];
export type MarketCommandType =
  (typeof marketCommandTypeEnum.enumValues)[number];

export type CreateOrderInput = {
  userId: string;
  marketId: string;
  idempotencyKey: string;
  type: OrderType;
  side: OrderSide;
  outcome: OrderOutcome;
  quantity: number;
  limitPriceBps?: number;
  selfTradePrevention: SelfTradePrevention;
};
