import type { db } from '../../db/client';
import type {
  ExchangeScheduleMaintenance,
  ExchangeScheduleWindow,
} from '../../db/schema/exchange';
import type { marketCurrencyEnum } from '../../db/schema/markets';

export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];
export type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];
export type ExchangeStatus = 'open' | 'closed' | 'maintenance';
export type ExchangeStatusReason =
  | 'within_scheduled_hours'
  | 'outside_scheduled_hours'
  | 'maintenance_window';

export type UpsertExchangeScheduleInput = {
  maintenanceWindows: ExchangeScheduleMaintenance[];
  name: string;
  notes?: string;
  timezone: string;
  weeklyWindows: ExchangeScheduleWindow[];
};

export type PublishExchangeFeeScheduleInput = {
  currency: MarketCurrency;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  makerFeeBps: number;
  name: string;
  notes?: string;
  publishedBy?: string;
  takerFeeBps: number;
};
