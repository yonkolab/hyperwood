CREATE TYPE "transactional_email_status" AS ENUM('development_override', 'queued', 'failed');--> statement-breakpoint
CREATE TABLE "transactional_email_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"recipient_email" varchar(255) NOT NULL,
	"message_type" varchar(64) NOT NULL,
	"provider" varchar(32),
	"source_type" varchar(64) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"status" "transactional_email_status" NOT NULL,
	"provider_message_id" varchar(255),
	"error_code" varchar(128),
	"error_message" varchar(512),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "transactional_email_attempts_user_id_idx" ON "transactional_email_attempts" ("user_id");--> statement-breakpoint
CREATE INDEX "transactional_email_attempts_recipient_idx" ON "transactional_email_attempts" ("recipient_email");--> statement-breakpoint
CREATE INDEX "transactional_email_attempts_message_type_idx" ON "transactional_email_attempts" ("message_type");--> statement-breakpoint
CREATE INDEX "transactional_email_attempts_source_idx" ON "transactional_email_attempts" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "transactional_email_attempts_status_idx" ON "transactional_email_attempts" ("status");--> statement-breakpoint
CREATE INDEX "transactional_email_attempts_created_at_idx" ON "transactional_email_attempts" ("created_at");