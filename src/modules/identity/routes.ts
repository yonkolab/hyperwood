import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import {
  apiKeyParamsSchema,
  authorizeSensitiveActionBodySchema,
  confirmTotpSetupBodySchema,
  createApiKeyBodySchema,
  linkExistingUserBodySchema,
  loginBodySchema,
  registerBodySchema,
  requestEmailVerificationBodySchema,
  verifyEmailBodySchema,
  verifyTotpLoginBodySchema,
} from './schema';
import { IdentityService } from './service';

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'missing_session', 'missing bearer session token');
  }

  return header.slice('Bearer '.length);
}

function getApiKeyFromRequest(request: FastifyRequest) {
  const headerApiKey = request.headers['x-api-key'];

  if (typeof headerApiKey === 'string' && headerApiKey.length > 0) {
    return headerApiKey;
  }

  const authorization = request.headers.authorization;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length);

    if (token.startsWith('hw_')) {
      return token;
    }
  }

  throw new AppError(401, 'missing_api_key', 'missing api key');
}

function getApiHmacHeaders(request: FastifyRequest) {
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

function getOptionalMfaActionAuthorizationTokenFromRequest(
  request: FastifyRequest,
) {
  const header = request.headers['x-mfa-authorization'];

  if (typeof header === 'string' && header.length > 0) {
    return header;
  }

  return undefined;
}

async function identityRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();

  app.post('/auth/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const result = await identityService.register({
      email: body.email,
      password: body.password,
      ...(body.username ? { username: body.username } : {}),
    });

    reply.status(201).send(result);
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await identityService.login({
      email: body.email,
      password: body.password,
      ipAddress: request.ip,
      ...(request.headers['user-agent']
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    reply.send(result);
  });

  app.post('/auth/request-email-verification', async (request, reply) => {
    const body = requestEmailVerificationBodySchema.parse(request.body);
    const result = await identityService.requestEmailVerification({
      email: body.email,
    });

    reply.status(201).send(result);
  });

  app.post('/auth/verify-email', async (request, reply) => {
    const body = verifyEmailBodySchema.parse(request.body);
    const result = await identityService.verifyEmail({
      token: body.token,
    });

    reply.send(result);
  });

  app.post('/auth/mfa/totp/verify', async (request, reply) => {
    const body = verifyTotpLoginBodySchema.parse(request.body);
    const result = await identityService.verifyTotpLogin({
      challengeToken: body.challengeToken,
      code: body.code,
      ipAddress: request.ip,
      ...(request.headers['user-agent']
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    reply.send(result);
  });

  app.post('/auth/mfa/totp/authorize', async (request, reply) => {
    const body = authorizeSensitiveActionBodySchema.parse(request.body);
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await identityService.authorizeSensitiveActionWithTotp({
      userId: user.id,
      action: body.action,
      code: body.code,
    });

    reply.status(201).send(result);
  });

  app.get('/auth/me', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return { user };
  });

  app.post('/auth/api-keys', async (request, reply) => {
    const body = createApiKeyBodySchema.parse(request.body);
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await identityService.createApiKey({
      userId: user.id,
      scopes: body.scopes,
      mfaAuthorizationToken:
        getOptionalMfaActionAuthorizationTokenFromRequest(request),
    });

    reply.status(201).send(result);
  });

  app.get('/auth/api-keys', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return identityService.listApiKeys(user.id);
  });

  app.get('/auth/api-key/me', async (request) => {
    const rawApiKey = getApiKeyFromRequest(request);

    return identityService.authenticateApiKey({
      rawApiKey,
      requiredScopes: ['account:read'],
    });
  });

  app.get('/auth/api-key/hmac/me', async (request) => {
    const headers = getApiHmacHeaders(request);

    return identityService.authenticateHmacApiKey({
      keyPrefix: headers.keyPrefix,
      timestamp: headers.timestamp,
      nonce: headers.nonce,
      signature: headers.signature,
      method: request.method,
      path: request.raw.url ?? request.url,
      requiredScopes: ['account:read'],
    });
  });

  app.delete('/auth/api-keys/:apiKeyId', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const params = apiKeyParamsSchema.parse(request.params);
    const result = await identityService.revokeApiKey({
      userId: user.id,
      apiKeyId: params.apiKeyId,
      mfaAuthorizationToken:
        getOptionalMfaActionAuthorizationTokenFromRequest(request),
    });

    reply.send(result);
  });

  app.post('/auth/mfa/totp/setup', async (request, reply) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);
    const result = await identityService.setupTotp({
      userId: user.id,
    });

    reply.status(201).send(result);
  });

  app.post('/auth/mfa/totp/confirm', async (request, reply) => {
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

  app.post('/internal/auth/link-existing-user', async (request, reply) => {
    const bootstrapToken = request.headers['x-bootstrap-token'];

    if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
      throw new AppError(403, 'forbidden', 'invalid bootstrap token');
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
