import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { OperationsService } from "./service";

const listReviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
});

function assertBootstrapToken(request: FastifyRequest) {
  const bootstrapToken = request.headers["x-bootstrap-token"];

  if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
    throw new AppError(401, "invalid_bootstrap_token", "invalid bootstrap token");
  }
}

async function operationsRoutes(app: FastifyInstance, _options: FastifyPluginOptions) {
  const operationsService = new OperationsService();

  app.get("/internal/operations/reviews", async (request) => {
    assertBootstrapToken(request);
    const query = listReviewQueueQuerySchema.parse(request.query);

    return operationsService.listActiveReviewQueue({
      limit: query.limit,
    });
  });
}

export async function registerOperationsRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await operationsRoutes(app, options);
}
