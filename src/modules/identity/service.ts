import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import {
  apiKeys,
  apiKeyRequestNonces,
  emailVerificationTokens,
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
};

type RevokeApiKeyInput = {
  userId: string;
  apiKeyId: string;
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

    const factorRows = await db
      .select({
        factorId: userMfaFactors.id,
        secretEncrypted: userMfaFactors.secretEncrypted,
      })
      .from(userMfaFactors)
      .where(
        and(
          eq(userMfaFactors.userId, challenge.userId),
          eq(userMfaFactors.type, "totp"),
          isNull(userMfaFactors.disabledAt),
          isNotNull(userMfaFactors.verifiedAt),
        ),
      );

    const matchingFactor = factorRows.find((factor) =>
      verifyTotpCode({
        secret: decryptString(factor.secretEncrypted, env.TOTP_ENCRYPTION_KEY),
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

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user: challenge.user,
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
}
