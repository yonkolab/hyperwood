const TEST_ENV_DEFAULTS: Record<string, string> = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: "3000",
  CORS_ALLOWED_ORIGINS: "http://localhost:8081,http://127.0.0.1:8081",
  API_RATE_LIMIT_WINDOW_SECONDS: "60",
  API_RATE_LIMIT_MAX_REQUESTS: "120",
  AUTH_RATE_LIMIT_WINDOW_SECONDS: "60",
  AUTH_RATE_LIMIT_MAX_REQUESTS: "5",
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/hyperwood_test",
  SESSION_TTL_HOURS: "720",
  EMAIL_VERIFICATION_TTL_MINUTES: "60",
  MFA_CHALLENGE_TTL_MINUTES: "10",
  MFA_ACTION_AUTHORIZATION_TTL_MINUTES: "5",
  LOGIN_RISK_WINDOW_MINUTES: "15",
  LOGIN_MAX_FAILURES_PER_EMAIL: "5",
  LOGIN_MAX_FAILURES_PER_IP: "10",
  TOTP_ISSUER: "Hyperwood Test",
  TOTP_ENCRYPTION_KEY:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  API_KEY_ENCRYPTION_KEY:
    "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  API_HMAC_MAX_SKEW_SECONDS: "300",
  API_HMAC_NONCE_TTL_SECONDS: "300",
  INTERNAL_BOOTSTRAP_TOKEN: "test-bootstrap-token",
};

export function applyTestEnv(overrides: Record<string, string> = {}) {
  for (const [key, value] of Object.entries({
    ...TEST_ENV_DEFAULTS,
    ...overrides,
  })) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
