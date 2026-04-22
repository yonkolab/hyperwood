import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { userSessions, users } from '../../db/schema';
import { createOpaqueToken, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import type { RevokeSessionInput } from './types';

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
   * Return persisted sessions for one user, newest first.
   *
   * Example:
   * `await identitySessionService.listSessions(userId, sessionToken)`
   */
  async listSessions(userId: string, currentSessionToken: string) {
    const currentTokenHash = sha256Hex(currentSessionToken);
    const sessions = await db
      .select({
        id: userSessions.id,
        tokenHash: userSessions.tokenHash,
        expiresAt: userSessions.expiresAt,
        ipAddress: userSessions.ipAddress,
        userAgent: userSessions.userAgent,
        lastSeenAt: userSessions.lastSeenAt,
        revokedAt: userSessions.revokedAt,
        createdAt: userSessions.createdAt,
      })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.createdAt));

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        current: session.tokenHash === currentTokenHash,
        expiresAt: session.expiresAt.toISOString(),
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        lastSeenAt: session.lastSeenAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Resolve one active session row from an opaque session token.
   *
   * Example:
   * `await identitySessionService.getSessionFromToken(sessionToken)`
   */
  async getSessionFromToken(sessionToken: string) {
    const tokenHash = sha256Hex(sessionToken);
    const [session] = await db
      .select({
        id: userSessions.id,
        userId: userSessions.userId,
        expiresAt: userSessions.expiresAt,
        revokedAt: userSessions.revokedAt,
      })
      .from(userSessions)
      .where(eq(userSessions.tokenHash, tokenHash))
      .limit(1);

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AppError(
        401,
        'invalid_session',
        'session is invalid or expired',
      );
    }

    return session;
  }

  /**
   * Revoke one session owned by the authenticated user.
   *
   * Example:
   * `await identitySessionService.revokeSession({ userId, sessionId })`
   */
  async revokeSession(input: RevokeSessionInput) {
    const [session] = await db
      .select({
        id: userSessions.id,
        userId: userSessions.userId,
        revokedAt: userSessions.revokedAt,
      })
      .from(userSessions)
      .where(eq(userSessions.id, input.sessionId))
      .limit(1);

    if (!session || session.userId !== input.userId) {
      throw new AppError(
        404,
        'session_not_found',
        `session was not found for id ${input.sessionId}`,
      );
    }

    if (session.revokedAt) {
      return {
        sessionId: session.id,
        revoked: true,
        alreadyRevoked: true,
      };
    }

    const revokedAt = new Date();

    await db
      .update(userSessions)
      .set({
        revokedAt,
      })
      .where(eq(userSessions.id, session.id));

    return {
      sessionId: session.id,
      revoked: true,
      alreadyRevoked: false,
      revokedAt: revokedAt.toISOString(),
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
