import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app";
import {
  createMarket,
  createMarketEvent,
  resolveMarket,
  settleMarket,
} from "../helpers/bootstrap";
import { createMatchedMarketScenario } from "../helpers/trading";

describe("markets api", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists a bootstrapped market and returns its detail", async () => {
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/markets?limit=10",
    });

    expect(list.statusCode).toBe(200);
    expect(list.json().markets).toHaveLength(1);
    expect(list.json().markets[0].id).toBe(market.body.market.id);

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/markets/${market.body.market.id}`,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().market.id).toBe(market.body.market.id);
    expect(detail.json().market.currency).toBe("USD");
  });

  it("returns empty order book and trade collections for a new market", async () => {
    const event = await createMarketEvent(app);
    const market = await createMarket(app, event.body.event.id as string);

    const orderBook = await app.inject({
      method: "GET",
      url: `/api/v1/markets/${market.body.market.id}/order-book`,
    });
    const trades = await app.inject({
      method: "GET",
      url: `/api/v1/markets/${market.body.market.id}/trades`,
    });
    const deltas = await app.inject({
      method: "GET",
      url: `/api/v1/markets/${market.body.market.id}/order-book/deltas`,
    });

    expect(orderBook.statusCode).toBe(200);
    expect(orderBook.json().books.yes.bids).toEqual([]);
    expect(orderBook.json().books.no.asks).toEqual([]);

    expect(trades.statusCode).toBe(200);
    expect(trades.json().trades).toEqual([]);

    expect(deltas.statusCode).toBe(200);
    expect(deltas.json().deltas).toEqual([]);
  });

  it("rejects internal market creation without the bootstrap token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/internal/markets/events",
      payload: {
        slug: "missing-token",
        title: "Missing token",
        category: "sports",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "invalid_bootstrap_token",
    });
  });

  it("resolves and settles a matched market through internal endpoints", async () => {
    const scenario = await createMatchedMarketScenario(app, {
      currency: "USD",
      quantity: 10,
      limitPriceBps: 4800,
    });

    expect(scenario.buyOrder.statusCode).toBe(201);
    expect(scenario.sellOrder.statusCode).toBe(201);
    expect(scenario.match.response.statusCode).toBe(200);
    expect(scenario.match.body.summary.matchedTradeCount).toBe(1);

    const resolve = await resolveMarket(app, scenario.market.body.market.id as string, {
      outcome: "yes",
      evidenceSummary: "Official election authority certified the result.",
      evidenceSources: ["https://example.com/election-result"],
    });

    expect(resolve.response.statusCode).toBe(200);
    expect(resolve.body.market.status).toBe("awaiting_resolution");
    expect(resolve.body.resolution.outcome).toBe("yes");

    const settle = await settleMarket(app, scenario.market.body.market.id as string);

    expect(settle.response.statusCode).toBe(201);
    expect(settle.body.alreadySettled).toBe(false);
    expect(settle.body.settlement.outcome).toBe("yes");
    expect(settle.body.settlement.totalPayoutMinor).toBe(1_000);
    expect(settle.body.payouts).toHaveLength(2);

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/markets/${scenario.market.body.market.id}`,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().market.status).toBe("settled");
    expect(detail.json().market.resolution.outcome).toBe("yes");
    expect(detail.json().market.settlement.totalPayoutMinor).toBe(1_000);
    expect(detail.json().market.yesPriceBps).toBe(10000);
    expect(detail.json().market.noPriceBps).toBe(0);
  });
});
