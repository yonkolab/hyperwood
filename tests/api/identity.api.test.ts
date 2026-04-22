import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../src/db/client';
import { userSessions } from '../../src/db/schema';
import { hmacSha256Hex } from '../../src/lib/crypto';
import { buildApiHmacPayload } from '../../src/modules/identity/identity-workflow-support';
import { buildTestApp } from '../helpers/app';
import {
  createVerifiedSession,
  loginUser,
  registerUser,
  verifyEmail,
} from '../helpers/auth';

describe('identity api', () => {
  let app: FastifyInstance;
  const authRateLimitMaxRequests = Number.parseInt(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS ?? '100',
    10,
  );

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and issues an email verification challenge', async () => {
    const result = await registerUser(app);

    expect(result.response.statusCode).toBe(201);
    expect(result.body.user.email).toBe(result.credentials.email);
    expect(result.body.user.username).toBe(result.credentials.username);
    expect(result.body.verificationChallenge.token).toEqual(expect.any(String));
  });

  it('logs in with the newly created password identity', async () => {
    const registration = await registerUser(app);
    const login = await loginUser(app, registration.credentials);

    expect(login.response.statusCode).toBe(200);
    expect(login.body.user.email).toBe(registration.credentials.email);
    expect(login.body.sessionToken).toEqual(expect.any(String));
    expect(login.body.mfaRequired).toBe(false);
  });

  it('rejects missing bearer auth on wallet balance', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/wallet/balance?currency=USD',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'missing_session',
      message: 'missing bearer session token',
    });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('rejects invalid bootstrap auth on internal identity linking', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/auth/link-existing-user',
      headers: {
        'x-bootstrap-token': 'invalid-token',
      },
      payload: {
        userId: 'user_123',
        email: 'linked@example.com',
        password: 'Password123!',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'invalid_bootstrap_token',
      message: 'invalid bootstrap token',
    });
  });

  it('lists and revokes authenticated sessions', async () => {
    const registration = await registerUser(app);

    expect(registration.response.statusCode).toBe(201);

    const verification = await verifyEmail(
      app,
      registration.body.verificationChallenge.token as string,
    );

    expect(verification.response.statusCode).toBe(200);

    const firstLogin = await loginUser(app, registration.credentials);
    const secondLogin = await loginUser(app, registration.credentials);

    expect(firstLogin.response.statusCode).toBe(200);
    expect(secondLogin.response.statusCode).toBe(200);

    const sessions = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        authorization: `Bearer ${firstLogin.body.sessionToken}`,
      },
    });

    expect(sessions.statusCode).toBe(200);
    expect(sessions.json().sessions).toHaveLength(2);
    expect(sessions.json().sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          current: true,
        }),
        expect.objectContaining({
          current: false,
        }),
      ]),
    );

    const otherSession = sessions
      .json()
      .sessions.find(
        (session: { current: boolean; id: string }) => !session.current,
      );

    expect(otherSession).toBeDefined();

    const revokeOther = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/sessions/${otherSession.id}`,
      headers: {
        authorization: `Bearer ${firstLogin.body.sessionToken}`,
      },
    });

    expect(revokeOther.statusCode).toBe(200);
    expect(revokeOther.json()).toMatchObject({
      sessionId: otherSession.id,
      revoked: true,
      alreadyRevoked: false,
    });

    const revokedSessionAccess = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${secondLogin.body.sessionToken}`,
      },
    });

    expect(revokedSessionAccess.statusCode).toBe(401);
    expect(revokedSessionAccess.json()).toMatchObject({
      error: 'invalid_session',
    });

    const revokeCurrent = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/sessions/current',
      headers: {
        authorization: `Bearer ${firstLogin.body.sessionToken}`,
      },
    });

    expect(revokeCurrent.statusCode).toBe(200);
    expect(revokeCurrent.json()).toMatchObject({
      revoked: true,
      alreadyRevoked: false,
    });

    const currentSessionAccess = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${firstLogin.body.sessionToken}`,
      },
    });

    expect(currentSessionAccess.statusCode).toBe(401);
    expect(currentSessionAccess.json()).toMatchObject({
      error: 'invalid_session',
    });
  });

  it('rejects sessions that exceeded the inactivity timeout', async () => {
    const session = await createVerifiedSession(app);
    const sessions = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(sessions.statusCode).toBe(200);
    const sessionId = sessions.json().sessions[0].id as string;
    const staleLastSeenAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

    await db
      .update(userSessions)
      .set({
        lastSeenAt: staleLastSeenAt,
      })
      .where(eq(userSessions.id, sessionId));

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(me.statusCode).toBe(401);
    expect(me.json()).toMatchObject({
      error: 'session_idle_expired',
    });
  });

  it('rate limits repeated public auth requests for the same email', async () => {
    const registration = await registerUser(app);

    expect(registration.response.statusCode).toBe(201);

    const attempts = await Promise.all(
      Array.from({ length: authRateLimitMaxRequests + 1 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/request-email-verification',
          payload: {
            email: registration.credentials.email,
          },
        }),
      ),
    );

    const finalAttempt = attempts.at(-1);

    expect(finalAttempt?.statusCode).toBe(429);
    expect(finalAttempt?.json()).toMatchObject({
      error: 'rate_limit_exceeded',
      message: 'rate limit exceeded',
    });
    expect(finalAttempt?.headers['x-ratelimit-limit']).toBe(
      authRateLimitMaxRequests.toString(),
    );
    expect(finalAttempt?.headers['retry-after']).toEqual(expect.any(String));
  });

  it('rotates an api key secret and invalidates the previous raw key and hmac secret', async () => {
    const session = await createVerifiedSession(app);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/api-keys',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {
        scopes: ['account:read'],
      },
    });

    expect(created.statusCode).toBe(201);
    const createdBody = created.json();
    const oldRawApiKey = createdBody.apiKey as string;
    const oldSecret = oldRawApiKey.split('.')[1];

    expect(oldSecret).toEqual(expect.any(String));

    const rawAuthBeforeRotate = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/api-key/me',
      headers: {
        authorization: `Bearer ${oldRawApiKey}`,
      },
    });

    expect(rawAuthBeforeRotate.statusCode).toBe(200);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `nonce-${Date.now()}`;
    const path = '/api/v1/auth/api-key/hmac/me';
    const hmacBeforeRotate = await app.inject({
      method: 'GET',
      url: path,
      headers: {
        'x-api-key': createdBody.keyPrefix as string,
        'x-api-timestamp': timestamp,
        'x-api-nonce': nonce,
        'x-api-signature': hmacSha256Hex(
          oldSecret,
          buildApiHmacPayload({
            method: 'GET',
            path,
            timestamp,
            nonce,
          }),
        ),
      },
    });

    expect(hmacBeforeRotate.statusCode).toBe(200);

    const listBeforeRotate = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/api-keys',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
    });

    expect(listBeforeRotate.statusCode).toBe(200);
    expect(listBeforeRotate.json().apiKeys).toHaveLength(1);

    const rotated = await app.inject({
      method: 'POST',
      url: `/api/v1/auth/api-keys/${listBeforeRotate.json().apiKeys[0].id}/rotate`,
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
      },
      payload: {},
    });

    expect(rotated.statusCode).toBe(200);
    expect(rotated.json()).toMatchObject({
      apiKeyId: listBeforeRotate.json().apiKeys[0].id,
      keyPrefix: createdBody.keyPrefix,
      scopes: ['account:read'],
    });

    const newRawApiKey = rotated.json().apiKey as string;
    const newSecret = newRawApiKey.split('.')[1];

    expect(newRawApiKey).not.toBe(oldRawApiKey);
    expect(newSecret).toEqual(expect.any(String));

    const rawAuthAfterRotate = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/api-key/me',
      headers: {
        authorization: `Bearer ${newRawApiKey}`,
      },
    });

    expect(rawAuthAfterRotate.statusCode).toBe(200);

    const rawAuthOldKey = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/api-key/me',
      headers: {
        authorization: `Bearer ${oldRawApiKey}`,
      },
    });

    expect(rawAuthOldKey.statusCode).toBe(401);
    expect(rawAuthOldKey.json()).toMatchObject({
      error: 'invalid_api_key',
    });

    const oldHmacTimestamp = Math.floor(Date.now() / 1000).toString();
    const oldHmacNonce = `old-nonce-${Date.now()}`;
    const oldHmacAfterRotate = await app.inject({
      method: 'GET',
      url: path,
      headers: {
        'x-api-key': createdBody.keyPrefix as string,
        'x-api-timestamp': oldHmacTimestamp,
        'x-api-nonce': oldHmacNonce,
        'x-api-signature': hmacSha256Hex(
          oldSecret,
          buildApiHmacPayload({
            method: 'GET',
            path,
            timestamp: oldHmacTimestamp,
            nonce: oldHmacNonce,
          }),
        ),
      },
    });

    expect(oldHmacAfterRotate.statusCode).toBe(401);
    expect(oldHmacAfterRotate.json()).toMatchObject({
      error: 'invalid_api_signature',
    });

    const newHmacTimestamp = Math.floor(Date.now() / 1000).toString();
    const newHmacNonce = `new-nonce-${Date.now()}`;
    const newHmacAfterRotate = await app.inject({
      method: 'GET',
      url: path,
      headers: {
        'x-api-key': createdBody.keyPrefix as string,
        'x-api-timestamp': newHmacTimestamp,
        'x-api-nonce': newHmacNonce,
        'x-api-signature': hmacSha256Hex(
          newSecret,
          buildApiHmacPayload({
            method: 'GET',
            path,
            timestamp: newHmacTimestamp,
            nonce: newHmacNonce,
          }),
        ),
      },
    });

    expect(newHmacAfterRotate.statusCode).toBe(200);
  });
});
