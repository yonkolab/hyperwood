import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { emailVerificationTokens, userIdentities, users } from "../../src/db/schema";

describe("IdentityService integration", () => {
  let IdentityService: typeof import("../../src/modules/identity/service").IdentityService;
  let db: typeof import("../../src/db/client").db;

  beforeAll(async () => {
    ({ IdentityService } = await import("../../src/modules/identity/service.js"));
    ({ db } = await import("../../src/db/client.js"));
  });

  it("registers a user, password identity, and verification token in postgres", async () => {
    const service = new IdentityService();
    const result = await service.register({
      email: "integration-user@example.com",
      username: "integrationuser",
      password: "supersecure123",
    });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, result.user.id))
      .limit(1);
    const [identity] = await db
      .select()
      .from(userIdentities)
      .where(eq(userIdentities.userId, result.user.id))
      .limit(1);
    const [verificationToken] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, result.user.id))
      .limit(1);

    expect(user?.email).toBe("integration-user@example.com");
    expect(identity?.provider).toBe("password");
    expect(identity?.providerSubject).toBe("integration-user@example.com");
    expect(identity?.passwordHash).not.toBe("supersecure123");
    expect(verificationToken?.tokenHash).toBeTruthy();
    expect(result.verificationChallenge.token).toEqual(expect.any(String));
  });
});
