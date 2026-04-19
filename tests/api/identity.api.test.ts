import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app";
import { loginUser, registerUser } from "../helpers/auth";

describe("identity api", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a user and issues an email verification challenge", async () => {
    const result = await registerUser(app);

    expect(result.response.statusCode).toBe(201);
    expect(result.body.user.email).toBe(result.credentials.email);
    expect(result.body.user.username).toBe(result.credentials.username);
    expect(result.body.verificationChallenge.token).toEqual(expect.any(String));
  });

  it("logs in with the newly created password identity", async () => {
    const registration = await registerUser(app);
    const login = await loginUser(app, registration.credentials);

    expect(login.response.statusCode).toBe(200);
    expect(login.body.user.email).toBe(registration.credentials.email);
    expect(login.body.sessionToken).toEqual(expect.any(String));
    expect(login.body.mfaRequired).toBe(false);
  });

  it("rejects missing bearer auth on wallet balance", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/wallet/balance?currency=USD",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: "missing_session",
      message: "missing bearer session token",
    });
  });
});
