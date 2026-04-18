import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const fundingRailEnum = pgEnum("funding_rail", [
  "ach",
  "fps",
  "pix",
  "wire",
  "debit_card",
  "crypto_wallet",
]);

export const fundingMethodStatusEnum = pgEnum("funding_method_status", [
  "pending_verification",
  "verified",
  "disabled",
]);

export const fundingTransferTypeEnum = pgEnum("funding_transfer_type", [
  "deposit",
  "withdrawal",
]);

export const fundingTransferStatusEnum = pgEnum("funding_transfer_status", [
  "pending",
  "in_review",
  "settled",
  "failed",
  "cancelled",
  "reversed",
]);

export const walletAccountTypeEnum = pgEnum("wallet_account_type", [
  "user_cash",
  "user_order_reserved",
  "user_position_collateral",
  "platform_clearing",
]);

export const ledgerEntrySideEnum = pgEnum("ledger_entry_side", ["debit", "credit"]);

export const fundingMethods = pgTable(
  "funding_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rail: fundingRailEnum("rail").notNull(),
    status: fundingMethodStatusEnum("status").notNull().default("pending_verification"),
    provider: varchar("provider", { length: 64 }),
    providerReference: varchar("provider_reference", { length: 255 }),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    last4: varchar("last4", { length: 4 }),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("funding_methods_user_id_idx").on(table.userId),
    index("funding_methods_user_status_idx").on(table.userId, table.status),
  ],
);

export const fundingTransfers = pgTable(
  "funding_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fundingMethodId: uuid("funding_method_id")
      .notNull()
      .references(() => fundingMethods.id, { onDelete: "restrict" }),
    type: fundingTransferTypeEnum("type").notNull(),
    status: fundingTransferStatusEnum("status").notNull().default("pending"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    providerTransferReference: varchar("provider_transfer_reference", { length: 255 }),
    failureReason: text("failure_reason"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("funding_transfers_user_id_idx").on(table.userId),
    index("funding_transfers_method_id_idx").on(table.fundingMethodId),
    index("funding_transfers_user_status_idx").on(table.userId, table.status),
    index("funding_transfers_type_status_idx").on(table.type, table.status),
  ],
);

export const walletAccounts = pgTable(
  "wallet_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    type: walletAccountTypeEnum("type").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("wallet_accounts_owner_user_id_idx").on(table.ownerUserId),
    uniqueIndex("wallet_accounts_owner_type_currency_unique").on(
      table.ownerUserId,
      table.type,
      table.currency,
    ),
  ],
);

export const ledgerTransactions = pgTable("ledger_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  referenceType: varchar("reference_type", { length: 64 }).notNull(),
  referenceId: varchar("reference_id", { length: 255 }),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: "cascade" }),
    walletAccountId: uuid("wallet_account_id")
      .notNull()
      .references(() => walletAccounts.id, { onDelete: "cascade" }),
    side: ledgerEntrySideEnum("side").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ledger_entries_transaction_id_idx").on(table.transactionId),
    index("ledger_entries_wallet_account_id_idx").on(table.walletAccountId),
  ],
);

export const fundingMethodsRelations = relations(fundingMethods, ({ one }) => ({
  user: one(users, {
    fields: [fundingMethods.userId],
    references: [users.id],
  }),
}));

export const fundingTransfersRelations = relations(fundingTransfers, ({ one }) => ({
  user: one(users, {
    fields: [fundingTransfers.userId],
    references: [users.id],
  }),
  fundingMethod: one(fundingMethods, {
    fields: [fundingTransfers.fundingMethodId],
    references: [fundingMethods.id],
  }),
}));

export const walletAccountsRelations = relations(walletAccounts, ({ one, many }) => ({
  ownerUser: one(users, {
    fields: [walletAccounts.ownerUserId],
    references: [users.id],
  }),
  entries: many(ledgerEntries),
}));

export const ledgerTransactionsRelations = relations(ledgerTransactions, ({ many }) => ({
  entries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(ledgerTransactions, {
    fields: [ledgerEntries.transactionId],
    references: [ledgerTransactions.id],
  }),
  walletAccount: one(walletAccounts, {
    fields: [ledgerEntries.walletAccountId],
    references: [walletAccounts.id],
  }),
}));
