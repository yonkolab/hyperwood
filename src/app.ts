import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env";
import { registerComplianceRoutes } from "./modules/compliance/routes";
import { registerFundingRoutes } from "./modules/funding/routes";
import { registerIdentityRoutes } from "./modules/identity/routes";
import { registerMarketRoutes } from "./modules/markets/routes";
import { registerOperationsRoutes } from "./modules/operations/routes";
import { registerOrderRoutes } from "./modules/orders/routes";
import { registerPortfolioRoutes } from "./modules/portfolio/routes";

function parseAllowedOrigins(rawOrigins: string): Set<string> {
  return new Set(
    rawOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}

function isPrivateIpv4Host(hostname: string): boolean {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);

  if (!match) {
    return false;
  }

  const secondOctet = Number.parseInt(match[1] ?? "", 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isDevelopmentOrigin(origin: string): boolean {
  let candidate: URL;

  try {
    candidate = new URL(origin);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(candidate.protocol)) {
    return false;
  }

  const { hostname } = candidate;

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }

  return isPrivateIpv4Host(hostname);
}

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "development",
  });

  const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);

  await app.register(cors, {
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Accept",
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "X-Api-Key",
      "X-Api-Nonce",
      "X-Api-Signature",
      "X-Api-Timestamp",
      "X-Bootstrap-Token",
      "X-Mfa-Authorization",
      "idempotency-key",
      "x-api-key",
      "x-api-nonce",
      "x-api-signature",
      "x-api-timestamp",
      "x-bootstrap-token",
      "x-mfa-authorization",
    ],
    maxAge: 86400,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV === "development" && isDevelopmentOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
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

  await app.register(registerOperationsRoutes, {
    prefix: "/api/v1",
  });

  await app.register(registerPortfolioRoutes, {
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
