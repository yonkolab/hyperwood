import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app";
import { createVerifiedSession } from "../helpers/auth";
import { seedWallet } from "../helpers/bootstrap";

describe("portfolio api", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns wallet-derived portfolio cash and empty positions", async () => {
    const session = await createVerifiedSession(app);
    await seedWallet(app, session.body.user.id as string, {
      amountMinor: 20_000,
      currency: "USD",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/portfolio?currency=USD",
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().currency).toBe("USD");
    expect(response.json().cash.availableBalanceMinor).toBe(20_000);
    expect(response.json().positions).toEqual([]);
    expect(response.json().recentFills).toEqual([]);
  });

  it("returns an empty fills collection for a new user", async () => {
    const session = await createVerifiedSession(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/portfolio/fills?currency=USD&limit=10",
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      currency: "USD",
      fills: [],
    });
  });
});
