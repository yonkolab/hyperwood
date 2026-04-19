CREATE TABLE "admin_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"action" varchar(128) NOT NULL,
	"actor" varchar(128),
	"target_type" varchar(64) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_audit_events_action_idx" ON "admin_audit_events" ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_events_target_idx" ON "admin_audit_events" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_created_at_idx" ON "admin_audit_events" ("created_at");