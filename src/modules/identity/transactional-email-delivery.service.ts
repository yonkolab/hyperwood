import { eq } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import {
  suppressedEmailRecipients,
  transactionalEmailAttempts,
} from '../../db/schema';
import { buildVerificationEmailTemplate } from './email-delivery-support';
import {
  MailerSendEmailClient,
  MailerSendRequestError,
} from './mailersend-email-client';
import { ResendEmailClient, ResendRequestError } from './resend-email-client';
import type {
  VerificationEmailDeliveryInput,
  VerificationEmailDeliveryResult,
} from './types';

export class TransactionalEmailDeliveryService {
  private readonly mailerSendClient = new MailerSendEmailClient();
  private readonly resendClient = new ResendEmailClient();

  /**
   * Deliver one verification email and persist the delivery attempt.
   *
   * Example:
   * `await service.deliverVerificationEmail({ userId, email, verificationToken, expiresAt, sourceType: 'user_registration', sourceId: userId })`
   */
  async deliverVerificationEmail(
    input: VerificationEmailDeliveryInput,
  ): Promise<VerificationEmailDeliveryResult> {
    const recipientSuppression = await db
      .select({
        id: suppressedEmailRecipients.id,
        reason: suppressedEmailRecipients.reason,
        releasedAt: suppressedEmailRecipients.releasedAt,
      })
      .from(suppressedEmailRecipients)
      .where(eq(suppressedEmailRecipients.email, input.email))
      .limit(1);
    const activeSuppression = recipientSuppression[0];

    if (activeSuppression && activeSuppression.releasedAt === null) {
      return this.recordAttempt({
        userId: input.userId,
        recipientEmail: input.email,
        messageType: 'email_verification',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: 'failed',
        provider: null,
        providerMessageId: null,
        errorCode: 'recipient_suppressed',
        errorMessage: `recipient ${input.email} is suppressed due to ${activeSuppression.reason}`,
        metadata: {
          suppressionId: activeSuppression.id,
          expiresAt: input.expiresAt.toISOString(),
        },
      });
    }

    if (env.EMAIL_DELIVERY_PROVIDER === 'development_override') {
      return this.recordAttempt({
        userId: input.userId,
        recipientEmail: input.email,
        messageType: 'email_verification',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: 'development_override',
        provider: null,
        providerMessageId: null,
        errorCode: null,
        errorMessage: null,
        metadata: {
          expiresAt: input.expiresAt.toISOString(),
        },
      });
    }

    const template = buildVerificationEmailTemplate(input);
    const provider = env.EMAIL_DELIVERY_PROVIDER;
    const providerName = provider === 'resend' ? 'resend' : 'mailersend';

    try {
      const result =
        provider === 'resend'
          ? await this.resendClient.sendVerificationEmail({
              toEmail: input.email,
              toName: input.username,
              subject: template.subject,
              text: template.text,
              html: template.html,
            })
          : await this.mailerSendClient.sendVerificationEmail({
              toEmail: input.email,
              toName: input.username,
              subject: template.subject,
              text: template.text,
              html: template.html,
            });

      if (result.warningCode || result.warningMessage) {
        return this.recordAttempt({
          userId: input.userId,
          recipientEmail: input.email,
          messageType: 'email_verification',
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          status: 'failed',
          provider: providerName,
          providerMessageId: result.providerMessageId,
          errorCode: result.warningCode,
          errorMessage: result.warningMessage,
          metadata: {
            expiresAt: input.expiresAt.toISOString(),
          },
        });
      }

      return this.recordAttempt({
        userId: input.userId,
        recipientEmail: input.email,
        messageType: 'email_verification',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: 'queued',
        provider: providerName,
        providerMessageId: result.providerMessageId,
        errorCode: null,
        errorMessage: null,
        metadata: {
          expiresAt: input.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      const normalizedError = normalizeDeliveryFailure(error);

      return this.recordAttempt({
        userId: input.userId,
        recipientEmail: input.email,
        messageType: 'email_verification',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: 'failed',
        provider: providerName,
        providerMessageId: null,
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
        metadata: {
          expiresAt: input.expiresAt.toISOString(),
        },
      });
    }
  }

  private async recordAttempt(input: {
    userId: string;
    recipientEmail: string;
    messageType: string;
    sourceType: string;
    sourceId: string;
    status: 'development_override' | 'queued' | 'failed';
    provider: 'mailersend' | 'resend' | null;
    providerMessageId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    metadata: Record<string, unknown>;
  }): Promise<VerificationEmailDeliveryResult> {
    const createdRows = await db
      .insert(transactionalEmailAttempts)
      .values({
        userId: input.userId,
        recipientEmail: input.recipientEmail,
        messageType: input.messageType,
        provider: input.provider,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: input.status,
        providerMessageId: input.providerMessageId,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
      })
      .returning({
        attemptId: transactionalEmailAttempts.id,
        attemptedAt: transactionalEmailAttempts.createdAt,
      });
    const created = createdRows[0];

    if (!created) {
      throw new Error(
        `failed to persist transactional email attempt for recipient ${input.recipientEmail}`,
      );
    }

    return {
      attemptId: created.attemptId,
      status: input.status,
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      failureCode: input.errorCode,
      failureMessage: input.errorMessage,
      attemptedAt: created.attemptedAt,
    };
  }
}

function normalizeDeliveryFailure(error: unknown) {
  if (error instanceof MailerSendRequestError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof ResendRequestError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'email_provider_request_failed',
      message: error.message,
    };
  }

  return {
    code: 'email_provider_request_failed',
    message: 'unknown email delivery failure',
  };
}
