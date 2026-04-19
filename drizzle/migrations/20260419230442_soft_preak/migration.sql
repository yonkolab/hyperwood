CREATE TYPE "provider_webhook_event_status" AS ENUM('applied');--> statement-breakpoint
CREATE TABLE "provider_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" varchar(64) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"transfer_id" uuid,
	"status" "provider_webhook_event_status" NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_webhook_events_provider_event_id_unique" ON "provider_webhook_events" ("provider","event_id");--> statement-breakpoint
CREATE INDEX "provider_webhook_events_transfer_id_idx" ON "provider_webhook_events" ("transfer_id");--> statement-breakpoint
CREATE INDEX "provider_webhook_events_processed_at_idx" ON "provider_webhook_events" ("processed_at");--> statement-breakpoint
ALTER TABLE "provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_transfer_id_funding_transfers_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "funding_transfers"("id") ON DELETE SET NULL;