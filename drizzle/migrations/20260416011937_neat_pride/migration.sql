CREATE TYPE "restriction_source" AS ENUM('system', 'provider', 'admin');--> statement-breakpoint
CREATE TYPE "sanctions_status" AS ENUM('clear', 'pending_review', 'restricted');--> statement-breakpoint
CREATE TABLE "account_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"scope" varchar(64) NOT NULL,
	"reason" text NOT NULL,
	"source" "restriction_source" NOT NULL,
	"expires_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_profiles" (
	"user_id" uuid PRIMARY KEY,
	"country_code" varchar(2) NOT NULL,
	"jurisdiction_code" varchar(32) NOT NULL,
	"legal_entity" varchar(64) NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'pending'::"kyc_status" NOT NULL,
	"sanctions_status" "sanctions_status" DEFAULT 'pending_review'::"sanctions_status" NOT NULL,
	"kyc_provider" varchar(64),
	"provider_reference" varchar(255),
	"age_verified_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_restrictions_user_id_idx" ON "account_restrictions" ("user_id");--> statement-breakpoint
CREATE INDEX "account_restrictions_scope_idx" ON "account_restrictions" ("scope");--> statement-breakpoint
CREATE INDEX "compliance_profiles_country_idx" ON "compliance_profiles" ("country_code");--> statement-breakpoint
CREATE INDEX "compliance_profiles_jurisdiction_idx" ON "compliance_profiles" ("jurisdiction_code");--> statement-breakpoint
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "compliance_profiles" ADD CONSTRAINT "compliance_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;