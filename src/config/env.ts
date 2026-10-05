import 'dotenv/config';
import { z } from 'zod';

function parseConfiguredCurrencies(rawValue: string): [string, ...string[]] {
  const parsedValues = rawValue
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);

  if (parsedValues.length === 0) {
    throw new Error(
      `SUPPORTED_MARKET_CURRENCIES="${rawValue}" must contain at least one 3-letter currency code separated by commas`,
    );
  }

  const invalidValue = parsedValues.find((value) => !/^[A-Z]{3}$/.test(value));

  if (invalidValue) {
    throw new Error(
      `SUPPORTED_MARKET_CURRENCIES contains "${invalidValue}" but expected comma-separated 3-letter currency codes like "BRL,USD"`,
    );
  }

  const deduplicatedValues = [...new Set(parsedValues)];
  return deduplicatedValues as [string, ...string[]];
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  EMAIL_DELIVERY_PROVIDER: z
    .enum(['development_override', 'mailersend', 'resend'])
    .default('development_override'),
  EMAIL_FROM_NAME: z.string().min(1).default('Hyperwood'),
  PRIMARY_MARKET_CURRENCY: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{3}$/,
      'PRIMARY_MARKET_CURRENCY must be a 3-letter currency code like "BRL"',
    )
    .default('USD'),
  SUPPORTED_MARKET_CURRENCIES: z
    .string()
    .default('USD,BRL')
    .transform(parseConfiguredCurrencies),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  API_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),
  DATABASE_URL: z.string().min(1),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 30),
  SESSION_IDLE_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 7),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  MAILERSEND_API_TOKEN: z.string().default(''),
  MAILERSEND_DOMAIN: z
    .string()
    .min(1)
    .default('test-r9084zvxq6jgw63d.mlsender.net'),
  MAILERSEND_FROM_EMAIL: z
    .string()
    .email()
    .default('no-reply@test-r9084zvxq6jgw63d.mlsender.net'),
  MAILERSEND_WEBHOOK_SIGNING_SECRET: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.union([z.literal(''), z.string().email()]).default(''),
  EMAIL_VERIFICATION_URL_BASE: z.string().default(''),
  MFA_CHALLENGE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  MFA_ACTION_AUTHORIZATION_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
  LOGIN_RISK_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  LOGIN_MAX_FAILURES_PER_EMAIL: z.coerce.number().int().positive().default(5),
  LOGIN_MAX_FAILURES_PER_IP: z.coerce.number().int().positive().default(10),
  TOTP_ISSUER: z.string().min(1).default('Hyperwood'),
  TOTP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TOTP_ENCRYPTION_KEY must be 64 hex chars'),
  API_KEY_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'API_KEY_ENCRYPTION_KEY must be 64 hex chars'),
  API_HMAC_MAX_SKEW_SECONDS: z.coerce.number().int().positive().default(300),
  API_HMAC_NONCE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  FUNDING_PROVIDER_WEBHOOK_SECRET: z.string().min(1),
  FUNDING_PROVIDER_WEBHOOK_MAX_SKEW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  FUNDING_PROVIDER_CALLBACK_DELAY_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  REALTIME_STREAM_STALE_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(45),
  MARKET_SETTLEMENT_FAILURE_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  INTERNAL_BOOTSTRAP_TOKEN: z.string().min(1),
  SOCIAL_AUTH_FRONTEND_CALLBACK_URL: z
    .string()
    .url()
    .default('http://localhost:3002/auth/callback'),
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(''),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3000/api/v1/auth/oauth/google/callback'),
  APPLE_OAUTH_CLIENT_ID: z.string().default(''),
  APPLE_OAUTH_TEAM_ID: z.string().default(''),
  APPLE_OAUTH_KEY_ID: z.string().default(''),
  APPLE_OAUTH_PRIVATE_KEY: z.string().default(''),
  APPLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3000/api/v1/auth/oauth/apple/callback'),
});

