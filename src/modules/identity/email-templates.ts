import Handlebars from 'handlebars';

const handlebars = Handlebars.create();

handlebars.registerPartial(
  'emailHeader',
  [
    '<tr>',
    '<td style="padding:32px 40px 28px;background:#0a0f16;text-align:center">',
    '<span style="font-size:20px;font-weight:700;letter-spacing:0.18em;color:#22d3ee">HYPERWOOD</span>',
    '<div style="margin-top:6px;font-size:12px;color:#94a3b8">Plataforma de mercados de previsão</div>',
    '</td>',
    '</tr>',
  ].join(''),
);

handlebars.registerPartial(
  'emailFooter',
  [
    '<tr>',
    '<td style="padding:28px 40px 36px;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;text-align:center">',
    '{{footerNote}}',
    '<div style="margin-top:12px">&copy; 2026 Hyperwood &middot; <a href="{{appUrl}}" style="color:#64748b;text-decoration:underline">{{appUrl}}</a></div>',
    '</td>',
    '</tr>',
  ].join(''),
);

const layoutTemplate = handlebars.compile(
  [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="light" />',
    '<title>{{title}}</title>',
    '</head>',
    '<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">',
    '<span style="display:none;max-height:0;overflow:hidden;opacity:0">{{preheader}}</span>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">',
    '{{> emailHeader}}',
    '<tr>',
    '<td style="padding:32px 40px 8px;font-size:16px;line-height:24px;color:#0f172a">',
    '{{{bodyHtml}}}',
    '</td>',
    '</tr>',
    '<tr><td style="height:24px"></td></tr>',
    '{{> emailFooter}}',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n'),
);

export type EmailLayoutInput = {
  title: string;
  preheader: string;
  bodyHtml: string;
  footerNote: string;
  appUrl: string;
};

export function renderEmailLayout(input: EmailLayoutInput): string {
  return layoutTemplate(input);
}

const verificationBodyTemplate = handlebars.compile(
  [
    '<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#0f172a">Ative sua conta</h1>',
    '<p style="margin:0 0 8px">Olá {{displayName}},</p>',
    '<p style="margin:0 0 24px">Bem-vindo ao Hyperwood! Confirme seu e-mail para começar a operar nos mercados.</p>',
    '{{#if verificationLink}}',
    '<p style="margin:28px 0"><a href="{{{verificationLink}}}" style="display:inline-block;background:#22d3ee;color:#020617;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none">Ativar minha conta</a></p>',
    '<p style="margin:0 0 24px;font-size:13px;line-height:20px;color:#64748b">Se o botão não funcionar, use este token manualmente:<br /><strong style="color:#0f172a;user-select:all">{{verificationToken}}</strong></p>',
    '{{else}}',
    '<p style="margin:0 0 24px">Use o token abaixo para ativar sua conta:<br /><strong style="color:#0f172a">{{verificationToken}}</strong></p>',
    '{{/if}}',
    '<p style="margin:0;font-size:13px;line-height:20px;color:#64748b">O link expira em <strong style="color:#0f172a">{{expiresAtLabel}}</strong>.</p>',
  ].join('\n'),
);

export type VerificationEmailBodyInput = {
  displayName: string;
  verificationToken: string;
  verificationLink: string | null;
  expiresAtLabel: string;
};

export function renderVerificationEmailBody(
  input: VerificationEmailBodyInput,
): string {
  return verificationBodyTemplate(input);
}

export function formatEmailTimestamp(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}
