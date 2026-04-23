CREATE TYPE "transactional_email_feedback_status" AS ENUM('sent', 'delivered', 'deferred', 'soft_bounced', 'hard_bounced', 'complained');--> statement-breakpoint
CREATE TABLE "suppressed_email_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider_message_id" varchar(255),
	"source_type" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactional_email_feedback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" varchar(32) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"status" "transactional_email_feedback_status" NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider_message_id" varchar(255),
	"recipient_email" varchar(255),
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "suppressed_email_recipients_active_unique" ON "suppressed_email_recipients" ("email");--> statement-breakpoint
CREATE INDEX "suppressed_email_recipients_reason_idx" ON "suppressed_email_recipients" ("reason");--> statement-breakpoint
CREATE INDEX "suppressed_email_recipients_created_at_idx" ON "suppressed_email_recipients" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactional_email_feedback_events_provider_unique" ON "transactional_email_feedback_events" ("provider","provider_event_id","event_type");--> statement-breakpoint
CREATE INDEX "transactional_email_feedback_events_message_idx" ON "transactional_email_feedback_events" ("provider_message_id");--> statement-breakpoint
CREATE INDEX "transactional_email_feedback_events_recipient_idx" ON "transactional_email_feedback_events" ("recipient_email");--> statement-breakpoint
CREATE INDEX "transactional_email_feedback_events_status_idx" ON "transactional_email_feedback_events" ("status");--> statement-breakpoint
CREATE INDEX "transactional_email_feedback_events_occurred_at_idx" ON "transactional_email_feedback_events" ("occurred_at");