import { z } from 'zod';
import { operatorRoles } from './operator-access';

export const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(64).optional(),
  password: z.string().min(10),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileBodySchema = z.object({
  username: z.string().trim().min(3).max(64),
});

export const oauthProviderParamsSchema = z.object({
  provider: z.enum(['google', 'apple']),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export const oauthExchangeBodySchema = z.object({
  code: z.string().min(1).max(128),
});

export const requestEmailVerificationBodySchema = z.object({
  email: z.string().email(),
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1),
});

export const requestPasswordResetBodySchema = z.object({
  email: z.string().email(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1).max(128),
  password: z.string().min(10).max(128),
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

export const rotateApiKeyBodySchema = z.object({});

export const apiKeyParamsSchema = z.object({
  apiKeyId: z.string().uuid(),
});

export const emailWebhookProviderParamsSchema = z.object({
  provider: z.enum(['mailersend']),
});

export const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const createOperatorBodySchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(128).optional(),
  roles: z.array(z.enum(operatorRoles)).min(1),
});

export const operatorParamsSchema = z.object({
  operatorId: z.string().uuid(),
});

export const createOperatorTokenBodySchema = z.object({
  label: z.string().min(1).max(64),
});

export const operatorTokenParamsSchema = z.object({
  tokenId: z.string().uuid(),
});
