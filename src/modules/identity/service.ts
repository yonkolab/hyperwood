import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { apiKeys, userIdentities, userSessions, users } from "../../db/schema";
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

export class IdentityService {
  async register(input: RegisterInput) {
    const email = normalizeEmail(input.email);
    const passwordHash = hashPassword(input.password);

    try {
      const createdUser = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            email,
            username: input.username,
          })
          .returning();

        await tx.insert(userIdentities).values({
          userId: created.id,
          provider: "password",
          providerSubject: email,
          email,
          passwordHash,
        });

        return created;
      });

      return {
        user: createdUser,
      };
    } catch (error) {
      this.rethrowConstraint(error, "user already exists for this email or username");
      throw error;
    }
  }

  async login(input: LoginInput) {
    const email = normalizeEmail(input.email);

    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "password"),
        eq(userIdentities.providerSubject, email),
      ),
      with: {
        user: true,
      },
    });

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

    const session = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.tokenHash, tokenHash),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date()),
      ),
      with: {
        user: true,
      },
    });

    if (!session) {
      throw new AppError(401, "invalid_session", "session is invalid or expired");
    }

    return session.user;
  }

  async linkExistingUser(input: LinkExistingUserInput) {
    const email = normalizeEmail(input.email);
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

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

    const existingIdentity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, "password"),
        eq(userIdentities.providerSubject, email),
      ),
    });

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
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, "user_not_found", "user was not found");
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
}
