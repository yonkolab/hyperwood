import type { fundingRailEnum } from '../../db/schema';

type FundingRail = (typeof fundingRailEnum.enumValues)[number];
type FundingRailCurrency = 'USD' | 'BRL' | 'GBP';

const DEFAULT_COUNTRY_RAILS: FundingRail[] = ['wire'];

const SUPPORTED_PAYMENT_METHODS_BY_COUNTRY: Record<string, FundingRail[]> = {
  BR: ['pix', 'wire'],
  GB: ['fps', 'wire'],
  US: ['ach', 'wire'],
};

const SUPPORTED_CURRENCIES_BY_RAIL: Record<FundingRail, FundingRailCurrency[]> =
  {
    ach: ['USD'],
    fps: ['GBP'],
    pix: ['BRL'],
    wire: ['USD', 'BRL', 'GBP'],
    debit_card: ['USD', 'BRL'],
    crypto_wallet: ['USD', 'BRL'],
  };

export function getSupportedPaymentMethodsForCountry(countryCode: string) {
  return (
    SUPPORTED_PAYMENT_METHODS_BY_COUNTRY[countryCode.toUpperCase()] ??
    DEFAULT_COUNTRY_RAILS
  );
}

export function getSupportedCurrenciesForFundingRail(rail: FundingRail) {
  return SUPPORTED_CURRENCIES_BY_RAIL[rail];
}

export function isPaymentMethodAllowedForCountry(
  rail: FundingRail,
  countryCode: string,
) {
  return getSupportedPaymentMethodsForCountry(countryCode).includes(rail);
}

export function doesFundingRailSupportCurrency(
  rail: FundingRail,
  currency: string,
) {
  return getSupportedCurrenciesForFundingRail(rail).includes(
    currency.toUpperCase() as FundingRailCurrency,
  );
}
