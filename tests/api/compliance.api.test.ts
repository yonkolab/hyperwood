import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createVerifiedSession } from "../helpers/auth";
import { upsertApprovedComplianceProfile } from "../helpers/bootstrap";
import { buildTestApp } from "../helpers/app";

describe("compliance api", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns default restricted capabilities before a compliance profile exists", async () => {
    const session = await createVerifiedSession(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/compliance/me/capabilities",
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().capabilities.trading.allowed).toBe(false);
    expect(response.json().capabilities.trading.reasons).toContain("missing_compliance_profile");
  });

  it("accepts an internal approved profile update and enables funding methods", async () => {
    const session = await createVerifiedSession(app);

    const upsert = await upsertApprovedComplianceProfile(app, session.body.user.id as string);
    expect(upsert.response.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/compliance/me/capabilities",
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().capabilities.funding.allowed).toBe(true);
    expect(response.json().fundingMethods).toContain("ach");
  });
});
