import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import {
  apiKeyRequestNonces,
  apiKeys,
  mfaActionAuthorizations,
  userMfaFactors,
  users,
} from '../../db/schema';
import { createOpaqueToken, hmacSha256Hex, sha256Hex } from '../../lib/crypto';
import { AppError, isUniqueViolation } from '../../lib/errors';
import { decryptString } from '../../lib/secrets';
import type { AuthenticateHmacApiKeyInput, SensitiveAction } from './types';

export function rethrowConstraint(
  error: unknown,
  fallbackMessage: string,
): never {
  if (isUniqueViolation(error)) {
    throw new AppError(409, 'conflict', fallbackMessage);
  }

  throw error;
}

export function buildEmailVerificationChallenge() {
  const token = createOpaqueToken(32);

  return {
    token,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(
      Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
    ),
  };
}

export async function getApiKeyByHash(secretHash: string) {
  const rows = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      keyPrefix: apiKeys.keyPrefix,
      secretEncrypted: apiKeys.secretEncrypted,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
      user: users,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(eq(apiKeys.secretHash, secretHash))
    .limit(1);
  const apiKey = rows[0];

  if (!apiKey) {
    throw new AppError(401, 'invalid_api_key', 'api key is invalid');
  }

  return apiKey;
}

export async function getApiKeyByPrefix(keyPrefix: string) {
  const rows = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      keyPrefix: apiKeys.keyPrefix,
      secretEncrypted: apiKeys.secretEncrypted,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
      user: users,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(eq(apiKeys.keyPrefix, keyPrefix))
    .limit(1);
  const apiKey = rows[0];

  if (!apiKey) {
    throw new AppError(401, 'invalid_api_key', 'api key is invalid');
  }

  return apiKey;
}

export async function finalizeAuthenticatedApiKey(
  apiKey: {
    id: string;
    userId: string;
    keyPrefix: string;
    scopes: string[];
    revokedAt: Date | null;
    user: typeof users.$inferSelect;
  },
  requiredScopes?: string[],
) {
  if (apiKey.revokedAt) {
    throw new AppError(401, 'revoked_api_key', 'api key has been revoked');
  }

  if (apiKey.user.status !== 'active') {
    throw new AppError(
      403,
      'account_not_active',
      'api key owner account is not active',
    );
  }

  const scopes = requiredScopes ?? [];

  if (!scopes.every((scope) => apiKey.scopes.includes(scope))) {
    throw new AppError(
      403,
      'insufficient_api_key_scope',
      'api key does not satisfy required scopes',
    );
  }

  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiKeys.id, apiKey.id));

  return {
    apiKey: {
      id: apiKey.id,
      userId: apiKey.userId,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
    },
    user: apiKey.user,
  };
}

export function buildApiHmacPayload(input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
}) {
  return `${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.nonce}`;
}

export async function persistApiKeyNonce(input: {
  apiKeyId: string;
  nonce: string;
}) {
  const nonceHash = sha256Hex(input.nonce);

  try {
    await db.insert(apiKeyRequestNonces).values({
      apiKeyId: input.apiKeyId,
      nonceHash,
      expiresAt: new Date(Date.now() + env.API_HMAC_NONCE_TTL_SECONDS * 1000),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        401,
        'replayed_api_request',
        'api request nonce was already used',
      );
    }

    throw error;
  }
}

export async function getActiveTotpFactorSecrets(userId: string) {
  const factorRows = await db
    .select({
      secretEncrypted: userMfaFactors.secretEncrypted,
    })
    .from(userMfaFactors)
    .where(
      and(
        eq(userMfaFactors.userId, userId),
        eq(userMfaFactors.type, 'totp'),
        isNull(userMfaFactors.disabledAt),
        isNotNull(userMfaFactors.verifiedAt),
      ),
    );

  return factorRows.map((factor) =>
    decryptString(factor.secretEncrypted, env.TOTP_ENCRYPTION_KEY),
  );
}

export async function requireSensitiveActionAuthorization(input: {
  userId: string;
  action: SensitiveAction;
  authorizationToken: string | undefined;
}) {
  const factorSecrets = await getActiveTotpFactorSecrets(input.userId);

  if (factorSecrets.length === 0) {
    return;
  }

  if (!input.authorizationToken) {
    throw new AppError(
      403,
      'mfa_authorization_required',
      'mfa authorization is required for this action',
    );
  }

  const authorizationRows = await db
    .select({
      id: mfaActionAuthorizations.id,
      expiresAt: mfaActionAuthorizations.expiresAt,
      consumedAt: mfaActionAuthorizations.consumedAt,
    })
    .from(mfaActionAuthorizations)
    .where(
      and(
        eq(mfaActionAuthorizations.userId, input.userId),
        eq(mfaActionAuthorizations.action, input.action),
        eq(
          mfaActionAuthorizations.tokenHash,
          sha256Hex(input.authorizationToken),
        ),
      ),
    )
    .limit(1);
  const authorization = authorizationRows[0];

  if (!authorization) {
    throw new AppError(
      401,
      'invalid_mfa_authorization',
      'mfa authorization is invalid for this action',
    );
  }

  if (authorization.consumedAt) {
    throw new AppError(
      409,
      'mfa_authorization_consumed',
      'mfa authorization was already used',
    );
  }

  if (authorization.expiresAt <= new Date()) {
    throw new AppError(
      410,
      'mfa_authorization_expired',
      'mfa authorization has expired',
    );
  }

  const consumedRows = await db
    .update(mfaActionAuthorizations)
    .set({
      consumedAt: new Date(),
    })
    .where(
      and(
        eq(mfaActionAuthorizations.id, authorization.id),
        isNull(mfaActionAuthorizations.consumedAt),
      ),
    )
    .returning({
      id: mfaActionAuthorizations.id,
    });

  if (!consumedRows[0]) {
    throw new AppError(
      409,
      'mfa_authorization_consumed',
      'mfa authorization was already used',
    );
  }
}

export function verifyApiHmacSignature(
  input: AuthenticateHmacApiKeyInput & { secret: string },
) {
  const expectedSignature = hmacSha256Hex(
    input.secret,
    buildApiHmacPayload({
      method: input.method,
      path: input.path,
      timestamp: input.timestamp,
      nonce: input.nonce,
    }),
  );

  return expectedSignature;
}