const parsedEnv = envSchema.parse(process.env);

if (
  !parsedEnv.SUPPORTED_MARKET_CURRENCIES.includes(
    parsedEnv.PRIMARY_MARKET_CURRENCY,
  )
) {
  throw new Error(
    `PRIMARY_MARKET_CURRENCY="${parsedEnv.PRIMARY_MARKET_CURRENCY}" must be included in SUPPORTED_MARKET_CURRENCIES="${parsedEnv.SUPPORTED_MARKET_CURRENCIES.join(',')}"`,
  );
}

if (parsedEnv.EMAIL_DELIVERY_PROVIDER === 'resend') {
  if (parsedEnv.RESEND_API_KEY.length === 0) {
    throw new Error(
      'RESEND_API_KEY must be configured when EMAIL_DELIVERY_PROVIDER="resend"',
    );
  }

  if (parsedEnv.RESEND_FROM_EMAIL.length === 0) {
    throw new Error(
      'RESEND_FROM_EMAIL must be configured when EMAIL_DELIVERY_PROVIDER="resend"',
    );
  }
}

if (parsedEnv.EMAIL_DELIVERY_PROVIDER === 'mailersend') {
  if (parsedEnv.MAILERSEND_API_TOKEN.length === 0) {
    throw new Error(
      'MAILERSEND_API_TOKEN must be configured when EMAIL_DELIVERY_PROVIDER="mailersend"',
    );
  }

  const configuredFromDomain = parsedEnv.MAILERSEND_FROM_EMAIL.split('@')[1];

  if (
    configuredFromDomain?.toLowerCase() !==
    parsedEnv.MAILERSEND_DOMAIN.toLowerCase()
  ) {
    throw new Error(
      `MAILERSEND_FROM_EMAIL="${parsedEnv.MAILERSEND_FROM_EMAIL}" must use MAILERSEND_DOMAIN="${parsedEnv.MAILERSEND_DOMAIN}"`,
    );
  }
}

const googleOAuthValues = [
  parsedEnv.GOOGLE_OAUTH_CLIENT_ID,
  parsedEnv.GOOGLE_OAUTH_CLIENT_SECRET,
];
if (
  googleOAuthValues.some(Boolean) &&
  googleOAuthValues.some((value) => !value)
) {
  throw new Error(
    'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured together',
  );
}

const appleOAuthValues = [
  parsedEnv.APPLE_OAUTH_CLIENT_ID,
  parsedEnv.APPLE_OAUTH_TEAM_ID,
  parsedEnv.APPLE_OAUTH_KEY_ID,
  parsedEnv.APPLE_OAUTH_PRIVATE_KEY,
];
if (
  appleOAuthValues.some(Boolean) &&
  appleOAuthValues.some((value) => !value)
) {
  throw new Error(
    'All APPLE_OAUTH_CLIENT_ID, APPLE_OAUTH_TEAM_ID, APPLE_OAUTH_KEY_ID, and APPLE_OAUTH_PRIVATE_KEY values must be configured together',
  );
}

if (
  parsedEnv.NODE_ENV === 'production' &&
  (parsedEnv.GOOGLE_OAUTH_CLIENT_ID || parsedEnv.APPLE_OAUTH_CLIENT_ID)
) {
  const oauthUrls = [
    parsedEnv.SOCIAL_AUTH_FRONTEND_CALLBACK_URL,
    ...(parsedEnv.GOOGLE_OAUTH_CLIENT_ID
      ? [parsedEnv.GOOGLE_OAUTH_REDIRECT_URI]
      : []),
    ...(parsedEnv.APPLE_OAUTH_CLIENT_ID
      ? [parsedEnv.APPLE_OAUTH_REDIRECT_URI]
      : []),
  ];

  if (oauthUrls.some((value) => !value.startsWith('https://'))) {
    throw new Error('OAuth redirect URLs must use HTTPS in production');
  }
}

export const env = parsedEnv;
