import { describe, expect, it } from "vitest";
import { buildTotpOtpAuthUri, verifyTotpCode } from "../../../src/lib/totp";

describe("totp helpers", () => {
  it("builds an otpauth URI with encoded issuer and account name", () => {
    const uri = buildTotpOtpAuthUri({
      issuer: "Hyperwood Test",
      accountName: "user@example.com",
      secret: "JBSWY3DPEHPK3PXP",
    });

    expect(uri).toBe(
      "otpauth://totp/Hyperwood%20Test:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Hyperwood%20Test&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("accepts a valid RFC6238-derived 6 digit code", () => {
    const valid = verifyTotpCode({
      secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      code: "287082",
      now: new Date(59_000),
      window: 0,
    });

    expect(valid).toBe(true);
  });

  it("rejects codes with invalid format", () => {
    expect(
      verifyTotpCode({
        secret: "JBSWY3DPEHPK3PXP",
        code: "12ab56",
      }),
    ).toBe(false);
  });
});
