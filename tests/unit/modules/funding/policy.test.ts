import { describe, expect, it } from 'vitest';
import {
  doesFundingRailSupportCurrency,
  getSupportedPaymentMethodsForCountry,
  getSupportedCurrenciesForFundingRail,
  isPaymentMethodAllowedForCountry,
} from '../../../../src/modules/funding/policy';

describe('funding policy', () => {
  it('returns country-specific rails with wire fallback', () => {
    expect(getSupportedPaymentMethodsForCountry('BR')).toEqual(['pix', 'wire']);
    expect(getSupportedPaymentMethodsForCountry('unknown')).toEqual(['wire']);
  });

  it('exposes supported currencies per rail', () => {
    expect(getSupportedCurrenciesForFundingRail('ach')).toEqual(['USD']);
    expect(getSupportedCurrenciesForFundingRail('pix')).toEqual(['BRL']);
  });

  it('checks country and currency compatibility', () => {
    expect(isPaymentMethodAllowedForCountry('pix', 'BR')).toBe(true);
    expect(isPaymentMethodAllowedForCountry('pix', 'US')).toBe(false);
    expect(doesFundingRailSupportCurrency('wire', 'brl')).toBe(true);
    expect(doesFundingRailSupportCurrency('ach', 'BRL')).toBe(false);
  });
});
