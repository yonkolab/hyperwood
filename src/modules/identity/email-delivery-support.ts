import { env } from '../../config/env';
import {
  formatEmailTimestamp,
  renderEmailLayout,
  renderVerificationEmailBody,
} from './email-templates';
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
  const expiresAtLabel = formatEmailTimestamp(input.expiresAt);
  const subject = 'Ative sua conta no Hyperwood';
  const verificationLink =
    env.EMAIL_VERIFICATION_URL_BASE.length > 0
      ? `${env.EMAIL_VERIFICATION_URL_BASE.replace(/\/+$/, '')}/verify-email?token=${input.verificationToken}`
      : null;

  const text = [
    `Olá ${displayName},`,
    '',
    verificationLink
      ? 'Ative sua conta no Hyperwood abrindo o link abaixo:'
      : 'Use o token abaixo para ativar sua conta no Hyperwood:',
    verificationLink ?? input.verificationToken,
    '',
    `O link expira em ${expiresAtLabel}.`,
    '',
    verificationLink
      ? 'Se o link não funcionar, use este token manualmente:'
      : '',
    verificationLink ? input.verificationToken : '',
    '',
    '— Equipe Hyperwood',
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  const html = renderEmailLayout({
    title: subject,
    preheader: 'Confirme seu e-mail para começar a operar nos mercados.',
    bodyHtml: renderVerificationEmailBody({
      displayName,
      verificationToken: input.verificationToken,
      verificationLink,
      expiresAtLabel,
    }),
    footerNote:
      'Você recebeu este e-mail porque criou uma conta no Hyperwood. Se não foi você, ignore este e-mail.',
    appUrl:
      env.EMAIL_VERIFICATION_URL_BASE.replace(/\/+$/, '') || 'hyperwood.app',
  });

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
