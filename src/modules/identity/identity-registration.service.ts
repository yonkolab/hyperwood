import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  emailVerificationTokens,
  userIdentities,
  users,
} from '../../db/schema';
import { hashPassword, normalizeEmail } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { formatVerificationResponse } from './email-delivery-support';
import {
  buildEmailVerificationChallenge,
  rethrowConstraint,
} from './identity-workflow-support';
import { TransactionalEmailDeliveryService } from './transactional-email-delivery.service';
import type { LinkExistingUserInput, RegisterInput } from './types';

export class IdentityRegistrationService {
  constructor(
    private readonly emailDeliveryService = new TransactionalEmailDeliveryService(),
  ) {}

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
          throw new AppError(
            500,
            'user_creation_failed',
            'failed to create user',
          );
        }

        await tx.insert(userIdentities).values({
          userId: created.id,
          provider: 'password',
          providerSubject: email,
          email,
          passwordHash,
        });

        const verificationChallenge = buildEmailVerificationChallenge();

        const verificationTokenRows = await tx
          .insert(emailVerificationTokens)
          .values({
            userId: created.id,
            tokenHash: verificationChallenge.tokenHash,
            expiresAt: verificationChallenge.expiresAt,
          })
          .returning({
            id: emailVerificationTokens.id,
          });
        const verificationToken = verificationTokenRows[0];

        if (!verificationToken) {
          throw new AppError(
            500,
            'verification_creation_failed',
            `failed to create verification token for user ${created.id}`,
          );
        }

        return {
          user: created,
          verificationChallenge,
          verificationTokenId: verificationToken.id,
        };
      });
      const delivery = await this.emailDeliveryService.deliverVerificationEmail(
        {
          userId: result.user.id,
          email: result.user.email,
          username: result.user.username,
          verificationToken: result.verificationChallenge.token,
          expiresAt: result.verificationChallenge.expiresAt,
          sourceType: 'user_registration',
          sourceId: result.verificationTokenId,
        },
      );

      return formatVerificationResponse(
        result.user,
        result.verificationChallenge,
        delivery,
      );
    } catch (error) {
      rethrowConstraint(
        error,
        'user already exists for this email or username',
      );
      throw error;
    }
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
      throw new AppError(
        404,
        'user_not_found',
        `existing user was not found: ${input.userId}`,
      );
    }

    if (normalizeEmail(existingUser.email) !== email) {
      throw new AppError(
        409,
        'email_mismatch',
        'existing user email must match the linked password identity email',
      );
    }

    const existingIdentityRows = await db
      .select({ id: userIdentities.id })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, 'password'),
          eq(userIdentities.providerSubject, email),
        ),
      )
      .limit(1);

    if (existingIdentityRows[0]) {
      throw new AppError(
        409,
        'identity_exists',
        'a password identity already exists for this email',
      );
    }

    const passwordHash = hashPassword(input.password);

    await db.insert(userIdentities).values({
      userId: existingUser.id,
      provider: 'password',
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
}
