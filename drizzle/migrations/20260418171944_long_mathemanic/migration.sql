CREATE TYPE "funding_transfer_status" AS ENUM('pending', 'in_review', 'settled', 'failed', 'cancelled', 'reversed');--> statement-breakpoint
CREATE TYPE "funding_transfer_type" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TABLE "funding_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"funding_method_id" uuid NOT NULL,
	"type" "funding_transfer_type" NOT NULL,
	"status" "funding_transfer_status" DEFAULT 'pending'::"funding_transfer_status" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"provider_transfer_reference" varchar(255),
	"failure_reason" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "funding_transfers_user_id_idx" ON "funding_transfers" ("user_id");--> statement-breakpoint
CREATE INDEX "funding_transfers_method_id_idx" ON "funding_transfers" ("funding_method_id");--> statement-breakpoint
CREATE INDEX "funding_transfers_user_status_idx" ON "funding_transfers" ("user_id","status");--> statement-breakpoint
CREATE INDEX "funding_transfers_type_status_idx" ON "funding_transfers" ("type","status");--> statement-breakpoint
ALTER TABLE "funding_transfers" ADD CONSTRAINT "funding_transfers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "funding_transfers" ADD CONSTRAINT "funding_transfers_funding_method_id_funding_methods_id_fkey" FOREIGN KEY ("funding_method_id") REFERENCES "funding_methods"("id") ON DELETE RESTRICT;