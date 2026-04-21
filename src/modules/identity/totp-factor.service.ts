import { and, eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { mfaLoginChallenges, userMfaFactors, users } from '../../db/schema';
import { normalizeEmail, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { decryptString, encryptString } from '../../lib/secrets';
import {
  buildTotpOtpAuthUri,
  generateTotpSecret,
  verifyTotpCode,
} from '../../lib/totp';
import { getActiveTotpFactorSecrets } from './identity-workflow-support';
import type { LoginAuditService } from './login-audit.service';
import type { IdentitySessionService } from './session.service';
import type {
  ConfirmTotpSetupInput,
  SetupTotpInput,
  VerifyTotpLoginInput,
} from './types';

export class TotpFactorService {
  constructor(
    private readonly sessionService: IdentitySessionService,
    private readonly loginAuditService: LoginAuditService,
  ) {}

  async setupTotp(input: SetupTotpInput) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
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
        'account must be active before setting up MFA',
      );
    }

    const secret = generateTotpSecret();
    const encryptedSecret = encryptString(secret, env.TOTP_ENCRYPTION_KEY);
    const factorRows = await db
      .insert(userMfaFactors)
      .values({
        userId: user.id,
        type: 'totp',
        secretEncrypted: encryptedSecret,
      })
      .returning({
        factorId: userMfaFactors.id,
      });
    const factor = factorRows[0];

    if (!factor) {
      throw new AppError(
        500,
        'mfa_setup_failed',
        'failed to create mfa factor',
      );
    }

    return {
      factorId: factor.factorId,
      secret,
      otpauthUri: buildTotpOtpAuthUri({
        issuer: env.TOTP_ISSUER,
        accountName: user.email,
        secret,
      }),
    };
  }

  async confirmTotpSetup(input: ConfirmTotpSetupInput) {
    const rows = await db
      .select({
        factorId: userMfaFactors.id,
        userId: userMfaFactors.userId,
        secretEncrypted: userMfaFactors.secretEncrypted,
        verifiedAt: userMfaFactors.verifiedAt,
        disabledAt: userMfaFactors.disabledAt,
      })
      .from(userMfaFactors)
      .where(
        and(
          eq(userMfaFactors.id, input.factorId),
          eq(userMfaFactors.userId, input.userId),
          eq(userMfaFactors.type, 'totp'),
        ),
      )
      .limit(1);
    const factor = rows[0];

    if (!factor) {
      throw new AppError(
        404,
        'mfa_factor_not_found',
        'mfa factor was not found',
      );
    }

    if (factor.disabledAt) {
      throw new AppError(409, 'mfa_factor_disabled', 'mfa factor is disabled');
    }

    if (factor.verifiedAt) {
      throw new AppError(
        409,
        'mfa_already_enabled',
        'mfa factor is already verified',
      );
    }

    const secret = decryptString(
      factor.secretEncrypted,
      env.TOTP_ENCRYPTION_KEY,
    );

    if (!verifyTotpCode({ secret, code: input.code })) {
      throw new AppError(401, 'invalid_totp_code', 'invalid totp code');
    }

    await db
      .update(userMfaFactors)
      .set({
        verifiedAt: new Date(),
      })
      .where(eq(userMfaFactors.id, factor.factorId));

    return {
      factorId: factor.factorId,
      enabled: true,
    };
  }

  async verifyTotpLogin(input: VerifyTotpLoginInput) {
    const challengeTokenHash = sha256Hex(input.challengeToken);
    const challengeRows = await db
      .select({
        challengeId: mfaLoginChallenges.id,
        userId: mfaLoginChallenges.userId,
        expiresAt: mfaLoginChallenges.expiresAt,
        consumedAt: mfaLoginChallenges.consumedAt,
        user: users,
      })
      .from(mfaLoginChallenges)
      .innerJoin(users, eq(users.id, mfaLoginChallenges.userId))
      .where(eq(mfaLoginChallenges.tokenHash, challengeTokenHash))
      .limit(1);
    const challenge = challengeRows[0];

    if (!challenge) {
      throw new AppError(
        404,
        'mfa_challenge_not_found',
        'mfa challenge was not found',
      );
    }

    if (challenge.consumedAt) {
      throw new AppError(
        409,
        'mfa_challenge_consumed',
        'mfa challenge was already used',
      );
    }

    if (challenge.expiresAt <= new Date()) {
      throw new AppError(
        410,
        'mfa_challenge_expired',
        'mfa challenge has expired',
      );
    }

    const factorSecrets = await getActiveTotpFactorSecrets(challenge.userId);
    const matchingFactor = factorSecrets.find((secret) =>
      verifyTotpCode({ secret, code: input.code }),
    );

    if (!matchingFactor) {
      throw new AppError(401, 'invalid_totp_code', 'invalid totp code');
    }

    await db
      .update(mfaLoginChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(mfaLoginChallenges.id, challenge.challengeId));

    const session = await this.sessionService.createSession({
      userId: challenge.userId,
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });

    await this.loginAuditService.recordLoginEvent({
      userId: challenge.userId,
      email: normalizeEmail(challenge.user.email),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      outcome: 'mfa_success',
      suspicious: false,
      reason: undefined,
    });

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user: challenge.user,
    };
  }
}
