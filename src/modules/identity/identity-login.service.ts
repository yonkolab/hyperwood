import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import {
  mfaLoginChallenges,
  userIdentities,
  userMfaFactors,
  users,
} from '../../db/schema';
import {
  createOpaqueToken,
  normalizeEmail,
  sha256Hex,
  verifyPassword,
} from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import type { LoginAuditService } from './login-audit.service';
import type { IdentitySessionService } from './session.service';
import type { LoginInput } from './types';

export class IdentityLoginService {
  constructor(
    private readonly loginAuditService: LoginAuditService,
    private readonly sessionService: IdentitySessionService,
  ) {}

  async login(input: LoginInput) {
    const email = normalizeEmail(input.email);
    const recentFailureCounts =
      await this.loginAuditService.getRecentFailedLoginCounts({
        email,
        ipAddress: input.ipAddress,
      });

    if (
      this.loginAuditService.exceedsLoginFailureThreshold(recentFailureCounts)
    ) {
      await this.loginAuditService.recordLoginEvent({
        userId: null,
        email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        outcome: 'blocked_suspicious',
        suspicious: true,
        reason: 'repeated_failed_login_threshold',
      });

      throw new AppError(
        429,
        'login_temporarily_restricted',
        'login temporarily restricted due to suspicious activity',
      );
    }

    const rows = await db
      .select({
        userId: userIdentities.userId,
        passwordHash: userIdentities.passwordHash,
        user: users,
      })
      .from(userIdentities)
      .innerJoin(users, eq(users.id, userIdentities.userId))
      .where(
        and(
          eq(userIdentities.provider, 'password'),
          eq(userIdentities.providerSubject, email),
        ),
      )
      .limit(1);
    const identity = rows[0];

    if (
      !identity?.passwordHash ||
      !verifyPassword(input.password, identity.passwordHash)
    ) {
      const failedAttemptCounts = {
        emailFailures: recentFailureCounts.emailFailures + 1,
        ipFailures: recentFailureCounts.ipFailures + (input.ipAddress ? 1 : 0),
      };
      const suspicious =
        this.loginAuditService.exceedsLoginFailureThreshold(
          failedAttemptCounts,
        );

      await this.loginAuditService.recordLoginEvent({
        userId: identity?.userId ?? null,
        email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        outcome: 'invalid_credentials',
        suspicious,
        reason: suspicious ? 'repeated_failed_login_threshold' : undefined,
      });

      if (suspicious) {
        throw new AppError(
          429,
          'login_temporarily_restricted',
          'login temporarily restricted due to suspicious activity',
        );
      }

      throw new AppError(
        401,
        'invalid_credentials',
        'invalid email or password',
      );
    }

    const activeTotpFactorRows = await db
      .select({ id: userMfaFactors.id })
      .from(userMfaFactors)
      .where(
        and(
          eq(userMfaFactors.userId, identity.userId),
          eq(userMfaFactors.type, 'totp'),
          isNull(userMfaFactors.disabledAt),
          isNotNull(userMfaFactors.verifiedAt),
        ),
      )
      .limit(1);

    if (activeTotpFactorRows[0]) {
      const challengeToken = createOpaqueToken(32);

      await db.insert(mfaLoginChallenges).values({
        userId: identity.userId,
        tokenHash: sha256Hex(challengeToken),
        expiresAt: new Date(
          Date.now() + env.MFA_CHALLENGE_TTL_MINUTES * 60 * 1000,
        ),
      });

      await this.loginAuditService.recordLoginEvent({
        userId: identity.userId,
        email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        outcome: 'mfa_challenge',
        suspicious: false,
        reason: undefined,
      });

      return {
        mfaRequired: true as const,
        challengeToken,
        user: identity.user,
      };
    }

    const session = await this.sessionService.createSession({
      userId: identity.userId,
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });

    await this.loginAuditService.recordLoginEvent({
      userId: identity.userId,
      email,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      outcome: 'success',
      suspicious: false,
      reason: undefined,
    });

    return {
      mfaRequired: false as const,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user: identity.user,
    };
  }
}
