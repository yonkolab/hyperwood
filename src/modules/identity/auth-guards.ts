import type { InferSelectModel } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env';
import type { apiKeys, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { SensitiveAction } from './types';

type SessionUser = InferSelectModel<typeof users>;
type ApiKeyRecord = InferSelectModel<typeof apiKeys>;

export type RequestAuthContext =
  | {
      kind: 'public';
    }
  | {
      kind: 'session';
      user: SessionUser;
      sessionToken: string;
      stepUp?: {
        action: SensitiveAction;
        authorizationToken: string | undefined;
      };
    }
  | {
      kind: 'api_key';
      user: SessionUser;
      apiKey: Pick<ApiKeyRecord, 'id' | 'keyPrefix' | 'scopes'>;
      scopes: string[];
    }
  | {
      kind: 'internal';
      internalActor: 'bootstrap';
    };

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestAuthContext | undefined;
  }
}

export type SessionAuthContext = Extract<
  RequestAuthContext,
  { kind: 'session' }
>;
export type InternalAuthContext = Extract<
  RequestAuthContext,
  { kind: 'internal' }
>;

function hasBearerAuthorization(request: FastifyRequest) {
  return typeof request.headers.authorization === 'string'
    ? request.headers.authorization.startsWith('Bearer ')
    : false;
}

export function getSessionBearerToken(request: FastifyRequest) {
  if (!hasBearerAuthorization(request)) {
    throw new AppError(401, 'missing_session', 'missing bearer session token');
  }

  const authorization = request.headers.authorization;

  if (!authorization) {
    throw new AppError(401, 'missing_session', 'missing bearer session token');
  }

  return authorization.slice('Bearer '.length);
}

export function getApiKeyFromRequest(request: FastifyRequest) {
  const headerApiKey = request.headers['x-api-key'];

  if (typeof headerApiKey === 'string' && headerApiKey.length > 0) {
    return headerApiKey;
  }

  if (!hasBearerAuthorization(request)) {
    throw new AppError(401, 'missing_api_key', 'missing api key');
  }

  const authorization = request.headers.authorization;

  if (!authorization) {
    throw new AppError(401, 'missing_api_key', 'missing api key');
  }

  const token = authorization.slice('Bearer '.length);

  if (token.startsWith('hw_')) {
    return token;
  }

  throw new AppError(401, 'missing_api_key', 'missing api key');
}

export function getApiHmacHeaders(request: FastifyRequest) {
  const keyPrefix = request.headers['x-api-key'];
  const timestamp = request.headers['x-api-timestamp'];
  const nonce = request.headers['x-api-nonce'];
  const signature = request.headers['x-api-signature'];

  if (typeof keyPrefix !== 'string' || keyPrefix.length === 0) {
    throw new AppError(401, 'missing_api_key', 'missing api key identifier');
  }

  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    throw new AppError(
      401,
      'missing_api_signature',
      'missing api signature timestamp',
    );
  }

  if (typeof nonce !== 'string' || nonce.length === 0) {
    throw new AppError(
      401,
      'missing_api_signature',
      'missing api signature nonce',
    );
  }

  if (typeof signature !== 'string' || signature.length === 0) {
    throw new AppError(401, 'missing_api_signature', 'missing api signature');
  }

  return {
    keyPrefix,
    timestamp,
    nonce,
    signature,
  };
}

export function getOptionalStepUpAuthorizationToken(request: FastifyRequest) {
  const header = request.headers['x-mfa-authorization'];

  if (typeof header === 'string' && header.length > 0) {
    return header;
  }

  return undefined;
}

export function requireSessionAuth(identityService: {
  getUserFromSessionToken(sessionToken: string): Promise<SessionUser>;
}) {
  /**
   * Resolve the session principal once and attach it to the Fastify request.
   *
   * Example:
   * `preHandler: requireSessionAuth(identityService)`
   */
  return async function onSessionAuth(request: FastifyRequest) {
    const sessionToken = getSessionBearerToken(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    request.auth = {
      kind: 'session',
      user,
      sessionToken,
    };
  };
}

export function requireInternalAuth() {
  /**
   * Enforce the current bootstrap-token internal access model.
   *
   * Example:
   * `preHandler: requireInternalAuth()`
   */
  return async function onInternalAuth(request: FastifyRequest) {
    const bootstrapToken = request.headers['x-bootstrap-token'];

    if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
      throw new AppError(
        401,
        'invalid_bootstrap_token',
        'invalid bootstrap token',
      );
    }

    request.auth = {
      kind: 'internal',
      internalActor: 'bootstrap',
    };
  };
}

export function requireStepUpAuthorization(action: SensitiveAction) {
  /**
   * Standardize step-up token capture without changing downstream domain rules.
   *
   * Example:
   * `preHandler: [requireSession, requireStepUpAuthorization('api_keys_manage')]`
   */
  return async function onStepUpAuthorization(request: FastifyRequest) {
    const auth = getSessionAuthContext(request);

    request.auth = {
      ...auth,
      stepUp: {
        action,
        authorizationToken: getOptionalStepUpAuthorizationToken(request),
      },
    };
  };
}

export function getSessionAuthContext(
  request: FastifyRequest,
): SessionAuthContext {
  if (!request.auth || request.auth.kind !== 'session') {
    throw new AppError(
      500,
      'auth_context_missing',
      'expected session auth context before handler execution',
    );
  }

  return request.auth;
}

export function getInternalAuthContext(
  request: FastifyRequest,
): InternalAuthContext {
  if (!request.auth || request.auth.kind !== 'internal') {
    throw new AppError(
      500,
      'auth_context_missing',
      'expected internal auth context before handler execution',
    );
  }

  return request.auth;
}
