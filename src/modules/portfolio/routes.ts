import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../lib/errors";
import { IdentityService } from "../identity/service";
import { PortfolioService } from "./service";

const fillsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "missing_session", "missing bearer session token");
  }

  return header.slice("Bearer ".length);
}

async function portfolioRoutes(app: FastifyInstance, _options: FastifyPluginOptions) {
  const identityService = new IdentityService();
  const portfolioService = new PortfolioService();

  app.get("/portfolio", async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.getPortfolioSummary(user.id);
  });

  app.get("/portfolio/fills", async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const query = fillsQuerySchema.parse(request.query);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return portfolioService.listFills(user.id, query.limit);
  });
}

export async function registerPortfolioRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await portfolioRoutes(app, options);
}
