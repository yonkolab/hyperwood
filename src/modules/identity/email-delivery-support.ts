import { env } from '../../config/env';
import type {
  VerificationEmailDeliveryInput,
  VerificationEmailDeliveryResult,
} from './types';

export type VerificationEmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

export function buildVerificationEmailTemplate(
  input: VerificationEmailDeliveryInput,
): VerificationEmailTemplate {
  const displayName = input.username ?? input.email;
  const expiresAt = input.expiresAt.toISOString();
  const subject = 'Verify your Hyperwood account';
  const text = [
    `Hello ${displayName},`,
    '',
    'Use the verification token below to activate your Hyperwood account:',
    input.verificationToken,
    '',
    `This token expires at ${expiresAt}.`,
    '',
    'Submit it to POST /api/v1/auth/verify-email to complete verification.',
  ].join('\n');
  const html = [
    `<p>Hello ${displayName},</p>`,
    '<p>Use the verification token below to activate your Hyperwood account:</p>',
    `<p><strong>${input.verificationToken}</strong></p>`,
    `<p>This token expires at <strong>${expiresAt}</strong>.</p>`,
    '<p>Submit it to <code>POST /api/v1/auth/verify-email</code> to complete verification.</p>',
  ].join('');

  return {
    subject,
    text,
    html,
  };
}

export function formatVerificationDelivery(
  input: VerificationEmailDeliveryResult,
) {
  return {
    status: input.status,
    provider: input.provider,
    providerMessageId: input.providerMessageId,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    attemptedAt: input.attemptedAt,
  };
}

export function formatVerificationResponse(
  user: {
    id: string;
    email: string;
    username: string | null;
    status: string;
    region: string | null;
    kycStatus: string;
    createdAt: Date;
    updatedAt: Date;
  },
  verificationChallenge: {
    token: string;
    expiresAt: Date;
  },
  delivery: VerificationEmailDeliveryResult,
) {
  return {
    user,
    verificationChallenge: {
      expiresAt: verificationChallenge.expiresAt,
      ...(env.NODE_ENV !== 'production'
        ? { token: verificationChallenge.token }
        : {}),
    },
    delivery: formatVerificationDelivery(delivery),
  };
}
