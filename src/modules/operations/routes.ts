import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { OperationsService } from "./service";

const listReviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
});

const listAuditEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  targetType: z.string().min(1).max(64).optional(),
  targetId: z.string().min(1).max(255).optional(),
  action: z.string().min(1).max(128).optional(),
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

  app.get("/internal/operations/audit-events", async (request) => {
    assertBootstrapToken(request);
    const query = listAuditEventsQuerySchema.parse(request.query);

    return operationsService.listAuditEvents({
      limit: query.limit,
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.action ? { action: query.action } : {}),
    });
  });
}

export async function registerOperationsRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await operationsRoutes(app, options);
}
