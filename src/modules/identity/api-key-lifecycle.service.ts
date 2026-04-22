import { and, eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { apiKeys, users } from '../../db/schema';
import { createOpaqueToken, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { encryptString } from '../../lib/secrets';
import { requireSensitiveActionAuthorization } from './identity-workflow-support';
import type {
  CreateApiKeyInput,
  RevokeApiKeyInput,
  RotateApiKeyInput,
} from './types';

export class ApiKeyLifecycleService {
  async createApiKey(input: CreateApiKeyInput) {
    const [user] = await db
      .select({
        id: users.id,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, 'user_not_found', 'user was not found');
    }

    if (user.status !== 'active') {
      throw new AppError(
        403,
        'account_not_verified',
        'account must be active before creating API keys',
      );
    }

    await requireSensitiveActionAuthorization({
      userId: input.userId,
      action: 'api_keys_manage',
      authorizationToken: input.mfaAuthorizationToken,
    });

    const keyId = createOpaqueToken(12);
    const secret = createOpaqueToken(32);
    const rawApiKey = `hw_${keyId}.${secret}`;
    const keyPrefix = `hw_${keyId}`;

    await db.insert(apiKeys).values({
      userId: input.userId,
      keyPrefix,
      secretHash: sha256Hex(rawApiKey),
      secretEncrypted: encryptString(secret, env.API_KEY_ENCRYPTION_KEY),
      scopes: input.scopes,
    });

    return {
      apiKey: rawApiKey,
      keyPrefix,
      scopes: input.scopes,
    };
  }

  async listApiKeys(userId: string) {
    const keys = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));

    return {
      apiKeys: keys,
    };
  }

  async revokeApiKey(input: RevokeApiKeyInput) {
    await requireSensitiveActionAuthorization({
      userId: input.userId,
      action: 'api_keys_manage',
      authorizationToken: input.mfaAuthorizationToken,
    });

    const rows = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(
        and(eq(apiKeys.id, input.apiKeyId), eq(apiKeys.userId, input.userId)),
      )
      .limit(1);
    const apiKey = rows[0];

    if (!apiKey) {
      throw new AppError(404, 'api_key_not_found', 'api key was not found');
    }

    if (!apiKey.revokedAt) {
      await db
        .update(apiKeys)
        .set({
          revokedAt: new Date(),
        })
        .where(eq(apiKeys.id, apiKey.id));
    }

    return {
      apiKey: {
        ...apiKey,
        revokedAt: apiKey.revokedAt ?? new Date(),
      },
    };
  }

  async rotateApiKey(input: RotateApiKeyInput) {
    await requireSensitiveActionAuthorization({
      userId: input.userId,
      action: 'api_keys_manage',
      authorizationToken: input.mfaAuthorizationToken,
    });

    const rows = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(
        and(eq(apiKeys.id, input.apiKeyId), eq(apiKeys.userId, input.userId)),
      )
      .limit(1);
    const apiKey = rows[0];

    if (!apiKey) {
      throw new AppError(
        404,
        'api_key_not_found',
        `api key was not found for id ${input.apiKeyId}`,
      );
    }

    if (apiKey.revokedAt) {
      throw new AppError(
        409,
        'api_key_revoked',
        `api key ${apiKey.keyPrefix} is revoked and cannot be rotated`,
      );
    }

    const secret = createOpaqueToken(32);
    const rawApiKey = `${apiKey.keyPrefix}.${secret}`;
    const rotatedAt = new Date();

    await db
      .update(apiKeys)
      .set({
        secretHash: sha256Hex(rawApiKey),
        secretEncrypted: encryptString(secret, env.API_KEY_ENCRYPTION_KEY),
      })
      .where(eq(apiKeys.id, apiKey.id));

    return {
      apiKeyId: apiKey.id,
      apiKey: rawApiKey,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      rotatedAt,
    };
  }
}
