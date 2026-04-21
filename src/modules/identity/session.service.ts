import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { userSessions, users } from '../../db/schema';
import { createOpaqueToken, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';

export class IdentitySessionService {
  /**
   * Create a new opaque session token and persist only its hash.
   *
   * Example:
   * `await identitySessionService.createSession({ userId, ipAddress })`
   */
  async createSession(input: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const sessionToken = createOpaqueToken(48);
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(
      Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    );

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

  /**
   * Resolve the active user behind an opaque session token.
   *
   * Example:
   * `await identitySessionService.getUserFromSessionToken(sessionToken)`
   */
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
      throw new AppError(
        401,
        'invalid_session',
        'session is invalid or expired',
      );
    }

    return session.user;
  }
}
