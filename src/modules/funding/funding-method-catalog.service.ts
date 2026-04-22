import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { fundingMethods } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { ComplianceService } from '../compliance/service';
import type { FundingWalletLedgerService } from './funding-wallet-ledger.service';
import {
  doesFundingRailSupportCurrency,
  getSupportedCurrenciesForFundingRail,
  isPaymentMethodAllowedForCountry,
} from './policy';
import type { LinkFundingMethodInput, MarketCurrency } from './types';

export class FundingMethodCatalogService {
  constructor(
    private readonly walletLedgerService: FundingWalletLedgerService,
    private readonly complianceService: ComplianceService,
  ) {}

  /**
   * Link a new user funding method after country/rail validation.
   *
   * Example:
   * `await fundingMethodCatalogService.linkFundingMethod(input)`
   */
  async linkFundingMethod(input: LinkFundingMethodInput) {
    await this.walletLedgerService.assertUserExists(input.userId);
    const countryCode = input.countryCode.toUpperCase();

    if (!isPaymentMethodAllowedForCountry(input.rail, countryCode)) {
      throw new AppError(
        400,
        'funding_method_country_not_supported',
        `funding rail ${input.rail} is not supported for country ${countryCode}`,
      );
    }

    const insertedRows = await db
      .insert(fundingMethods)
      .values({
        userId: input.userId,
        rail: input.rail,
        status: input.status,
        displayName: input.displayName,
        countryCode,
        provider: input.provider,
        providerReference: input.providerReference,
        last4: input.last4,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      })
      .returning();

    return {
      fundingMethod: insertedRows[0],
    };
  }

  /**
   * List verified funding methods that are allowed for the user's region and currency.
   *
   * Example:
   * `await fundingMethodCatalogService.listEligibleFundingMethods(userId, 'BRL')`
   */
  async listEligibleFundingMethods(
    userId: string,
    currency: MarketCurrency = 'USD',
  ) {
    await this.walletLedgerService.assertUserExists(userId);

    const capabilityEvaluation =
      await this.complianceService.getCapabilityEvaluation(userId);

    if (!capabilityEvaluation.capabilities.funding.allowed) {
      return {
        fundingAllowed: false,
        fundingReasons: capabilityEvaluation.capabilities.funding.reasons,
        requestedCurrency: currency,
        fundingMethods: [],
      };
    }

    const methods = await db
      .select({
        id: fundingMethods.id,
        rail: fundingMethods.rail,
        status: fundingMethods.status,
        displayName: fundingMethods.displayName,
        last4: fundingMethods.last4,
        countryCode: fundingMethods.countryCode,
        provider: fundingMethods.provider,
        providerReference: fundingMethods.providerReference,
        createdAt: fundingMethods.createdAt,
      })
      .from(fundingMethods)
      .where(
        and(
          eq(fundingMethods.userId, userId),
          eq(fundingMethods.status, 'verified'),
        ),
      );

    const allowedRails = new Set(capabilityEvaluation.fundingMethods);

    return {
      fundingAllowed: true,
      fundingReasons: [],
      requestedCurrency: currency,
      fundingMethods: methods
        .filter(
          (method) =>
            allowedRails.has(method.rail) &&
            isPaymentMethodAllowedForCountry(method.rail, method.countryCode) &&
            doesFundingRailSupportCurrency(method.rail, currency),
        )
        .map((method) => ({
          ...method,
          supportedCurrencies: getSupportedCurrenciesForFundingRail(
            method.rail,
          ),
        })),
    };
  }
}
