import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import {
  passwordResetTokens,
  userIdentities,
  userSessions,
  users,
} from '../../db/schema';
import {
  createOpaqueToken,
  hashPassword,
  normalizeEmail,
  sha256Hex,
} from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { TransactionalEmailDeliveryService } from './transactional-email-delivery.service';
import type { RequestPasswordResetInput, ResetPasswordInput } from './types';

const genericResponse = {
  message:
    'Se houver uma conta elegível para este e-mail, enviaremos instruções para redefinir a senha.',
};

export class PasswordResetService {
  constructor(
    private readonly emailDeliveryService = new TransactionalEmailDeliveryService(),
  ) {}

  async requestPasswordReset(input: RequestPasswordResetInput) {
    const email = normalizeEmail(input.email);
    const matchingUsers = await db
      .select({
        userId: users.id,
        email: users.email,
        username: users.username,
      })
      .from(users)
      .innerJoin(
        userIdentities,
        and(
          eq(userIdentities.userId, users.id),
          eq(userIdentities.provider, 'password'),
          eq(userIdentities.providerSubject, email),
        ),
      )
      .where(and(eq(users.email, email), eq(users.status, 'active')))
      .limit(1);
    const user = matchingUsers[0];

    if (!user) {
      return {
        ...genericResponse,
        ...(env.NODE_ENV === 'production'
          ? {}
          : { developmentResetToken: null }),
      };
    }

    const token = createOpaqueToken(32);
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(
      Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );
    const inserted = await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, user.userId),
            isNull(passwordResetTokens.consumedAt),
          ),
        );

      const rows = await tx
        .insert(passwordResetTokens)
        .values({
          userId: user.userId,
          tokenHash,
          expiresAt,
        })
        .returning({ id: passwordResetTokens.id });
      return rows[0];
    });

    if (!inserted) {
      throw new Error('Failed to persist password reset token');
    }

    await this.emailDeliveryService.deliverPasswordResetEmail({
      userId: user.userId,
      email: user.email,
      username: user.username,
      resetToken: token,
      expiresAt,
      sourceId: inserted.id,
    });

    return {
      ...genericResponse,
      ...(env.NODE_ENV === 'production'
        ? {}
        : { developmentResetToken: token }),
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = sha256Hex(input.token);
    const passwordHash = hashPassword(input.password);
    const now = new Date();
    const reset = await db.transaction(async (tx) => {
      const matchingTokens = await tx
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
        })
        .from(passwordResetTokens)
        .innerJoin(users, eq(users.id, passwordResetTokens.userId))
        .innerJoin(
          userIdentities,
          and(
            eq(userIdentities.userId, passwordResetTokens.userId),
            eq(userIdentities.provider, 'password'),
          ),
        )
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.consumedAt),
            gt(passwordResetTokens.expiresAt, now),
            eq(users.status, 'active'),
          ),
        )
        .limit(1);
      const matchingToken = matchingTokens[0];

      if (!matchingToken) {
        return false;
      }

      const consumedRows = await tx
        .update(passwordResetTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(passwordResetTokens.id, matchingToken.id),
            isNull(passwordResetTokens.consumedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning({ id: passwordResetTokens.id });

      if (consumedRows.length === 0) {
        return false;
      }

      await tx
        .update(userIdentities)
        .set({ passwordHash })
        .where(
          and(
            eq(userIdentities.userId, matchingToken.userId),
            eq(userIdentities.provider, 'password'),
          ),
        );
      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, matchingToken.userId),
            isNull(passwordResetTokens.consumedAt),
          ),
        );
      await tx
        .update(userSessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(userSessions.userId, matchingToken.userId),
            isNull(userSessions.revokedAt),
          ),
        );

      return true;
    });

    if (!reset) {
      throw new AppError(
        400,
        'password_reset_invalid',
        'password reset link is invalid or expired',
      );
    }

    return { reset: true as const };
  }
}
