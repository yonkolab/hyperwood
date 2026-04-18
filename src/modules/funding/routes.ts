import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { IdentityService } from "../identity/service";
import { FundingService } from "./service";

const fundingMethodBodySchema = z.object({
  rail: z.enum(["ach", "fps", "pix", "wire", "debit_card", "crypto_wallet"]),
  status: z.enum(["pending_verification", "verified", "disabled"]),
  displayName: z.string().min(2).max(128),
  countryCode: z.string().length(2),
  provider: z.string().min(1).max(64).optional(),
  providerReference: z.string().min(1).max(255).optional(),
  last4: z.string().length(4).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const seedWalletBodySchema = z.object({
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  referenceId: z.string().min(1).max(255).optional(),
});

const fundingUserParamsSchema = z.object({
  userId: z.string().uuid(),
});

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "missing_session", "missing bearer session token");
  }

  return header.slice("Bearer ".length);
}

function assertBootstrapToken(request: FastifyRequest) {
  const bootstrapToken = request.headers["x-bootstrap-token"];

  if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
    throw new AppError(401, "invalid_bootstrap_token", "invalid bootstrap token");
  }
}

async function fundingRoutes(app: FastifyInstance, _options: FastifyPluginOptions) {
  const identityService = new IdentityService();
  const fundingService = new FundingService();

  app.get("/funding/methods", async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return fundingService.listEligibleFundingMethods(user.id);
  });

  app.get("/wallet/balance", async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return fundingService.getWalletBalance(user.id);
  });

  app.post("/internal/funding/users/:userId/methods", async (request, reply) => {
    assertBootstrapToken(request);
    const params = fundingUserParamsSchema.parse(request.params);
    const body = fundingMethodBodySchema.parse(request.body);
    const result = await fundingService.linkFundingMethod({
      userId: params.userId,
      rail: body.rail,
      status: body.status,
      displayName: body.displayName,
      countryCode: body.countryCode,
      ...(body.provider ? { provider: body.provider } : {}),
      ...(body.providerReference ? { providerReference: body.providerReference } : {}),
      ...(body.last4 ? { last4: body.last4 } : {}),
      ...(body.metadata ? { metadata: body.metadata } : {}),
    });

    reply.status(201).send(result);
  });

  app.post("/internal/funding/users/:userId/wallet/seed", async (request, reply) => {
    assertBootstrapToken(request);
    const params = fundingUserParamsSchema.parse(request.params);
    const body = seedWalletBodySchema.parse(request.body);
    const result = await fundingService.seedWalletBalance({
      userId: params.userId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      ...(body.referenceId ? { referenceId: body.referenceId } : {}),
    });

    reply.status(201).send(result);
  });
}

export async function registerFundingRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await fundingRoutes(app, options);
}
