CREATE TYPE "login_event_outcome" AS ENUM('success', 'invalid_credentials', 'mfa_challenge', 'mfa_success', 'blocked_suspicious');--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"email" varchar(255) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"outcome" "login_event_outcome" NOT NULL,
	"suspicious" boolean DEFAULT false NOT NULL,
	"reason" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_events_user_id_idx" ON "login_events" ("user_id");--> statement-breakpoint
CREATE INDEX "login_events_email_created_at_idx" ON "login_events" ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_events_ip_created_at_idx" ON "login_events" ("ip_address","created_at");--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;