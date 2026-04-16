import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { kycStatusEnum, users } from "./users";

export const sanctionsStatusEnum = pgEnum("sanctions_status", [
  "clear",
  "pending_review",
  "restricted",
]);

export const restrictionSourceEnum = pgEnum("restriction_source", [
  "system",
  "provider",
  "admin",
]);

export const complianceProfiles = pgTable(
  "compliance_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    jurisdictionCode: varchar("jurisdiction_code", { length: 32 }).notNull(),
    legalEntity: varchar("legal_entity", { length: 64 }).notNull(),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("pending"),
    sanctionsStatus: sanctionsStatusEnum("sanctions_status").notNull().default("pending_review"),
    kycProvider: varchar("kyc_provider", { length: 64 }),
    providerReference: varchar("provider_reference", { length: 255 }),
    ageVerifiedAt: timestamp("age_verified_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("compliance_profiles_country_idx").on(table.countryCode),
    index("compliance_profiles_jurisdiction_idx").on(table.jurisdictionCode),
  ],
);

export const accountRestrictions = pgTable(
  "account_restrictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 64 }).notNull(),
    reason: text("reason").notNull(),
    source: restrictionSourceEnum("source").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("account_restrictions_user_id_idx").on(table.userId),
    index("account_restrictions_scope_idx").on(table.scope),
  ],
);

export const complianceProfilesRelations = relations(complianceProfiles, ({ one }) => ({
  user: one(users, {
    fields: [complianceProfiles.userId],
    references: [users.id],
  }),
}));

export const accountRestrictionsRelations = relations(accountRestrictions, ({ one }) => ({
  user: one(users, {
    fields: [accountRestrictions.userId],
    references: [users.id],
  }),
}));
