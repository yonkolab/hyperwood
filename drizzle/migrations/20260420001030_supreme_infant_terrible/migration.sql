CREATE TYPE "historical_export_format" AS ENUM('json');--> statement-breakpoint
CREATE TYPE "historical_export_scope" AS ENUM('account_history');--> statement-breakpoint
CREATE TYPE "historical_export_status" AS ENUM('completed');--> statement-breakpoint
CREATE TABLE "historical_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"scope" "historical_export_scope" NOT NULL,
	"status" "historical_export_status" DEFAULT 'completed'::"historical_export_status" NOT NULL,
	"format" "historical_export_format" DEFAULT 'json'::"historical_export_format" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"artifact" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "historical_export_jobs_user_id_idx" ON "historical_export_jobs" ("user_id");--> statement-breakpoint
CREATE INDEX "historical_export_jobs_scope_idx" ON "historical_export_jobs" ("scope");--> statement-breakpoint
CREATE INDEX "historical_export_jobs_created_at_idx" ON "historical_export_jobs" ("created_at");--> statement-breakpoint
ALTER TABLE "historical_export_jobs" ADD CONSTRAINT "historical_export_jobs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;