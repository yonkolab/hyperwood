import { describe, expect, it } from 'vitest';
import { env } from '../../../../src/config/env';
import { buildVerificationEmailTemplate } from '../../../../src/modules/identity/email-delivery-support';

describe('email delivery support', () => {
  const templateInput = {
    userId: 'user_123',
    email: 'trader@example.com',
    username: 'trader01',
    verificationToken: 'verify-token',
    expiresAt: new Date('2026-04-22T12:00:00.000Z'),
    sourceType: 'user_registration',
    sourceId: 'verification_123',
  };

  const configuredBase = (
    process.env.EMAIL_VERIFICATION_URL_BASE ?? 'https://app.hyperwood.test'
  ).replace(/\/+$/, '');

  it('builds a verification email template with the token and expiry', () => {
    env.EMAIL_VERIFICATION_URL_BASE = '';

    const template = buildVerificationEmailTemplate(templateInput);

    expect(template.subject).toBe('Ative sua conta no Hyperwood');
    expect(template.text).toContain('trader01');
    expect(template.text).toContain('verify-token');
    expect(template.html).toContain('HYPERWOOD');
    expect(template.html).toContain('verify-token');
    expect(template.html).toContain('<!doctype html>');
    expect(template.html).not.toContain('Verify your');
  });

  it('includes an activation link when the url base is configured', () => {
    env.EMAIL_VERIFICATION_URL_BASE = configuredBase;

    const template = buildVerificationEmailTemplate(templateInput);

    expect(template.text).toContain(
      `${configuredBase}/verify-email?token=verify-token`,
    );
    expect(template.html).toContain(
      `href="${configuredBase}/verify-email?token=verify-token"`,
    );
    expect(template.html).toContain('Ativar minha conta');
    expect(template.text).not.toContain('POST /api/v1/auth/verify-email');
    expect(template.html).not.toContain('POST /api/v1/auth/verify-email');
  });

  it('escapes user-provided values in the html body', () => {
    env.EMAIL_VERIFICATION_URL_BASE = '';

    const template = buildVerificationEmailTemplate({
      ...templateInput,
      username: '<script>alert(1)</script>',
    });

    expect(template.html).not.toContain('<script>alert');
    expect(template.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
