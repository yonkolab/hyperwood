import { describe, expect, it } from "vitest";
import {
  doesFundingRailSupportCurrency,
  getAllowedFundingRailsForCountry,
  getSupportedCurrenciesForFundingRail,
  isFundingRailAllowedForCountry,
} from "../../../../src/modules/funding/policy";

describe("funding policy", () => {
  it("returns country-specific rails with wire fallback", () => {
    expect(getAllowedFundingRailsForCountry("BR")).toEqual(["pix", "wire"]);
    expect(getAllowedFundingRailsForCountry("unknown")).toEqual(["wire"]);
  });

  it("exposes supported currencies per rail", () => {
    expect(getSupportedCurrenciesForFundingRail("ach")).toEqual(["USD"]);
    expect(getSupportedCurrenciesForFundingRail("pix")).toEqual(["BRL"]);
  });

  it("checks country and currency compatibility", () => {
    expect(isFundingRailAllowedForCountry("pix", "BR")).toBe(true);
    expect(isFundingRailAllowedForCountry("pix", "US")).toBe(false);
    expect(doesFundingRailSupportCurrency("wire", "brl")).toBe(true);
    expect(doesFundingRailSupportCurrency("ach", "BRL")).toBe(false);
  });
});
