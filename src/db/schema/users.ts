import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', [
  'pending_email_verification',
  'active',
  'disabled',
]);

export const kycStatusEnum = pgEnum('kyc_status', [
  'pending',
  'approved',
  'rejected',
  'restricted',
]);

export const identityProviderEnum = pgEnum('identity_provider', [
  'password',
  'oidc',
]);

export const mfaFactorTypeEnum = pgEnum('mfa_factor_type', ['totp']);

export const operatorStatusEnum = pgEnum('operator_status', [
  'active',
  'disabled',
]);

export const operatorRoleEnum = pgEnum('operator_role', [
  'super_admin',
  'operations_reader',
  'operations_scanner',
  'market_writer',
  'market_settler',
  'compliance_admin',
  'funding_approver',
  'funding_reconciler',
  'exchange_admin',
  'identity_admin',
]);

export const loginEventOutcomeEnum = pgEnum('login_event_outcome', [
  'success',
  'invalid_credentials',
  'mfa_challenge',
  'mfa_success',
  'blocked_suspicious',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    username: varchar('username', { length: 64 }),
    status: userStatusEnum('status')
      .notNull()
      .default('pending_email_verification'),
    region: varchar('region', { length: 64 }),
    kycStatus: kycStatusEnum('kyc_status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    uniqueIndex('users_username_unique').on(table.username),
  ],
);

export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: identityProviderEnum('provider').notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    passwordHash: text('password_hash'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('user_identities_user_id_idx').on(table.userId),
    uniqueIndex('user_identities_provider_subject_unique').on(
      table.provider,
      table.providerSubject,
    ),
  ],
);

export const oauthLoginTransactions = pgTable(
  'oauth_login_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 16 }).notNull(),
    stateHash: text('state_hash').notNull(),
    nonce: varchar('nonce', { length: 128 }).notNull(),
    codeVerifier: varchar('code_verifier', { length: 128 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    authorizationCodeHash: text('authorization_code_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('oauth_login_transactions_user_id_idx').on(table.userId),
    index('oauth_login_transactions_expires_at_idx').on(table.expiresAt),
    uniqueIndex('oauth_login_transactions_state_hash_unique').on(
      table.stateHash,
    ),
    uniqueIndex('oauth_login_transactions_authorization_code_hash_unique').on(
      table.authorizationCodeHash,
    ),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('user_sessions_user_id_idx').on(table.userId),
    uniqueIndex('user_sessions_token_hash_unique').on(table.tokenHash),
  ],
);

export const userMfaFactors = pgTable(
  'user_mfa_factors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: mfaFactorTypeEnum('type').notNull(),
    secretEncrypted: text('secret_encrypted').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('user_mfa_factors_user_id_idx').on(table.userId)],
);

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('email_verification_tokens_user_id_idx').on(table.userId),
    uniqueIndex('email_verification_tokens_token_hash_unique').on(
      table.tokenHash,
    ),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('password_reset_tokens_user_id_idx').on(table.userId),
    index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
    uniqueIndex('password_reset_tokens_token_hash_unique').on(table.tokenHash),
  ],
);

export const mfaLoginChallenges = pgTable(
  'mfa_login_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('mfa_login_challenges_user_id_idx').on(table.userId),
    uniqueIndex('mfa_login_challenges_token_hash_unique').on(table.tokenHash),
  ],
);

export const mfaActionAuthorizations = pgTable(
  'mfa_action_authorizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 64 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('mfa_action_authorizations_user_id_idx').on(table.userId),
    index('mfa_action_authorizations_user_action_idx').on(
      table.userId,
      table.action,
    ),
    uniqueIndex('mfa_action_authorizations_token_hash_unique').on(
      table.tokenHash,
    ),
  ],
);

export const loginEvents = pgTable(
  'login_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    email: varchar('email', { length: 255 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    outcome: loginEventOutcomeEnum('outcome').notNull(),
    suspicious: boolean('suspicious').notNull().default(false),
    reason: varchar('reason', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('login_events_user_id_idx').on(table.userId),
    index('login_events_email_created_at_idx').on(table.email, table.createdAt),
    index('login_events_ip_created_at_idx').on(
      table.ipAddress,
      table.createdAt,
    ),
  ],
);

