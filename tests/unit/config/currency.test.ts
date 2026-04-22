import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function importCurrencyConfig() {
  vi.resetModules();
  return import('../../../src/config/currency');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('currency config', () => {
  it('uses the configured primary market currency', async () => {
    process.env.DATABASE_URL ??=
      'postgres://postgres:postgres@127.0.0.1:5432/hyperwood_test';
    process.env.TOTP_ENCRYPTION_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.API_KEY_ENCRYPTION_KEY ??=
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    process.env.FUNDING_PROVIDER_WEBHOOK_SECRET ??= 'test-webhook-secret';
    process.env.INTERNAL_BOOTSTRAP_TOKEN ??= 'test-bootstrap-token';
    process.env.SUPPORTED_MARKET_CURRENCIES = 'BRL,USD,EUR';
    process.env.PRIMARY_MARKET_CURRENCY = 'BRL';

    const currencyConfig = await importCurrencyConfig();

    expect(currencyConfig.primaryMarketCurrency).toBe('BRL');
    expect(currencyConfig.supportedMarketCurrencies).toEqual([
      'BRL',
      'USD',
      'EUR',
    ]);
    expect(
      currencyConfig.marketCurrencyWithPrimaryDefaultSchema.parse(undefined),
    ).toBe('BRL');
  });

  it('fails fast when the primary currency is not supported', async () => {
    process.env.DATABASE_URL ??=
      'postgres://postgres:postgres@127.0.0.1:5432/hyperwood_test';
    process.env.TOTP_ENCRYPTION_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.API_KEY_ENCRYPTION_KEY ??=
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    process.env.FUNDING_PROVIDER_WEBHOOK_SECRET ??= 'test-webhook-secret';
    process.env.INTERNAL_BOOTSTRAP_TOKEN ??= 'test-bootstrap-token';
    process.env.SUPPORTED_MARKET_CURRENCIES = 'USD,EUR';
    process.env.PRIMARY_MARKET_CURRENCY = 'BRL';

    await expect(importCurrencyConfig()).rejects.toThrow(
      'PRIMARY_MARKET_CURRENCY="BRL" must be included in SUPPORTED_MARKET_CURRENCIES="USD,EUR"',
    );
  });
});
