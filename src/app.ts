import Fastify from "fastify";
import { env } from "./config/env";
import { registerComplianceRoutes } from "./modules/compliance/routes";
import { registerFundingRoutes } from "./modules/funding/routes";
import { registerIdentityRoutes } from "./modules/identity/routes";
import { registerMarketRoutes } from "./modules/markets/routes";
import { registerOrderRoutes } from "./modules/orders/routes";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "development",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "hyperwood",
  }));

  await app.register(registerIdentityRoutes, {
    prefix: "/api/v1",
  });

  await app.register(registerComplianceRoutes, {
    prefix: "/api/v1",
  });

  await app.register(registerFundingRoutes, {
    prefix: "/api/v1",
  });

  await app.register(registerMarketRoutes, {
    prefix: "/api/v1",
  });

  await app.register(registerOrderRoutes, {
    prefix: "/api/v1",
  });

  app.setErrorHandler((error: Error, _request, reply) => {
    app.log.error(error);
    const structuredError = error as Error & {
      statusCode?: unknown;
      code?: unknown;
    };

    const statusCode =
      typeof structuredError.statusCode === "number"
        ? structuredError.statusCode
        : 500;

    const code =
      typeof structuredError.code === "string"
        ? structuredError.code
        : "internal_error";

    reply.status(statusCode).send({
      error: code,
      message: error.message,
    });
  });

  return app;
}
