import type { FastifyInstance } from 'fastify';

const bootstrapHeaders = () => ({
  'x-bootstrap-token':
    process.env.INTERNAL_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token',
});

export async function upsertApprovedComplianceProfile(
  app: FastifyInstance,
  userId: string,
  overrides: Partial<{
    countryCode: string;
    jurisdictionCode: string;
    legalEntity: string;
    kycStatus: 'pending' | 'approved' | 'rejected' | 'restricted';
    sanctionsStatus: 'clear' | 'pending_review' | 'restricted';
    ageVerified: boolean;
  }> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/compliance/users/${userId}/profile`,
    headers: bootstrapHeaders(),
    payload: {
      countryCode: 'US',
      jurisdictionCode: 'US',
      legalEntity: 'individual',
      kycStatus: 'approved',
      sanctionsStatus: 'clear',
      ageVerified: true,
      ...overrides,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function linkFundingMethod(
  app: FastifyInstance,
  userId: string,
  overrides: Partial<{
    rail: 'ach' | 'fps' | 'pix' | 'wire' | 'debit_card' | 'crypto_wallet';
    status: 'pending_verification' | 'verified' | 'disabled';
    displayName: string;
    countryCode: string;
    provider: string;
    providerReference: string;
    last4: string;
  }> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/funding/users/${userId}/methods`,
    headers: bootstrapHeaders(),
    payload: {
      rail: 'ach',
      status: 'verified',
      displayName: 'Primary ACH',
      countryCode: 'US',
      provider: 'test-bank',
      providerReference: 'provider-ref-1',
      last4: '4242',
      ...overrides,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function seedWallet(
  app: FastifyInstance,
  userId: string,
  overrides: Partial<{
    amountMinor: number;
    currency: 'USD' | 'BRL';
    referenceId: string;
  }> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/funding/users/${userId}/wallet/seed`,
    headers: bootstrapHeaders(),
    payload: {
      amountMinor: 100_000,
      currency: 'USD',
      referenceId: 'seed-wallet',
      ...overrides,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function createMarketEvent(
  app: FastifyInstance,
  overrides: Partial<{
    slug: string;
    title: string;
    summary: string;
    category: string;
  }> = {},
) {
  const nonce = Date.now().toString(36);
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/markets/events',
    headers: bootstrapHeaders(),
    payload: {
      slug: `event-${nonce}`,
      title: 'Election 2028',
      summary: 'Will the named candidate win?',
      category: 'politics',
      ...overrides,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function createMarket(
  app: FastifyInstance,
  eventId: string,
  overrides: Partial<{
    slug: string;
    title: string;
    summary: string;
    currency: 'USD' | 'BRL';
    status:
      | 'draft'
      | 'scheduled'
      | 'active'
      | 'halted'
      | 'trading_closed'
      | 'awaiting_resolution'
      | 'settled'
      | 'cancelled'
      | 'disputed'
      | 'voided';
    resolutionRules: string;
    yesPriceBps: number;
    noPriceBps: number;
  }> = {},
) {
  const nonce = Date.now().toString(36);
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/markets',
    headers: bootstrapHeaders(),
    payload: {
      eventId,
      slug: `market-${nonce}`,
      title: 'Candidate A to win',
      summary: 'Binary outcome market',
      currency: 'USD',
      status: 'active',
      resolutionRules: 'Resolves to YES if candidate A wins.',
      yesPriceBps: 5300,
      noPriceBps: 4700,
      ...overrides,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function runMarketMatch(app: FastifyInstance, marketId: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/markets/${marketId}/match`,
    headers: bootstrapHeaders(),
  });

  return {
    response,
    body: response.json(),
  };
}

export async function transitionMarketStatus(
  app: FastifyInstance,
  marketId: string,
  overrides: Partial<{
    status:
      | 'draft'
      | 'scheduled'
      | 'active'
      | 'halted'
      | 'trading_closed'
      | 'awaiting_resolution'
      | 'settled'
      | 'cancelled'
      | 'disputed'
      | 'voided';
    reason: string;
    changedBy: string;
  }> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/markets/${marketId}/status`,
    headers: bootstrapHeaders(),
    payload: {
      status: 'halted',
      reason: 'Manual operator action.',
      changedBy: 'ops-admin',
      ...overrides,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function resolveMarket(
  app: FastifyInstance,
  marketId: string,
  overrides: Partial<{
    outcome: 'yes' | 'no' | 'void';
    evidenceSummary: string;
    evidenceSources: string[];
    approvedBy: string;
  }> = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/markets/${marketId}/resolve`,
    headers: bootstrapHeaders(),
    payload: {
      outcome: 'yes',
      evidenceSummary: 'Final result confirmed by approved source.',
      evidenceSources: ['https://example.com/results'],
      approvedBy: 'ops-resolution',
      ...overrides,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function settleMarket(app: FastifyInstance, marketId: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/internal/markets/${marketId}/settle`,
    headers: bootstrapHeaders(),
  });

  return {
    response,
    body: response.json(),
  };
}
