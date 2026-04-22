import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import Fastify, { type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { env } from './config/env';
import { AppError } from './lib/errors';
import { getRequestLogContext } from './lib/observability';
import { InMemoryRateLimiter, type RateLimitScopeType } from './lib/rate-limit';
import { registerComplianceRoutes } from './modules/compliance/routes';
import { registerExchangeRoutes } from './modules/exchange/routes';
import { registerFundingRoutes } from './modules/funding/routes';
import { registerIdentityRoutes } from './modules/identity/routes';
import { registerMarketRoutes } from './modules/markets/routes';
import { RateLimitEventService } from './modules/operations/rate-limit';
import { registerOperationsRoutes } from './modules/operations/routes';
import { registerOrderRoutes } from './modules/orders/routes';
import { registerPortfolioRoutes } from './modules/portfolio/routes';

function parseAllowedOrigins(rawOrigins: string): Set<string> {
  return new Set(
    rawOrigins
      .split(',')
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

  const secondOctet = Number.parseInt(match[1] ?? '', 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isDevelopmentOrigin(origin: string): boolean {
  let candidate: URL;

  try {
    candidate = new URL(origin);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(candidate.protocol)) {
    return false;
  }

  const { hostname } = candidate;

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    return true;
  }

  return isPrivateIpv4Host(hostname);
}

function getPathname(rawUrl: string): string {
  try {
    return new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    return rawUrl;
  }
}

function getRequestEmail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }

  const email = (body as { email?: unknown }).email;

  return typeof email === 'string' && email.length > 0
    ? email.toLowerCase()
    : undefined;
}

function getRateLimitScope(
  request: FastifyRequest,
  pathname: string,
): { scopeKey: string; scopeType: RateLimitScopeType } {
  const requestEmail = getRequestEmail(request.body);

  if (requestEmail) {
    return {
      scopeType: 'email',
      scopeKey: requestEmail,
    };
  }

  const apiKeyHeader = request.headers['x-api-key'];

  if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
    return {
      scopeType: 'api_key',
      scopeKey: apiKeyHeader,
    };
  }

  const authorization = request.headers.authorization;

  if (authorization?.startsWith('Bearer hw_')) {
    return {
      scopeType: 'api_key',
      scopeKey: authorization.slice('Bearer '.length, 'Bearer '.length + 24),
    };
  }

  return {
    scopeType: 'ip',
    scopeKey: request.ip.length > 0 ? request.ip : pathname,
  };
}

function getRateLimitPolicy(
  request: FastifyRequest,
  pathname: string,
):
  | {
      bucket: string;
      limit: number;
      scopeKey: string;
      scopeType: RateLimitScopeType;
      windowSeconds: number;
    }
  | undefined {
  if (
    request.method === 'OPTIONS' ||
    !pathname.startsWith('/api/v1/') ||
    pathname.startsWith('/api/v1/internal/')
  ) {
    return undefined;
  }

  const authPaths = new Set([
    '/api/v1/auth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/request-email-verification',
    '/api/v1/auth/verify-email',
    '/api/v1/auth/mfa/totp/verify',
  ]);

  const scope = getRateLimitScope(request, pathname);

  if (authPaths.has(pathname)) {
    return {
      bucket: 'auth_external',
      limit: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      windowSeconds: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    };
  }

  return {
    bucket: 'api_external',
    limit: env.API_RATE_LIMIT_MAX_REQUESTS,
    scopeType: scope.scopeType,
    scopeKey: scope.scopeKey,
    windowSeconds: env.API_RATE_LIMIT_WINDOW_SECONDS,
  };
}

