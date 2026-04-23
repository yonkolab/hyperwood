import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  getApiHmacHeaders,
  getApiKeyFromRequest,
  getInternalAuthContext,
  getSessionAuthContext,
  requireBootstrapInternalAuth,
  requireInternalAuth,
  requireSessionAuth,
  requireStepUpAuthorization,
} from './auth-guards';
import { EmailWebhookService } from './email-webhook.service';
import {
  apiKeyParamsSchema,
  authorizeSensitiveActionBodySchema,
  confirmTotpSetupBodySchema,
  createApiKeyBodySchema,
  createOperatorBodySchema,
  createOperatorTokenBodySchema,
  emailWebhookProviderParamsSchema,
  linkExistingUserBodySchema,
  loginBodySchema,
  operatorParamsSchema,
  operatorTokenParamsSchema,
  registerBodySchema,
  requestEmailVerificationBodySchema,
  rotateApiKeyBodySchema,
  sessionParamsSchema,
  verifyEmailBodySchema,
  verifyTotpLoginBodySchema,
} from './schema';
import { IdentityService } from './service';

async function identityRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const emailWebhookService = new EmailWebhookService();
  const requireSession = requireSessionAuth(identityService);
  const requireInternal = requireInternalAuth('identity:link');
  const requireBootstrapInternal = requireBootstrapInternalAuth();
  const requireApiKeyStepUp = requireStepUpAuthorization('api_keys_manage');

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

  app.post('/webhooks/email/providers/:provider', async (request, reply) => {
    emailWebhookProviderParamsSchema.parse(request.params);

    const signatureHeader = request.headers.signature;
    const signature =
      typeof signatureHeader === 'string' ? signatureHeader : undefined;
    const result = await emailWebhookService.processMailerSendWebhook({
      rawBody: request.rawBody ?? JSON.stringify(request.body ?? {}),
      signature,
      body: request.body,
    });

    reply.status(202).send(result);
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

  app.post(
    '/auth/mfa/totp/authorize',
    { preHandler: requireSession },
    async (request, reply) => {
      const body = authorizeSensitiveActionBodySchema.parse(request.body);
      const auth = getSessionAuthContext(request);
      const result = await identityService.authorizeSensitiveActionWithTotp({
        userId: auth.user.id,
        action: body.action,
        code: body.code,
      });

      reply.status(201).send(result);
    },
  );

  app.get('/auth/me', { preHandler: requireSession }, async (request) => {
    const auth = getSessionAuthContext(request);

    return { user: auth.user };
  });

  app.get('/auth/sessions', { preHandler: requireSession }, async (request) => {
    const auth = getSessionAuthContext(request);

    return identityService.listSessions(auth.user.id, auth.sessionToken);
  });

  app.delete(
    '/auth/sessions/current',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const session = await identityService.getSessionFromToken(
        auth.sessionToken,
      );
      const result = await identityService.revokeSession({
        userId: auth.user.id,
        sessionId: session.id,
      });

      reply.send(result);
    },
  );

  app.delete(
    '/auth/sessions/:sessionId',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const params = sessionParamsSchema.parse(request.params);
      const result = await identityService.revokeSession({
        userId: auth.user.id,
        sessionId: params.sessionId,
      });

      reply.send(result);
    },
  );

  app.post(
    '/auth/api-keys',
    { preHandler: [requireSession, requireApiKeyStepUp] },
    async (request, reply) => {
      const body = createApiKeyBodySchema.parse(request.body);
      const auth = getSessionAuthContext(request);
      const result = await identityService.createApiKey({
        userId: auth.user.id,
        scopes: body.scopes,
        mfaAuthorizationToken: auth.stepUp?.authorizationToken,
      });

      reply.status(201).send(result);
    },
  );

  app.get('/auth/api-keys', { preHandler: requireSession }, async (request) => {
    const auth = getSessionAuthContext(request);

    return identityService.listApiKeys(auth.user.id);
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

  app.delete(
    '/auth/api-keys/:apiKeyId',
    { preHandler: [requireSession, requireApiKeyStepUp] },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const params = apiKeyParamsSchema.parse(request.params);
      const result = await identityService.revokeApiKey({
        userId: auth.user.id,
        apiKeyId: params.apiKeyId,
        mfaAuthorizationToken: auth.stepUp?.authorizationToken,
      });

      reply.send(result);
    },
  );

  app.post(
    '/auth/api-keys/:apiKeyId/rotate',
    { preHandler: [requireSession, requireApiKeyStepUp] },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const params = apiKeyParamsSchema.parse(request.params);
      rotateApiKeyBodySchema.parse(request.body ?? {});
      const result = await identityService.rotateApiKey({
        userId: auth.user.id,
        apiKeyId: params.apiKeyId,
        mfaAuthorizationToken: auth.stepUp?.authorizationToken,
      });

      reply.send(result);
    },
  );

  app.post(
    '/auth/mfa/totp/setup',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const result = await identityService.setupTotp({
        userId: auth.user.id,
      });

      reply.status(201).send(result);
    },
  );

  app.post(
    '/auth/mfa/totp/confirm',
    { preHandler: requireSession },
    async (request, reply) => {
      const auth = getSessionAuthContext(request);
      const body = confirmTotpSetupBodySchema.parse(request.body);
      const result = await identityService.confirmTotpSetup({
        userId: auth.user.id,
        factorId: body.factorId,
        code: body.code,
      });

      reply.send(result);
    },
  );

  app.post(
    '/internal/auth/link-existing-user',
    { preHandler: requireInternal },
    async (request, reply) => {
      getInternalAuthContext(request);
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
    },
  );

  app.get(
    '/internal/operators',
    { preHandler: requireBootstrapInternal },
    async (request) => {
      getInternalAuthContext(request);

      return identityService.listOperators({ limit: 100 });
    },
  );

  app.post(
    '/internal/operators',
    { preHandler: requireBootstrapInternal },
    async (request, reply) => {
      getInternalAuthContext(request);
      const body = createOperatorBodySchema.parse(request.body);
      const result = await identityService.createOperator({
        email: body.email,
        ...(body.displayName ? { displayName: body.displayName } : {}),
        roles: body.roles,
      });

      reply.status(201).send(result);
    },
  );

  app.post(
    '/internal/operators/:operatorId/tokens',
    { preHandler: requireBootstrapInternal },
    async (request, reply) => {
      getInternalAuthContext(request);
      const params = operatorParamsSchema.parse(request.params);
      const body = createOperatorTokenBodySchema.parse(request.body);
      const result = await identityService.createOperatorToken({
        operatorId: params.operatorId,
        label: body.label,
      });

      reply.status(201).send(result);
    },
  );

  app.delete(
    '/internal/operators/tokens/:tokenId',
    { preHandler: requireBootstrapInternal },
    async (request, reply) => {
      getInternalAuthContext(request);
      const params = operatorTokenParamsSchema.parse(request.params);
      const result = await identityService.revokeOperatorToken({
        tokenId: params.tokenId,
      });

      reply.send(result);
    },
  );
}

export const registerIdentityRoutes = identityRoutes;
