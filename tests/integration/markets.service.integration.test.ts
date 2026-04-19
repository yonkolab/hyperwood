import { beforeAll, describe, expect, it } from "vitest";

describe("MarketsService integration", () => {
  let IdentityService: typeof import("../../src/modules/identity/service").IdentityService;
  let ComplianceService: typeof import("../../src/modules/compliance/service").ComplianceService;
  let FundingService: typeof import("../../src/modules/funding/service").FundingService;
  let OrdersService: typeof import("../../src/modules/orders/service").OrdersService;
  let MatchingService: typeof import("../../src/modules/matching/service").MatchingService;
  let MarketsService: typeof import("../../src/modules/markets/service").MarketsService;
  let PortfolioService: typeof import("../../src/modules/portfolio/service").PortfolioService;

  beforeAll(async () => {
    ({ IdentityService } = await import("../../src/modules/identity/service.js"));
    ({ ComplianceService } = await import("../../src/modules/compliance/service.js"));
    ({ FundingService } = await import("../../src/modules/funding/service.js"));
    ({ OrdersService } = await import("../../src/modules/orders/service.js"));
    ({ MatchingService } = await import("../../src/modules/matching/service.js"));
    ({ MarketsService } = await import("../../src/modules/markets/service.js"));
    ({ PortfolioService } = await import("../../src/modules/portfolio/service.js"));
  });

  it("resolves and settles matched positions against the migrated settlement tables", async () => {
    const identityService = new IdentityService();
    const complianceService = new ComplianceService();
    const fundingService = new FundingService();
    const ordersService = new OrdersService();
    const matchingService = new MatchingService();
    const marketsService = new MarketsService();
    const portfolioService = new PortfolioService();

    const [buyer, seller] = await Promise.all([
      identityService.register({
        email: "settlement-buyer@example.com",
        username: "settlementbuyer",
        password: "supersecure123",
      }),
      identityService.register({
        email: "settlement-seller@example.com",
        username: "settlementseller",
        password: "supersecure123",
      }),
    ]);

    await Promise.all([
      identityService.verifyEmail({ token: buyer.verificationChallenge.token }),
      identityService.verifyEmail({ token: seller.verificationChallenge.token }),
      complianceService.upsertComplianceProfile({
        userId: buyer.user.id,
        countryCode: "US",
        jurisdictionCode: "US",
        legalEntity: "individual",
        kycStatus: "approved",
        sanctionsStatus: "clear",
        ageVerified: true,
      }),
      complianceService.upsertComplianceProfile({
        userId: seller.user.id,
        countryCode: "US",
        jurisdictionCode: "US",
        legalEntity: "individual",
        kycStatus: "approved",
        sanctionsStatus: "clear",
        ageVerified: true,
      }),
      fundingService.seedWalletBalance({
        userId: buyer.user.id,
        amountMinor: 10_000,
        currency: "USD",
        referenceId: "settlement-buyer-seed",
      }),
      fundingService.seedWalletBalance({
        userId: seller.user.id,
        amountMinor: 10_000,
        currency: "USD",
        referenceId: "settlement-seller-seed",
      }),
    ]);

    const event = await marketsService.createEvent({
      slug: "integration-resolution-event",
      title: "Integration Resolution Event",
      category: "politics",
      summary: "Used for settlement integration testing.",
    });
    const market = await marketsService.createMarket({
      eventId: event.event.id,
      slug: "integration-resolution-market",
      title: "Candidate A to win",
      summary: "Binary outcome market",
      currency: "USD",
      status: "active",
      resolutionRules: "Resolves YES if candidate A wins.",
      resolutionSources: ["https://example.com/rules"],
      yesPriceBps: 4800,
      noPriceBps: 5200,
    });

    await ordersService.createOrder({
      userId: buyer.user.id,
      marketId: market.market.id,
      idempotencyKey: "settlement-buyer-order",
      type: "limit",
      side: "buy",
      outcome: "yes",
      quantity: 10,
      limitPriceBps: 4800,
      selfTradePrevention: "decrement_and_cancel",
    });
    await ordersService.createOrder({
      userId: seller.user.id,
      marketId: market.market.id,
      idempotencyKey: "settlement-seller-order",
      type: "limit",
      side: "sell",
      outcome: "yes",
      quantity: 10,
      limitPriceBps: 4800,
      selfTradePrevention: "decrement_and_cancel",
    });

    const match = await matchingService.runLimitOrderMatching(market.market.id);
    expect(match.summary.matchedTradeCount).toBe(1);

    const resolution = await marketsService.resolveMarket(market.market.id, {
      outcome: "yes",
      evidenceSummary: "Official election authority certified the result.",
      evidenceSources: ["https://example.com/election-result"],
      approvedBy: "integration-ops",
    });

    expect(resolution.market.status).toBe("awaiting_resolution");

    const settlement = await marketsService.settleMarket(market.market.id);
    const buyerPortfolio = await portfolioService.getPortfolioSummary(buyer.user.id, "USD");
    const sellerPortfolio = await portfolioService.getPortfolioSummary(seller.user.id, "USD");
    const buyerSettlements = await portfolioService.listSettlements(buyer.user.id, 10, "USD");

    expect(settlement.alreadySettled).toBe(false);
    expect(settlement.settlement.outcome).toBe("yes");
    expect(settlement.settlement.totalPayoutMinor).toBe(1_000);
    expect(settlement.payouts).toHaveLength(2);
    expect(buyerPortfolio.positions).toEqual([]);
    expect(buyerPortfolio.cash.availableBalanceMinor).toBe(10_520);
    expect(sellerPortfolio.cash.availableBalanceMinor).toBe(9_480);
    expect(buyerSettlements.settlements).toHaveLength(1);
    expect(buyerSettlements.settlements[0]).toMatchObject({
      marketId: market.market.id,
      outcome: "yes",
      payoutMinor: 1000,
      netPnlMinor: 520,
    });
  });
});
