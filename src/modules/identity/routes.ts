import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { IdentityService } from "./service";

const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(64).optional(),
  password: z.string().min(10),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const requestEmailVerificationBodySchema = z.object({
  email: z.string().email(),
});

const verifyEmailBodySchema = z.object({
  token: z.string().min(1),
});

const confirmTotpSetupBodySchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

const verifyTotpLoginBodySchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

const linkExistingUserBodySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(10),
  emailVerified: z.boolean().optional(),
});

const createApiKeyBodySchema = z.object({
  scopes: z.array(z.string().min(1)).min(1),
});

const apiKeyParamsSchema = z.object({
  apiKeyId: z.string().uuid(),
});

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "missing_session", "missing bearer session token");
  }

  return header.slice("Bearer ".length);
}

async function identityRoutes(app: FastifyInstance, _options: FastifyPluginOptions) {
  const identityService = new IdentityService();

  app.post("/auth/register", async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const result = await identityService.register({
      email: body.email,
      password: body.password,
      ...(body.username ? { username: body.username } : {}),
    });

    reply.status(201).send(result);
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await identityService.login({
      email: body.email,
      password: body.password,
      ipAddress: request.ip,
      ...(request.headers["user-agent"]
        ? { userAgent: request.headers["user-agent"] }
        : {}),
    });

    reply.send(result);
  });

  app.post("/auth/request-email-verification", async (request, reply) => {
    const body = requestEmailVerificationBodySchema.parse(request.body);
    const result = await identityService.requestEmailVerification({
      email: body.email,
    });

    reply.status(201).send(result);
  });

  app.post("/auth/verify-email", async (request, reply) => {
    const body = verifyEmailBodySchema.parse(request.body);
    const result = await identityService.verifyEmail({
      token: body.token,
    });

    reply.send(result);
  });

  app.post("/auth/mfa/totp/verify", async (request, reply) => {
    const body = verifyTotpLoginBodySchema.parse(request.body);
    const result = await identityService.verifyTotpLogin({
      challengeToken: body.challengeToken,
      code: body.code,
      ipAddress: request.ip,
      ...(request.headers["user-agent"]
        ? { userAgent: request.headers["user-agent"] }
        : {}),
    });

    reply.send(result);
  });

  app.get("/auth/me", async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return { user };
  });

  app.post("/auth/api-keys", async (request, reply) => {
    const body = createApiKeyBodySchema.parse(request.body);
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await identityService.createApiKey({
      userId: user.id,
      scopes: body.scopes,
    });

    reply.status(201).send(result);
  });

  app.get("/auth/api-keys", async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return identityService.listApiKeys(user.id);
  });

  app.delete("/auth/api-keys/:apiKeyId", async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const params = apiKeyParamsSchema.parse(request.params);
    const result = await identityService.revokeApiKey({
      userId: user.id,
      apiKeyId: params.apiKeyId,
    });

    reply.send(result);
  });

  app.post("/auth/mfa/totp/setup", async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await identityService.setupTotp({
      userId: user.id,
    });

    reply.status(201).send(result);
  });

  app.post("/auth/mfa/totp/confirm", async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const body = confirmTotpSetupBodySchema.parse(request.body);
    const result = await identityService.confirmTotpSetup({
      userId: user.id,
      factorId: body.factorId,
      code: body.code,
    });

    reply.send(result);
  });

  app.post("/internal/auth/link-existing-user", async (request, reply) => {
    const bootstrapToken = request.headers["x-bootstrap-token"];

    if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
      throw new AppError(403, "forbidden", "invalid bootstrap token");
    }

    const body = linkExistingUserBodySchema.parse(request.body);
    const result = await identityService.linkExistingUser({
      userId: body.userId,
      email: body.email,
      password: body.password,
      ...(body.emailVerified !== undefined
        ? { emailVerified: body.emailVerified }
        : {}),
    });

    reply.status(201).send(result);
  });
}

export const registerIdentityRoutes = identityRoutes;
