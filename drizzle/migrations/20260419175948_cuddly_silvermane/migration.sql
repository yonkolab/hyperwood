CREATE TABLE "exchange_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(160) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"weekly_windows" jsonb DEFAULT '[]' NOT NULL,
	"maintenance_windows" jsonb DEFAULT '[]' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "exchange_schedules_updated_at_idx" ON "exchange_schedules" ("updated_at");