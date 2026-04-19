CREATE TYPE "operations_alert_severity" AS ENUM('warning', 'critical');--> statement-breakpoint
CREATE TYPE "operations_alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TABLE "operations_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"category" varchar(64) NOT NULL,
	"severity" "operations_alert_severity" NOT NULL,
	"status" "operations_alert_status" DEFAULT 'open'::"operations_alert_status" NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"message" varchar(512) NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "operations_alerts_source_unique" ON "operations_alerts" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "operations_alerts_status_idx" ON "operations_alerts" ("status");--> statement-breakpoint
CREATE INDEX "operations_alerts_severity_idx" ON "operations_alerts" ("severity");--> statement-breakpoint
CREATE INDEX "operations_alerts_category_idx" ON "operations_alerts" ("category");--> statement-breakpoint
CREATE INDEX "operations_alerts_created_at_idx" ON "operations_alerts" ("created_at");