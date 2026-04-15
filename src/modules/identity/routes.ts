import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { IdentityService } from "./service.js";

const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(64).optional(),
  password: z.string().min(10),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
    const result = await identityService.register(body);

    reply.status(201).send(result);
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await identityService.login({
      ...body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
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

  app.post("/internal/auth/link-existing-user", async (request, reply) => {
    const bootstrapToken = request.headers["x-bootstrap-token"];

    if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
      throw new AppError(403, "forbidden", "invalid bootstrap token");
    }

    const body = linkExistingUserBodySchema.parse(request.body);
    const result = await identityService.linkExistingUser(body);

    reply.status(201).send(result);
  });
}

export const registerIdentityRoutes = fp(identityRoutes);
