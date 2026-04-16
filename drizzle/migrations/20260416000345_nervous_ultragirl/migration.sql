CREATE TYPE "identity_provider" AS ENUM('password', 'oidc');--> statement-breakpoint
CREATE TYPE "kyc_status" AS ENUM('pending', 'approved', 'rejected', 'restricted');--> statement-breakpoint
CREATE TYPE "mfa_factor_type" AS ENUM('totp');--> statement-breakpoint
CREATE TYPE "user_status" AS ENUM('pending_email_verification', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"key_prefix" varchar(32) NOT NULL,
	"secret_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"provider_subject" varchar(255) NOT NULL,
	"email" varchar(255),
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_mfa_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" "mfa_factor_type" NOT NULL,
	"secret_encrypted" text NOT NULL,
	"verified_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL,
	"username" varchar(64),
	"status" "user_status" DEFAULT 'pending_email_verification'::"user_status" NOT NULL,
	"region" varchar(64),
	"kyc_status" "kyc_status" DEFAULT 'pending'::"kyc_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_prefix_unique" ON "api_keys" ("key_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_secret_hash_unique" ON "api_keys" ("secret_hash");--> statement-breakpoint
CREATE INDEX "user_identities_user_id_idx" ON "user_identities" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_subject_unique" ON "user_identities" ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "user_mfa_factors_user_id_idx" ON "user_mfa_factors" ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_hash_unique" ON "user_sessions" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" ("username");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_mfa_factors" ADD CONSTRAINT "user_mfa_factors_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;