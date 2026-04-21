import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(64).optional(),
  password: z.string().min(10),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const requestEmailVerificationBodySchema = z.object({
  email: z.string().email(),
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1),
});

export const confirmTotpSetupBodySchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export const verifyTotpLoginBodySchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export const authorizeSensitiveActionBodySchema = z.object({
  action: z.enum(['api_keys_manage']),
  code: z.string().regex(/^\d{6}$/),
});

export const linkExistingUserBodySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(10),
  emailVerified: z.boolean().optional(),
});

export const createApiKeyBodySchema = z.object({
  scopes: z.array(z.string().min(1)).min(1),
});

export const apiKeyParamsSchema = z.object({
  apiKeyId: z.string().uuid(),
});
