import type { db } from '../../db/client';

export type SensitiveAction = 'api_keys_manage';

export type LoginEventOutcome =
  | 'success'
  | 'invalid_credentials'
  | 'mfa_challenge'
  | 'mfa_success'
  | 'blocked_suspicious';

export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RegisterInput = {
  email: string;
  username?: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
};

export type LinkExistingUserInput = {
  userId: string;
  email: string;
  password: string;
  emailVerified?: boolean;
};

export type CreateApiKeyInput = {
  userId: string;
  scopes: string[];
  mfaAuthorizationToken: string | undefined;
};

export type RevokeApiKeyInput = {
  userId: string;
  apiKeyId: string;
  mfaAuthorizationToken: string | undefined;
};

export type AuthenticateApiKeyInput = {
  rawApiKey: string;
  requiredScopes?: string[];
};

export type AuthenticateHmacApiKeyInput = {
  keyPrefix: string;
  timestamp: string;
  nonce: string;
  signature: string;
  method: string;
  path: string;
  requiredScopes?: string[];
};

export type RequestEmailVerificationInput = {
  email: string;
};

export type VerifyEmailInput = {
  token: string;
};

export type SetupTotpInput = {
  userId: string;
};

export type ConfirmTotpSetupInput = {
  userId: string;
  factorId: string;
  code: string;
};

export type VerifyTotpLoginInput = {
  challengeToken: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
};

export type AuthorizeSensitiveActionWithTotpInput = {
  userId: string;
  action: SensitiveAction;
  code: string;
};
