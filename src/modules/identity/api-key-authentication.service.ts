import { env } from '../../config/env';
import { hmacSha256Hex, safeEqualString, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { decryptString } from '../../lib/secrets';
import {
  buildApiHmacPayload,
  finalizeAuthenticatedApiKey,
  getApiKeyByHash,
  getApiKeyByPrefix,
  persistApiKeyNonce,
} from './identity-workflow-support';
import type {
  AuthenticateApiKeyInput,
  AuthenticateHmacApiKeyInput,
} from './types';

export class ApiKeyAuthenticationService {
  async authenticateApiKey(input: AuthenticateApiKeyInput) {
    const apiKeyHash = sha256Hex(input.rawApiKey);
    const apiKey = await getApiKeyByHash(apiKeyHash);
    return finalizeAuthenticatedApiKey(apiKey, input.requiredScopes);
  }

  async authenticateHmacApiKey(input: AuthenticateHmacApiKeyInput) {
    const timestampSeconds = Number(input.timestamp);

    if (!Number.isFinite(timestampSeconds)) {
      throw new AppError(
        401,
        'invalid_api_signature',
        'invalid api signature timestamp',
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      Math.abs(nowSeconds - timestampSeconds) > env.API_HMAC_MAX_SKEW_SECONDS
    ) {
      throw new AppError(
        401,
        'expired_api_signature',
        'api signature timestamp is outside the accepted window',
      );
    }

    const apiKey = await getApiKeyByPrefix(input.keyPrefix);

    if (!apiKey.secretEncrypted) {
      throw new AppError(
        401,
        'legacy_api_key_not_supported',
        'api key must be rotated before it can be used with hmac signing',
      );
    }

    const secret = decryptString(
      apiKey.secretEncrypted,
      env.API_KEY_ENCRYPTION_KEY,
    );
    const expectedSignature = hmacSha256Hex(
      secret,
      buildApiHmacPayload({
        method: input.method,
        path: input.path,
        timestamp: input.timestamp,
        nonce: input.nonce,
      }),
    );

    if (!safeEqualString(expectedSignature, input.signature)) {
      throw new AppError(
        401,
        'invalid_api_signature',
        'api signature is invalid',
      );
    }

    await persistApiKeyNonce({
      apiKeyId: apiKey.id,
      nonce: input.nonce,
    });

    return finalizeAuthenticatedApiKey(apiKey, input.requiredScopes);
  }
}
