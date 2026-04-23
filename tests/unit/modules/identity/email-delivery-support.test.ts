import { describe, expect, it } from 'vitest';
import { buildVerificationEmailTemplate } from '../../../../src/modules/identity/email-delivery-support';

describe('email delivery support', () => {
  it('builds a verification email template with the token and expiry', () => {
    const template = buildVerificationEmailTemplate({
      userId: 'user_123',
      email: 'trader@example.com',
      username: 'trader01',
      verificationToken: 'verify-token',
      expiresAt: new Date('2026-04-22T12:00:00.000Z'),
      sourceType: 'user_registration',
      sourceId: 'verification_123',
    });

    expect(template.subject).toBe('Verify your Hyperwood account');
    expect(template.text).toContain('verify-token');
    expect(template.text).toContain('2026-04-22T12:00:00.000Z');
    expect(template.html).toContain('<strong>verify-token</strong>');
  });
});
