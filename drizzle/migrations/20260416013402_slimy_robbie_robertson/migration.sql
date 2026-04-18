CREATE TYPE "funding_method_status" AS ENUM('pending_verification', 'verified', 'disabled');--> statement-breakpoint
CREATE TYPE "funding_rail" AS ENUM('ach', 'fps', 'pix', 'wire', 'debit_card', 'crypto_wallet');--> statement-breakpoint
CREATE TYPE "ledger_entry_side" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "wallet_account_type" AS ENUM('user_cash', 'platform_clearing');--> statement-breakpoint
CREATE TABLE "funding_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"rail" "funding_rail" NOT NULL,
	"status" "funding_method_status" DEFAULT 'pending_verification'::"funding_method_status" NOT NULL,
	"provider" varchar(64),
	"provider_reference" varchar(255),
	"display_name" varchar(128) NOT NULL,
	"last4" varchar(4),
	"country_code" varchar(2) NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"transaction_id" uuid NOT NULL,
	"wallet_account_id" uuid NOT NULL,
	"side" "ledger_entry_side" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"reference_type" varchar(64) NOT NULL,
	"reference_id" varchar(255),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_user_id" uuid,
	"type" "wallet_account_type" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "funding_methods_user_id_idx" ON "funding_methods" ("user_id");--> statement-breakpoint
CREATE INDEX "funding_methods_user_status_idx" ON "funding_methods" ("user_id","status");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries" ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_wallet_account_id_idx" ON "ledger_entries" ("wallet_account_id");--> statement-breakpoint
CREATE INDEX "wallet_accounts_owner_user_id_idx" ON "wallet_accounts" ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_accounts_owner_type_currency_unique" ON "wallet_accounts" ("owner_user_id","type","currency");--> statement-breakpoint
ALTER TABLE "funding_methods" ADD CONSTRAINT "funding_methods_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_account_id_wallet_accounts_id_fkey" FOREIGN KEY ("wallet_account_id") REFERENCES "wallet_accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_owner_user_id_users_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE;