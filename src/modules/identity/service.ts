import { and, count, eq, gt, gte, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "../../db/client";
import {
  apiKeys,
  apiKeyRequestNonces,
  emailVerificationTokens,
  loginEvents,
  mfaActionAuthorizations,
  mfaLoginChallenges,
  userIdentities,
  userMfaFactors,
  userSessions,
  users,
} from "../../db/schema";
import { env } from "../../config/env";
import {
  createOpaqueToken,
  hashPassword,
  hmacSha256Hex,
  normalizeEmail,
  safeEqualString,
  sha256Hex,
  verifyPassword,
} from "../../lib/crypto";
import { AppError } from "../../lib/errors";
import { decryptString, encryptString } from "../../lib/secrets";
import { buildTotpOtpAuthUri, generateTotpSecret, verifyTotpCode } from "../../lib/totp";

export type SensitiveAction = "api_keys_manage";
type LoginEventOutcome =
  | "success"
  | "invalid_credentials"
  | "mfa_challenge"
  | "mfa_success"
  | "blocked_suspicious";

type RegisterInput = {
  email: string;
  username?: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
};

type LinkExistingUserInput = {
  userId: string;
  email: string;
  password: string;
  emailVerified?: boolean;
};

type CreateApiKeyInput = {
  userId: string;
  scopes: string[];
  mfaAuthorizationToken: string | undefined;
};

type RevokeApiKeyInput = {
  userId: string;
  apiKeyId: string;
  mfaAuthorizationToken: string | undefined;
};

type AuthenticateApiKeyInput = {
  rawApiKey: string;
  requiredScopes?: string[];
};

type AuthenticateHmacApiKeyInput = {
  keyPrefix: string;
  timestamp: string;
  nonce: string;
  signature: string;
  method: string;
  path: string;
  requiredScopes?: string[];
};

type RequestEmailVerificationInput = {
  email: string;
};

type VerifyEmailInput = {
  token: string;
};

type SetupTotpInput = {
  userId: string;
};

type ConfirmTotpSetupInput = {
  userId: string;
  factorId: string;
  code: string;
};

type VerifyTotpLoginInput = {
  challengeToken: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
};

type AuthorizeSensitiveActionWithTotpInput = {
  userId: string;
  action: SensitiveAction;
  code: string;
};

export class IdentityService {
  async register(input: RegisterInput) {
    const email = normalizeEmail(input.email);
    const passwordHash = hashPassword(input.password);

    try {
      const result = await db.transaction(async (tx) => {
        const createdRows = await tx
          .insert(users)
          .values({
            email,
            username: input.username,
          })
          .returning();

        const created = createdRows[0];

        if (!created) {
          throw new AppError(500, "user_creation_failed", "failed to create user");
        }

        await tx.insert(userIdentities).values({
          userId: created.id,
          provider: "password",
          providerSubject: email,
          email,
          passwordHash,
        });

        const verificationChallenge = this.buildEmailVerificationChallenge();

        await tx.insert(emailVerificationTokens).values({
          userId: created.id,
          tokenHash: verificationChallenge.tokenHash,
          expiresAt: verificationChallenge.expiresAt,
        });

        return {
          user: created,
          verificationChallenge,
        };
      });

      return this.formatVerificationResponse(result.user, result.verificationChallenge);
    } catch (error) {
      this.rethrowConstraint(error, "user already exists for this email or username");
      throw error;
    }
  }

  async login(input: LoginInput) {
    const email = normalizeEmail(input.email);
    const recentFailureCounts = await this.getRecentFailedLoginCounts({
      email,
      ipAddress: input.ipAddress,
    });

    if (this.exceedsLoginFailureThreshold(recentFailureCounts)) {
      await this.recordLoginEvent({
        userId: null,
        email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        outcome: "blocked_suspicious",
        suspicious: true,
        reason: "repeated_failed_login_threshold",
      });

      throw new AppError(
        429,
        "login_temporarily_restricted",
        "login temporarily restricted due to suspicious activity",
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
          eq(userIdentities.provider, "password"),
          eq(userIdentities.providerSubject, email),
        ),
      )
      .limit(1);

    const identity = rows[0];

    if (!identity?.passwordHash || !verifyPassword(input.password, identity.passwordHash)) {
      const failedAttemptCounts = {
        emailFailures: recentFailureCounts.emailFailures + 1,
        ipFailures:
          recentFailureCounts.ipFailures + (input.ipAddress ? 1 : 0),
      };
      const suspicious = this.exceedsLoginFailureThreshold(failedAttemptCounts);

      await this.recordLoginEvent({
        userId: identity?.userId ?? null,
        email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        outcome: "invalid_credentials",
        suspicious,
        reason: suspicious ? "repeated_failed_login_threshold" : undefined,
      });

      if (suspicious) {
        throw new AppError(
          429,
          "login_temporarily_restricted",
          "login temporarily restricted due to suspicious activity",
        );
      }

      throw new AppError(401, "invalid_credentials", "invalid email or password");
    }

    const activeTotpFactorRows = await db
      .select({
        id: userMfaFactors.id,
      })
      .from(userMfaFactors)
      .where(
        and(
          eq(userMfaFactors.userId, identity.userId),
          eq(userMfaFactors.type, "totp"),
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

      await this.recordLoginEvent({
        userId: identity.userId,
        email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        outcome: "mfa_challenge",
        suspicious: false,
        reason: undefined,
      });

      return {
        mfaRequired: true as const,
        challengeToken,
        user: identity.user,
      };
    }

    const session = await this.createSession({
      userId: identity.userId,
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });

    await this.recordLoginEvent({
      userId: identity.userId,
      email,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      outcome: "success",
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

  async getUserFromSessionToken(sessionToken: string) {
    const tokenHash = sha256Hex(sessionToken);

    const rows = await db
      .select({
        user: users,
      })
      .from(userSessions)
      .innerJoin(users, eq(users.id, userSessions.userId))
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const session = rows[0];

    if (!session) {
      throw new AppError(401, "invalid_session", "session is invalid or expired");
    }

    return session.user;
  }

  async requestEmailVerification(input: RequestEmailVerificationInput) {
    const email = normalizeEmail(input.email);
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = userRows[0];

    if (!user) {
      throw new AppError(404, "user_not_found", "user was not found");
    }

    if (user.status === "active") {
      throw new AppError(
        409,
        "email_already_verified",
        "email is already verified for this user",
      );
    }

    const verificationChallenge = this.buildEmailVerificationChallenge();

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash: verificationChallenge.tokenHash,
      expiresAt: verificationChallenge.expiresAt,
    });

    return this.formatVerificationResponse(user, verificationChallenge);
  }

  async verifyEmail(input: VerifyEmailInput) {
    const tokenHash = sha256Hex(input.token);

    const rows = await db
      .select({
        verificationTokenId: emailVerificationTokens.id,
        tokenUserId: emailVerificationTokens.userId,
        expiresAt: emailVerificationTokens.expiresAt,
        consumedAt: emailVerificationTokens.consumedAt,
        identityId: userIdentities.id,
        user: users,
      })
      .from(emailVerificationTokens)
      .innerJoin(users, eq(users.id, emailVerificationTokens.userId))
      .leftJoin(
        userIdentities,
        and(
          eq(userIdentities.userId, emailVerificationTokens.userId),
          eq(userIdentities.provider, "password"),
        ),
      )
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    const verification = rows[0];

    if (!verification) {
      throw new AppError(404, "verification_not_found", "verification token was not found");
    }

    if (verification.consumedAt) {
      throw new AppError(409, "verification_consumed", "verification token was already used");
    }

    if (verification.expiresAt <= new Date()) {
      throw new AppError(410, "verification_expired", "verification token has expired");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({
          consumedAt: new Date(),
        })
        .where(eq(emailVerificationTokens.id, verification.verificationTokenId));

      await tx
        .update(users)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(users.id, verification.tokenUserId));

      if (verification.identityId) {
        await tx
          .update(userIdentities)
          .set({
            emailVerifiedAt: new Date(),
          })
          .where(eq(userIdentities.id, verification.identityId));
      }
    });

    return {
      user: {
        ...verification.user,
        status: "active" as const,
      },
      verified: true,
    };
  }

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
      throw new AppError(404, "user_not_found", "user was not found");
    }

    if (user.status !== "active") {
      throw new AppError(
        403,
        "account_not_verified",
        "account must be active before setting up MFA",
      );
    }

    const secret = generateTotpSecret();
    const encryptedSecret = encryptString(secret, env.TOTP_ENCRYPTION_KEY);
    const factorRows = await db
      .insert(userMfaFactors)
      .values({
        userId: user.id,
        type: "totp",
        secretEncrypted: encryptedSecret,
      })
      .returning({
        factorId: userMfaFactors.id,
      });

    const factor = factorRows[0];

    if (!factor) {
      throw new AppError(500, "mfa_setup_failed", "failed to create mfa factor");
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
          eq(userMfaFactors.type, "totp"),
        ),
      )
      .limit(1);

    const factor = rows[0];

    if (!factor) {
      throw new AppError(404, "mfa_factor_not_found", "mfa factor was not found");
    }

    if (factor.disabledAt) {
      throw new AppError(409, "mfa_factor_disabled", "mfa factor is disabled");
    }

    if (factor.verifiedAt) {
      throw new AppError(409, "mfa_already_enabled", "mfa factor is already verified");
    }

    const secret = decryptString(factor.secretEncrypted, env.TOTP_ENCRYPTION_KEY);

    if (!verifyTotpCode({ secret, code: input.code })) {
      throw new AppError(401, "invalid_totp_code", "invalid totp code");
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
      throw new AppError(404, "mfa_challenge_not_found", "mfa challenge was not found");
    }

    if (challenge.consumedAt) {
      throw new AppError(409, "mfa_challenge_consumed", "mfa challenge was already used");
    }

    if (challenge.expiresAt <= new Date()) {
      throw new AppError(410, "mfa_challenge_expired", "mfa challenge has expired");
    }

    const factorSecrets = await this.getActiveTotpFactorSecrets(challenge.userId);

    const matchingFactor = factorSecrets.find((secret) =>
      verifyTotpCode({
        secret,
        code: input.code,
      }),
    );

    if (!matchingFactor) {
      throw new AppError(401, "invalid_totp_code", "invalid totp code");
    }

    await db
      .update(mfaLoginChallenges)
      .set({
        consumedAt: new Date(),
      })
      .where(eq(mfaLoginChallenges.id, challenge.challengeId));

    const session = await this.createSession({
      userId: challenge.userId,
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });

    await this.recordLoginEvent({
      userId: challenge.userId,
      email: normalizeEmail(challenge.user.email),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      outcome: "mfa_success",
      suspicious: false,
      reason: undefined,
    });

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user: challenge.user,
    };
  }

  async authorizeSensitiveActionWithTotp(input: AuthorizeSensitiveActionWithTotpInput) {
    const factorSecrets = await this.getActiveTotpFactorSecrets(input.userId);

    if (factorSecrets.length === 0) {
      throw new AppError(
        409,
        "mfa_not_enabled",
        "user must enable MFA before requesting sensitive action authorization",
      );
    }

    const hasMatchingFactor = factorSecrets.some((secret) =>
      verifyTotpCode({
        secret,
        code: input.code,
      }),
    );

    if (!hasMatchingFactor) {
      throw new AppError(401, "invalid_totp_code", "invalid totp code");
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

  async linkExistingUser(input: LinkExistingUserInput) {
    const email = normalizeEmail(input.email);
    const existingUserRows = await db
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    const existingUser = existingUserRows[0];

    if (!existingUser) {
      throw new AppError(404, "user_not_found", "existing user was not found");
    }

    if (normalizeEmail(existingUser.email) !== email) {
      throw new AppError(
        409,
        "email_mismatch",
        "existing user email must match the linked password identity email",
      );
    }

    const existingIdentityRows = await db
      .select({
        id: userIdentities.id,
      })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, "password"),
          eq(userIdentities.providerSubject, email),
        ),
      )
      .limit(1);

    const existingIdentity = existingIdentityRows[0];

    if (existingIdentity) {
      throw new AppError(
        409,
        "identity_exists",
        "a password identity already exists for this email",
      );
    }

    const passwordHash = hashPassword(input.password);

    await db.insert(userIdentities).values({
      userId: existingUser.id,
      provider: "password",
      providerSubject: email,
      email,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      passwordHash,
    });

    return {
      user: existingUser,
      linked: true,
    };
  }

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
      throw new AppError(404, "user_not_found", "user was not found");
    }

    if (user.status !== "active") {
      throw new AppError(
        403,
        "account_not_verified",
        "account must be active before creating API keys",
      );
    }

    await this.requireSensitiveActionAuthorization({
      userId: input.userId,
      action: "api_keys_manage",
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
    await this.requireSensitiveActionAuthorization({
      userId: input.userId,
      action: "api_keys_manage",
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
      .where(and(eq(apiKeys.id, input.apiKeyId), eq(apiKeys.userId, input.userId)))
      .limit(1);

    const apiKey = rows[0];

    if (!apiKey) {
      throw new AppError(404, "api_key_not_found", "api key was not found");
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

  async authenticateApiKey(input: AuthenticateApiKeyInput) {
    const apiKeyHash = sha256Hex(input.rawApiKey);
    const apiKey = await this.getApiKeyByHash(apiKeyHash);
    return this.finalizeAuthenticatedApiKey(apiKey, input.requiredScopes);
  }

  async authenticateHmacApiKey(input: AuthenticateHmacApiKeyInput) {
    const timestampSeconds = Number(input.timestamp);

    if (!Number.isFinite(timestampSeconds)) {
      throw new AppError(401, "invalid_api_signature", "invalid api signature timestamp");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (Math.abs(nowSeconds - timestampSeconds) > env.API_HMAC_MAX_SKEW_SECONDS) {
      throw new AppError(401, "expired_api_signature", "api signature timestamp is outside the accepted window");
    }

    const apiKey = await this.getApiKeyByPrefix(input.keyPrefix);

    if (!apiKey.secretEncrypted) {
      throw new AppError(
        401,
        "legacy_api_key_not_supported",
        "api key must be rotated before it can be used with hmac signing",
      );
    }

    const secret = decryptString(apiKey.secretEncrypted, env.API_KEY_ENCRYPTION_KEY);
    const expectedSignature = hmacSha256Hex(
      secret,
      this.buildApiHmacPayload({
        method: input.method,
        path: input.path,
        timestamp: input.timestamp,
        nonce: input.nonce,
      }),
    );

    if (!safeEqualString(expectedSignature, input.signature)) {
      throw new AppError(401, "invalid_api_signature", "api signature is invalid");
    }

    await this.persistApiKeyNonce({
      apiKeyId: apiKey.id,
      nonce: input.nonce,
    });

    return this.finalizeAuthenticatedApiKey(apiKey, input.requiredScopes);
  }

  private rethrowConstraint(error: unknown, fallbackMessage: string): never {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError(409, "conflict", fallbackMessage);
    }

    throw error;
  }

  private async createSession(input: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const sessionToken = createOpaqueToken(48);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

    await db.insert(userSessions).values({
      userId: input.userId,
      tokenHash,
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      sessionToken,
      expiresAt,
    };
  }

  private buildEmailVerificationChallenge() {
    const token = createOpaqueToken(32);

    return {
      token,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(
        Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
      ),
    };
  }

  private formatVerificationResponse(
    user: typeof users.$inferSelect,
    verificationChallenge: {
      token: string;
      expiresAt: Date;
    },
  ) {
    return {
      user,
      verificationChallenge: {
        expiresAt: verificationChallenge.expiresAt,
        ...(env.NODE_ENV !== "production"
          ? { token: verificationChallenge.token }
          : {}),
      },
    };
  }

  private async getApiKeyByHash(secretHash: string) {
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
      throw new AppError(401, "invalid_api_key", "api key is invalid");
    }

    return apiKey;
  }

  private async getApiKeyByPrefix(keyPrefix: string) {
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
      throw new AppError(401, "invalid_api_key", "api key is invalid");
    }

    return apiKey;
  }

  private async finalizeAuthenticatedApiKey(
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
      throw new AppError(401, "revoked_api_key", "api key has been revoked");
    }

    if (apiKey.user.status !== "active") {
      throw new AppError(
        403,
        "account_not_active",
        "api key owner account is not active",
      );
    }

    const scopes = requiredScopes ?? [];

    if (!scopes.every((scope) => apiKey.scopes.includes(scope))) {
      throw new AppError(
        403,
        "insufficient_api_key_scope",
        "api key does not satisfy required scopes",
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

  private buildApiHmacPayload(input: {
    method: string;
    path: string;
    timestamp: string;
    nonce: string;
  }) {
    return `${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.nonce}`;
  }

  private async persistApiKeyNonce(input: { apiKeyId: string; nonce: string }) {
    const nonceHash = sha256Hex(input.nonce);

    try {
      await db.insert(apiKeyRequestNonces).values({
        apiKeyId: input.apiKeyId,
        nonceHash,
        expiresAt: new Date(
          Date.now() + env.API_HMAC_NONCE_TTL_SECONDS * 1000,
        ),
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new AppError(401, "replayed_api_request", "api request nonce was already used");
      }

      throw error;
    }
  }

  private async getRecentFailedLoginCounts(input: {
    email: string;
    ipAddress: string | undefined;
  }) {
    const windowStart = new Date(
      Date.now() - env.LOGIN_RISK_WINDOW_MINUTES * 60 * 1000,
    );

    const failedOutcomes = or(
      eq(loginEvents.outcome, "invalid_credentials"),
      eq(loginEvents.outcome, "blocked_suspicious"),
    );

    const emailRows = await db
      .select({
        value: count(),
      })
      .from(loginEvents)
      .where(
        and(
          eq(loginEvents.email, input.email),
          gte(loginEvents.createdAt, windowStart),
          failedOutcomes,
        ),
      );

    if (!input.ipAddress) {
      return {
        emailFailures: Number(emailRows[0]?.value ?? 0),
        ipFailures: 0,
      };
    }

    const ipRows = await db
      .select({
        value: count(),
      })
      .from(loginEvents)
      .where(
        and(
          eq(loginEvents.ipAddress, input.ipAddress),
          gte(loginEvents.createdAt, windowStart),
          failedOutcomes,
        ),
      );

    return {
      emailFailures: Number(emailRows[0]?.value ?? 0),
      ipFailures: Number(ipRows[0]?.value ?? 0),
    };
  }

  private exceedsLoginFailureThreshold(input: {
    emailFailures: number;
    ipFailures: number;
  }) {
    return (
      input.emailFailures >= env.LOGIN_MAX_FAILURES_PER_EMAIL ||
      input.ipFailures >= env.LOGIN_MAX_FAILURES_PER_IP
    );
  }

  private async recordLoginEvent(input: {
    userId: string | null;
    email: string;
    ipAddress: string | undefined;
    userAgent: string | undefined;
    outcome: LoginEventOutcome;
    suspicious: boolean;
    reason: string | undefined;
  }) {
    await db.insert(loginEvents).values({
      userId: input.userId,
      email: input.email,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      outcome: input.outcome,
      suspicious: input.suspicious,
      reason: input.reason,
    });
  }

  private async getActiveTotpFactorSecrets(userId: string) {
    const factorRows = await db
      .select({
        secretEncrypted: userMfaFactors.secretEncrypted,
      })
      .from(userMfaFactors)
      .where(
        and(
          eq(userMfaFactors.userId, userId),
          eq(userMfaFactors.type, "totp"),
          isNull(userMfaFactors.disabledAt),
          isNotNull(userMfaFactors.verifiedAt),
        ),
      );

    return factorRows.map((factor) =>
      decryptString(factor.secretEncrypted, env.TOTP_ENCRYPTION_KEY),
    );
  }

  private async requireSensitiveActionAuthorization(input: {
    userId: string;
    action: SensitiveAction;
    authorizationToken: string | undefined;
  }) {
    const factorSecrets = await this.getActiveTotpFactorSecrets(input.userId);

    if (factorSecrets.length === 0) {
      return;
    }

    if (!input.authorizationToken) {
      throw new AppError(
        403,
        "mfa_authorization_required",
        "mfa authorization is required for this action",
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
          eq(mfaActionAuthorizations.tokenHash, sha256Hex(input.authorizationToken)),
        ),
      )
      .limit(1);

    const authorization = authorizationRows[0];

    if (!authorization) {
      throw new AppError(
        401,
        "invalid_mfa_authorization",
        "mfa authorization is invalid for this action",
      );
    }

    if (authorization.consumedAt) {
      throw new AppError(
        409,
        "mfa_authorization_consumed",
        "mfa authorization was already used",
      );
    }

    if (authorization.expiresAt <= new Date()) {
      throw new AppError(
        410,
        "mfa_authorization_expired",
        "mfa authorization has expired",
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
        "mfa_authorization_consumed",
        "mfa authorization was already used",
      );
    }
  }
}
