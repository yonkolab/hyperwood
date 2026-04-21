import { env } from '../../config/env';
import { db } from '../../db/client';
import { mfaActionAuthorizations } from '../../db/schema';
import { createOpaqueToken, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { verifyTotpCode } from '../../lib/totp';
import { getActiveTotpFactorSecrets } from './identity-workflow-support';
import type { AuthorizeSensitiveActionWithTotpInput } from './types';

export class SensitiveActionAuthorizationService {
  async authorizeSensitiveActionWithTotp(
    input: AuthorizeSensitiveActionWithTotpInput,
  ) {
    const factorSecrets = await getActiveTotpFactorSecrets(input.userId);

    if (factorSecrets.length === 0) {
      throw new AppError(
        409,
        'mfa_not_enabled',
        'user must enable MFA before requesting sensitive action authorization',
      );
    }

    const hasMatchingFactor = factorSecrets.some((secret) =>
      verifyTotpCode({ secret, code: input.code }),
    );

    if (!hasMatchingFactor) {
      throw new AppError(401, 'invalid_totp_code', 'invalid totp code');
    }

    const authorizationToken = createOpaqueToken(32);
    const expiresAt = new Date(
      Date.now() + env.MFA_ACTION_AUTHORIZATION_TTL_MINUTES * 60 * 1000,
    );

    await db.insert(mfaActionAuthorizations).values({
      userId: input.userId,
      action: input.action,
      tokenHash: sha256Hex(authorizationToken),
      expiresAt,
    });

    return {
      action: input.action,
      authorizationToken,
      expiresAt,
    };
  }
}