export async function buildApp(
  options: { logger?: boolean | Record<string, unknown> } = {},
) {
  const app = Fastify({
    logger: options.logger ?? env.NODE_ENV === 'development',
    requestIdHeader: 'x-request-id',
    genReqId(request) {
      const header = request.headers['x-request-id'];

      if (typeof header === 'string' && header.trim().length > 0) {
        return header.trim();
      }

      return randomUUID();
    },
  });

  const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  const rateLimiter = new InMemoryRateLimiter();
  const rateLimitEventService = new RateLimitEventService();

  app.decorateRequest('auth', undefined);

  await app.register(cors, {
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Api-Key',
      'X-Api-Nonce',
      'X-Api-Signature',
      'X-Api-Timestamp',
      'X-Bootstrap-Token',
      'X-Mfa-Authorization',
      'idempotency-key',
      'x-api-key',
      'x-api-nonce',
      'x-api-signature',
      'x-api-timestamp',
      'x-bootstrap-token',
      'x-mfa-authorization',
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

      if (env.NODE_ENV === 'development' && isDevelopmentOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    request.auth = {
      kind: 'public',
    };
    reply.header('X-Request-Id', request.id);
  });

  app.setErrorHandler((error: Error, request, reply) => {
    const structuredError = error as Error & {
      statusCode?: unknown;
      code?: unknown;
    };

    const statusCode =
      typeof structuredError.statusCode === 'number'
        ? structuredError.statusCode
        : 500;

    const code =
      typeof structuredError.code === 'string'
        ? structuredError.code
        : 'internal_error';

    request.log.error(
      {
        err: error,
        ...getRequestLogContext(request),
        statusCode,
        code,
      },
      'request failed',
    );

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: 'invalid_request',
        message: error.issues.map((issue) => issue.message).join('; '),
      });
      return;
    }

    reply.status(statusCode).send({
      error: code,
      message: error.message,
    });
  });

  app.addHook('preHandler', async (request, reply) => {
    const pathname = getPathname(request.raw.url ?? request.url);
    const policy = getRateLimitPolicy(request, pathname);

    if (!policy) {
      return;
    }

    const decision = rateLimiter.evaluate(policy);
    const resetEpochSeconds = Math.ceil(decision.resetAt.getTime() / 1000);

    reply.header('X-RateLimit-Limit', String(decision.limit));
    reply.header('X-RateLimit-Remaining', String(decision.remaining));
    reply.header('X-RateLimit-Reset', String(resetEpochSeconds));

    if (decision.allowed) {
      return;
    }

    reply.header(
      'Retry-After',
      String(
        Math.max(
          1,
          Math.ceil((decision.resetAt.getTime() - Date.now()) / 1000),
        ),
      ),
    );

    request.log.warn(
      {
        event: 'api.rate_limit_exceeded',
        ...getRequestLogContext(request),
        bucket: policy.bucket,
        limit: decision.limit,
        observedCount: decision.observedCount,
        scopeKey: policy.scopeKey,
        scopeType: policy.scopeType,
        windowEndsAt: decision.resetAt.toISOString(),
        windowStartedAt: decision.windowStartedAt.toISOString(),
      },
      'api.rate_limit_exceeded',
    );

    if (decision.shouldRecordExceededEvent) {
      try {
        await rateLimitEventService.recordExceededEvent({
          bucket: policy.bucket,
          limit: decision.limit,
          method: request.method,
          observedCount: decision.observedCount,
          path: pathname,
          requestIp: request.ip,
          scopeKey: policy.scopeKey,
          scopeType: policy.scopeType,
          windowEndsAt: decision.resetAt,
          windowStartedAt: decision.windowStartedAt,
          metadata: {
            userAgent:
              typeof request.headers['user-agent'] === 'string'
                ? request.headers['user-agent']
                : null,
          },
        });
      } catch (error) {
        request.log.error(
          {
            err: error,
            ...getRequestLogContext(request),
            bucket: policy.bucket,
            path: pathname,
            scopeKey: policy.scopeKey,
            scopeType: policy.scopeType,
          },
          'failed to persist rate limit event',
        );
      }
    }

    throw new AppError(429, 'rate_limit_exceeded', 'rate limit exceeded');
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'hyperwood',
  }));

  await app.register(registerIdentityRoutes, {
    prefix: '/api/v1',
  });

  await app.register(registerComplianceRoutes, {
    prefix: '/api/v1',
  });

  await app.register(registerFundingRoutes, {
    prefix: '/api/v1',
  });

  await app.register(registerExchangeRoutes, {
    prefix: '/api/v1',
  });

  await app.register(registerMarketRoutes, {
    prefix: '/api/v1',
  });

  await app.register(registerOrderRoutes, {
    prefix: '/api/v1',
  });

  await app.register(registerOperationsRoutes, {
    prefix: '/api/v1',
  });

  await app.register(registerPortfolioRoutes, {
    prefix: '/api/v1',
  });

  return app;
}
