import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import {
  apiKeys,
  emailVerificationTokens,
  userIdentities,
  userSessions,
  users,
} from "../../db/schema";
import { env } from "../../config/env";
import { createOpaqueToken, hashPassword, normalizeEmail, sha256Hex, verifyPassword } from "../../lib/crypto";
import { AppError } from "../../lib/errors";

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

type RequestEmailVerificationInput = {
  email: string;
};

type VerifyEmailInput = {
  token: string;
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

    const sessionToken = createOpaqueToken(48);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

    await db.insert(userSessions).values({
      userId: identity.userId,
      tokenHash,
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      sessionToken,
      expiresAt,
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
      scopes: input.scopes,
    });

    return {
      apiKey: rawApiKey,
      keyPrefix,
      scopes: input.scopes,
    };
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
}
