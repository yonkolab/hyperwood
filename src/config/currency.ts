import { z } from 'zod';
import { env } from './env';

export type MarketCurrency = string;

export const supportedMarketCurrencies = [
  ...env.SUPPORTED_MARKET_CURRENCIES,
] as [string, ...string[]];

export const primaryMarketCurrency = env.PRIMARY_MARKET_CURRENCY;

export const marketCurrencySchema = z.enum(supportedMarketCurrencies);

export const marketCurrencyWithPrimaryDefaultSchema =
  marketCurrencySchema.default(primaryMarketCurrency);

export function isSupportedMarketCurrency(
  currency: string,
): currency is MarketCurrency {
  return supportedMarketCurrencies.includes(currency.toUpperCase());
}
