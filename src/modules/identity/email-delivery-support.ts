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

export function buildPasswordResetEmailTemplate(input: {
  username: string | null;
  email: string;
  resetToken: string;
  expiresAt: Date;
}) {
  const displayName = input.username ?? input.email;
  const expiresAtLabel = formatEmailTimestamp(input.expiresAt);
  const resetLink =
    env.EMAIL_VERIFICATION_URL_BASE.length > 0
      ? `${env.EMAIL_VERIFICATION_URL_BASE.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(input.resetToken)}`
      : null;
  const subject = 'Redefina sua senha no Hyperwood';
  const resetAction = resetLink
    ? `<p style="margin:28px 0"><a href="${escapeHtml(resetLink)}" style="display:inline-block;background:#22d3ee;color:#020617;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none">Redefinir minha senha</a></p>`
    : `<p style="margin:0 0 24px">Use este token para redefinir sua senha:<br /><strong style="color:#0f172a;user-select:all">${escapeHtml(input.resetToken)}</strong></p>`;
  const text = [
    `Olá ${displayName},`,
    '',
    'Recebemos uma solicitação para redefinir a senha da sua conta Hyperwood.',
    resetLink
      ? `Escolha uma nova senha neste link: ${resetLink}`
      : `Use este token para escolher uma nova senha: ${input.resetToken}`,
    '',
    `O link expira em ${expiresAtLabel}.`,
    'Se você não solicitou a redefinição, ignore este e-mail.',
    '',
    '— Equipe Hyperwood',
  ].join('\n');
  const html = renderEmailLayout({
    title: subject,
    preheader: 'Use o link para escolher uma nova senha da sua conta.',
    bodyHtml: [
      '<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#0f172a">Redefina sua senha</h1>',
      `<p style="margin:0 0 8px">Olá ${escapeHtml(displayName)},</p>`,
      '<p style="margin:0 0 24px">Recebemos uma solicitação para redefinir a senha da sua conta Hyperwood.</p>',
      resetAction,
      `<p style="margin:0;font-size:13px;line-height:20px;color:#64748b">O link expira em <strong style="color:#0f172a">${escapeHtml(expiresAtLabel)}</strong>. Se você não solicitou a redefinição, ignore este e-mail.</p>`,
    ].join('\n'),
    footerNote:
      'Você recebeu este e-mail porque foi solicitada uma redefinição de senha para sua conta Hyperwood.',
    appUrl:
      env.EMAIL_VERIFICATION_URL_BASE.replace(/\/+$/, '') || 'hyperwood.app',
  });

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character] ?? character;
  });
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
