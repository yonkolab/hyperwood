CREATE TABLE "api_rate_limit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"bucket" varchar(64) NOT NULL,
	"scope_type" varchar(32) NOT NULL,
	"scope_key" varchar(255) NOT NULL,
	"method" varchar(16) NOT NULL,
	"path" varchar(255) NOT NULL,
	"limit" integer NOT NULL,
	"observed_count" integer NOT NULL,
	"request_ip" varchar(64),
	"window_started_at" timestamp with time zone NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_rate_limit_events_window_unique" ON "api_rate_limit_events" ("bucket","scope_type","scope_key","method","path","window_started_at");--> statement-breakpoint
CREATE INDEX "api_rate_limit_events_created_at_idx" ON "api_rate_limit_events" ("created_at");--> statement-breakpoint
CREATE INDEX "api_rate_limit_events_scope_idx" ON "api_rate_limit_events" ("scope_type","scope_key");--> statement-breakpoint
CREATE INDEX "api_rate_limit_events_path_idx" ON "api_rate_limit_events" ("path");