CREATE TYPE "operator_role" AS ENUM('super_admin', 'operations_admin', 'market_admin', 'compliance_admin', 'funding_admin', 'exchange_admin', 'identity_admin');--> statement-breakpoint
CREATE TYPE "operator_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "operator_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"operator_id" uuid NOT NULL,
	"label" varchar(64) NOT NULL,
	"token_prefix" varchar(32) NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_principals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL,
	"display_name" varchar(128),
	"status" "operator_status" DEFAULT 'active'::"operator_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"operator_id" uuid NOT NULL,
	"role" "operator_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "operator_api_tokens_operator_id_idx" ON "operator_api_tokens" ("operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operator_api_tokens_token_prefix_unique" ON "operator_api_tokens" ("token_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "operator_api_tokens_token_hash_unique" ON "operator_api_tokens" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "operator_principals_email_unique" ON "operator_principals" ("email");--> statement-breakpoint
CREATE INDEX "operator_role_assignments_operator_id_idx" ON "operator_role_assignments" ("operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operator_role_assignments_operator_role_unique" ON "operator_role_assignments" ("operator_id","role");--> statement-breakpoint
ALTER TABLE "operator_api_tokens" ADD CONSTRAINT "operator_api_tokens_operator_id_operator_principals_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operator_principals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "operator_role_assignments" ADD CONSTRAINT "operator_role_assignments_CoH9yWY6NPOc_fkey" FOREIGN KEY ("operator_id") REFERENCES "operator_principals"("id") ON DELETE CASCADE;