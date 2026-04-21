import { and, eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { apiKeys, users } from '../../db/schema';
import { createOpaqueToken, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { encryptString } from '../../lib/secrets';
import { requireSensitiveActionAuthorization } from './identity-workflow-support';
import type { CreateApiKeyInput, RevokeApiKeyInput } from './types';

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
}
