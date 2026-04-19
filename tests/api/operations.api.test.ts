import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app";
import { createVerifiedSession } from "../helpers/auth";
import {
  linkFundingMethod,
  seedWallet,
  upsertApprovedComplianceProfile,
} from "../helpers/bootstrap";

describe("operations api", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists active withdrawal review items for internal operators", async () => {
    const session = await createVerifiedSession(app);
    await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    const fundingMethod = await linkFundingMethod(app, session.body.user.id as string);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 500_000,
      currency: "USD",
    });

    const withdrawal = await app.inject({
      method: "POST",
      url: "/api/v1/funding/withdrawals",
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        fundingMethodId: fundingMethod.body.fundingMethod.id,
        amountMinor: 300_000,
        currency: "USD",
      },
    });

    expect(withdrawal.statusCode).toBe(201);

    const queue = await app.inject({
      method: "GET",
      url: "/api/v1/internal/operations/reviews?limit=10",
      headers: {
        "x-bootstrap-token": process.env.INTERNAL_BOOTSTRAP_TOKEN ?? "test-bootstrap-token",
      },
    });

    expect(queue.statusCode).toBe(200);
    expect(queue.json().withdrawalReviews).toHaveLength(1);
    expect(queue.json().withdrawalReviews[0].withdrawalId).toBe(
      withdrawal.json().withdrawal.id,
    );
  });
});
