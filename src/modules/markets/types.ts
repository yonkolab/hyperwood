import type { db } from '../../db/client';
import type {
  marketCurrencyEnum,
  marketResolutionOutcomeEnum,
  marketStatusEnum,
  orderOutcomeEnum,
  orderSideEnum,
  orderTypeEnum,
  walletAccountTypeEnum,
} from '../../db/schema';

export type MarketStatus = (typeof marketStatusEnum.enumValues)[number];
export type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];
export type MarketResolutionOutcome =
  (typeof marketResolutionOutcomeEnum.enumValues)[number];
export type OrderOutcome = (typeof orderOutcomeEnum.enumValues)[number];
export type OrderSide = (typeof orderSideEnum.enumValues)[number];
export type OrderType = (typeof orderTypeEnum.enumValues)[number];
export type WalletAccountType =
  (typeof walletAccountTypeEnum.enumValues)[number];
export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CreateMarketEventInput = {
  slug: string;
  title: string;
  summary?: string;
  category: string;
  startsAt?: Date;
  endsAt?: Date;
};

export type CreateMarketInput = {
  eventId: string;
  slug: string;
  title: string;
  summary?: string;
  currency: MarketCurrency;
  status: MarketStatus;
  tags?: string[];
  resolutionRules: string;
  resolutionSources?: string[];
  yesPriceBps: number;
  noPriceBps: number;
  volumeUsdMinor?: number;
  opensAt?: Date;
  closesAt?: Date;
  resolvesAt?: Date;
};

export type PublishMarketAnnouncementInput = {
  title: string;
  message: string;
  publishedBy?: string;
};

export type ListMarketsInput = {
  category?: string;
  status?: MarketStatus;
  tag?: string;
  search?: string;
  sort?: 'newest' | 'closing_soon' | 'highest_volume';
  limit: number;
};

export type MarketRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: MarketStatus;
  currency: MarketCurrency;
  tags: string[];
  yesPriceBps: number;
  noPriceBps: number;
  volumeUsdMinor: number;
  opensAt: Date | null;
  closesAt: Date | null;
  resolvesAt: Date | null;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  event: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    category: string;
    startsAt: Date | null;
    endsAt: Date | null;
  };
};

export type NormalizedPosition = {
  userId: string;
  marketId: string;
  outcome: 'yes' | 'no';
  quantity: number;
  costBasisMinor: number;
};

export type PublicMarketStreamSnapshot = {
  market: Record<string, unknown>;
  orderBook: Record<string, unknown>;
  recentTrades: Record<string, unknown>[];
};
