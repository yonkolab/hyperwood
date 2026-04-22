import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { env } from '../../../../src/config/env';
import type { AppError } from '../../../../src/lib/errors';
import {
  getApiHmacHeaders,
  getApiKeyFromRequest,
  getSessionAuthContext,
  getSessionBearerToken,
  type RequestAuthContext,
  requireInternalAuth,
  requireSessionAuth,
  requireStepUpAuthorization,
} from '../../../../src/modules/identity/auth-guards';

class FakeIdentitySessionResolver {
  async getUserFromSessionToken(sessionToken: string) {
    return {
      id: `user-for-${sessionToken}`,
      email: 'guard-test@example.com',
      emailVerifiedAt: null,
      username: 'guard-test',
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

function createRequest(input: {
  auth?: RequestAuthContext;
  headers?: Record<string, string | undefined>;
}) {
  return {
    auth: input.auth ?? { kind: 'public' },
    headers: input.headers ?? {},
  } as unknown as FastifyRequest;
}

describe('auth guards', () => {
  it('reads a bearer session token from authorization', () => {
    const request = createRequest({
      headers: {
        authorization: 'Bearer session-token',
      },
    });

    expect(getSessionBearerToken(request)).toBe('session-token');
  });

  it('rejects a missing bearer session token', () => {
    const request = createRequest({
      headers: {},
    });

    expect(() => getSessionBearerToken(request)).toThrowError(
      expect.objectContaining<AppError>({
        code: 'missing_session',
      }),
    );
  });

  it('reads a raw api key from x-api-key or bearer auth', () => {
    const headerRequest = createRequest({
      headers: {
        'x-api-key': 'hw_prefix.secret',
      },
    });
    const bearerRequest = createRequest({
      headers: {
        authorization: 'Bearer hw_prefix.secret',
      },
    });

    expect(getApiKeyFromRequest(headerRequest)).toBe('hw_prefix.secret');
    expect(getApiKeyFromRequest(bearerRequest)).toBe('hw_prefix.secret');
  });

  it('reads the required hmac headers', () => {
    const request = createRequest({
      headers: {
        'x-api-key': 'hw_prefix',
        'x-api-timestamp': '1700000000',
        'x-api-nonce': 'nonce-1',
        'x-api-signature': 'signature-1',
      },
    });

    expect(getApiHmacHeaders(request)).toEqual({
      keyPrefix: 'hw_prefix',
      timestamp: '1700000000',
      nonce: 'nonce-1',
      signature: 'signature-1',
    });
  });

  it('attaches session auth context once the bearer token resolves', async () => {
    const request = createRequest({
      headers: {
        authorization: 'Bearer session-token',
      },
    });
    const guard = requireSessionAuth(new FakeIdentitySessionResolver());

    await guard(request);

    expect(getSessionAuthContext(request)).toMatchObject({
      kind: 'session',
      sessionToken: 'session-token',
      user: {
        id: 'user-for-session-token',
      },
    });
  });

  it('attaches internal bootstrap auth context', async () => {
    const request = createRequest({
      headers: {
        'x-bootstrap-token': env.INTERNAL_BOOTSTRAP_TOKEN,
      },
    });
    const guard = requireInternalAuth();

    await guard(request);

    expect(request.auth).toEqual({
      kind: 'internal',
      internalActor: 'bootstrap',
    });
  });

  it('captures an optional step-up token on a session-authenticated request', async () => {
    const request = createRequest({
      auth: {
        kind: 'session',
        sessionToken: 'session-token',
        user: {
          id: 'user-1',
          email: 'step-up@example.com',
          emailVerifiedAt: null,
          username: 'step-up',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      headers: {
        'x-mfa-authorization': 'step-up-token',
      },
    });
    const guard = requireStepUpAuthorization('api_keys_manage');

    await guard(request);

    expect(getSessionAuthContext(request).stepUp).toEqual({
      action: 'api_keys_manage',
      authorizationToken: 'step-up-token',
    });
  });
});
