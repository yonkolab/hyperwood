import { beforeAll, describe, expect, it } from "vitest";

describe("FundingService integration", () => {
  let IdentityService: typeof import("../../src/modules/identity/service").IdentityService;
  let ComplianceService: typeof import("../../src/modules/compliance/service").ComplianceService;
  let FundingService: typeof import("../../src/modules/funding/service").FundingService;

  beforeAll(async () => {
    ({ IdentityService } = await import("../../src/modules/identity/service.js"));
    ({ ComplianceService } = await import("../../src/modules/compliance/service.js"));
    ({ FundingService } = await import("../../src/modules/funding/service.js"));
  });

  it("creates and settles a deposit against the migrated ledger tables", async () => {
    const identityService = new IdentityService();
    const complianceService = new ComplianceService();
    const fundingService = new FundingService();

    const registration = await identityService.register({
      email: "funding-user@example.com",
      username: "fundinguser",
      password: "supersecure123",
    });

    await complianceService.upsertComplianceProfile({
      userId: registration.user.id,
      countryCode: "US",
      jurisdictionCode: "US",
      legalEntity: "individual",
      kycStatus: "approved",
      sanctionsStatus: "clear",
      ageVerified: true,
    });

    const linkedMethod = await fundingService.linkFundingMethod({
      userId: registration.user.id,
      rail: "ach",
      status: "verified",
      displayName: "Primary ACH",
      countryCode: "US",
      provider: "test-bank",
      providerReference: "bank-ref-1",
      last4: "4242",
    });

    if (!linkedMethod.fundingMethod) {
      throw new Error("expected funding method to be created");
    }

    const deposit = await fundingService.createDeposit({
      userId: registration.user.id,
      fundingMethodId: linkedMethod.fundingMethod.id,
      amountMinor: 25_000,
      currency: "USD",
    });

    expect(deposit.deposit.status).toBe("pending");

    const settled = await fundingService.settleDeposit(deposit.deposit.id);
    const walletBalance = await fundingService.getWalletBalance(registration.user.id, "USD");

    expect(settled.deposit.status).toBe("settled");
    expect(settled.alreadySettled).toBe(false);
    expect(walletBalance.availableBalanceMinor).toBe(25_000);
    expect(walletBalance.currency).toBe("USD");
  });
});
