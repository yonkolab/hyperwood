import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  emailVerificationTokens,
  userIdentities,
  users,
} from '../../db/schema';
import { normalizeEmail, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { formatVerificationResponse } from './email-delivery-support';
import { buildEmailVerificationChallenge } from './identity-workflow-support';
import { TransactionalEmailDeliveryService } from './transactional-email-delivery.service';
import type { RequestEmailVerificationInput, VerifyEmailInput } from './types';

export class EmailVerificationService {
  constructor(
    private readonly emailDeliveryService = new TransactionalEmailDeliveryService(),
  ) {}

  async requestEmailVerification(input: RequestEmailVerificationInput) {
    const email = normalizeEmail(input.email);
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const user = userRows[0];

    if (!user) {
      throw new AppError(
        404,
        'user_not_found',
        `user was not found for email ${email}`,
      );
    }

    if (user.status === 'active') {
      throw new AppError(
        409,
        'email_already_verified',
        'email is already verified for this user',
      );
    }

    const verificationChallenge = buildEmailVerificationChallenge();

    const insertedRows = await db
      .insert(emailVerificationTokens)
      .values({
        userId: user.id,
        tokenHash: verificationChallenge.tokenHash,
        expiresAt: verificationChallenge.expiresAt,
      })
      .returning({
        id: emailVerificationTokens.id,
      });
    const insertedVerificationToken = insertedRows[0];

    if (!insertedVerificationToken) {
      throw new AppError(
        500,
        'verification_creation_failed',
        `failed to create verification token for user ${user.id}`,
      );
    }
    const delivery = await this.emailDeliveryService.deliverVerificationEmail({
      userId: user.id,
      email: user.email,
      username: user.username,
      verificationToken: verificationChallenge.token,
      expiresAt: verificationChallenge.expiresAt,
      sourceType: 'email_verification_resend',
      sourceId: insertedVerificationToken.id,
    });

    return formatVerificationResponse(user, verificationChallenge, delivery);
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
          eq(userIdentities.provider, 'password'),
        ),
      )
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);
    const verification = rows[0];

    if (!verification) {
      throw new AppError(
        404,
        'verification_not_found',
        'verification token was not found',
      );
    }

    if (verification.consumedAt) {
      throw new AppError(
        409,
        'verification_consumed',
        'verification token was already used',
      );
    }

    if (verification.expiresAt <= new Date()) {
      throw new AppError(
        410,
        'verification_expired',
        'verification token has expired',
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: new Date() })
        .where(
          eq(emailVerificationTokens.id, verification.verificationTokenId),
        );

      await tx
        .update(users)
        .set({
          status: 'active',
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
        status: 'active' as const,
      },
      verified: true,
    };
  }
}