export const apiKeyRequestNonces = pgTable(
  'api_key_request_nonces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    nonceHash: text('nonce_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('api_key_request_nonces_api_key_id_idx').on(table.apiKeyId),
    uniqueIndex('api_key_request_nonces_api_key_nonce_unique').on(
      table.apiKeyId,
      table.nonceHash,
    ),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
    secretHash: text('secret_hash').notNull(),
    secretEncrypted: text('secret_encrypted'),
    scopes: jsonb('scopes')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('api_keys_user_id_idx').on(table.userId),
    uniqueIndex('api_keys_key_prefix_unique').on(table.keyPrefix),
    uniqueIndex('api_keys_secret_hash_unique').on(table.secretHash),
  ],
);

export const operatorPrincipals = pgTable(
  'operator_principals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 128 }),
    status: operatorStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('operator_principals_email_unique').on(table.email)],
);

export const operatorRoleAssignments = pgTable(
  'operator_role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operatorPrincipals.id, { onDelete: 'cascade' }),
    role: operatorRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('operator_role_assignments_operator_id_idx').on(table.operatorId),
    uniqueIndex('operator_role_assignments_operator_role_unique').on(
      table.operatorId,
      table.role,
    ),
  ],
);

export const operatorApiTokens = pgTable(
  'operator_api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operatorPrincipals.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 64 }).notNull(),
    tokenPrefix: varchar('token_prefix', { length: 32 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('operator_api_tokens_operator_id_idx').on(table.operatorId),
    uniqueIndex('operator_api_tokens_token_prefix_unique').on(
      table.tokenPrefix,
    ),
    uniqueIndex('operator_api_tokens_token_hash_unique').on(table.tokenHash),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  identities: many(userIdentities),
  sessions: many(userSessions),
  mfaFactors: many(userMfaFactors),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
  mfaLoginChallenges: many(mfaLoginChallenges),
  mfaActionAuthorizations: many(mfaActionAuthorizations),
  loginEvents: many(loginEvents),
  apiKeys: many(apiKeys),
}));

export const operatorPrincipalsRelations = relations(
  operatorPrincipals,
  ({ many }) => ({
    roles: many(operatorRoleAssignments),
    apiTokens: many(operatorApiTokens),
  }),
);

export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userIdentities.userId],
    references: [users.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const userMfaFactorsRelations = relations(userMfaFactors, ({ one }) => ({
  user: one(users, {
    fields: [userMfaFactors.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  }),
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const mfaLoginChallengesRelations = relations(
  mfaLoginChallenges,
  ({ one }) => ({
    user: one(users, {
      fields: [mfaLoginChallenges.userId],
      references: [users.id],
    }),
  }),
);

export const mfaActionAuthorizationsRelations = relations(
  mfaActionAuthorizations,
  ({ one }) => ({
    user: one(users, {
      fields: [mfaActionAuthorizations.userId],
      references: [users.id],
    }),
  }),
);

export const loginEventsRelations = relations(loginEvents, ({ one }) => ({
  user: one(users, {
    fields: [loginEvents.userId],
    references: [users.id],
  }),
}));

export const apiKeyRequestNoncesRelations = relations(
  apiKeyRequestNonces,
  ({ one }) => ({
    apiKey: one(apiKeys, {
      fields: [apiKeyRequestNonces.apiKeyId],
      references: [apiKeys.id],
    }),
  }),
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const operatorRoleAssignmentsRelations = relations(
  operatorRoleAssignments,
  ({ one }) => ({
    operator: one(operatorPrincipals, {
      fields: [operatorRoleAssignments.operatorId],
      references: [operatorPrincipals.id],
    }),
  }),
);

export const operatorApiTokensRelations = relations(
  operatorApiTokens,
  ({ one }) => ({
    operator: one(operatorPrincipals, {
      fields: [operatorApiTokens.operatorId],
      references: [operatorPrincipals.id],
    }),
  }),
);
