import Fastify from "fastify";
import { env } from "./config/env.js";
import { registerIdentityRoutes } from "./modules/identity/routes.js";

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

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    const code =
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "internal_error";

    reply.status(statusCode).send({
      error: code,
      message: error.message,
    });
  });

  return app;
}

