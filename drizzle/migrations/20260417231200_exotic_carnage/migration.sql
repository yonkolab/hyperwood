CREATE TYPE "market_status" AS ENUM('draft', 'scheduled', 'active', 'halted', 'trading_closed', 'awaiting_resolution', 'settled', 'cancelled', 'disputed', 'voided');--> statement-breakpoint
CREATE TABLE "market_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" varchar(128) NOT NULL,
	"title" varchar(160) NOT NULL,
	"summary" text,
	"category" varchar(64) NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"slug" varchar(128) NOT NULL,
	"title" varchar(160) NOT NULL,
	"summary" text,
	"status" "market_status" DEFAULT 'draft'::"market_status" NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"resolution_rules" text NOT NULL,
	"resolution_sources" jsonb DEFAULT '[]' NOT NULL,
	"yes_price_bps" integer DEFAULT 5000 NOT NULL,
	"no_price_bps" integer DEFAULT 5000 NOT NULL,
	"volume_usd_minor" bigint DEFAULT 0 NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"resolves_at" timestamp with time zone,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "market_events_slug_unique" ON "market_events" ("slug");--> statement-breakpoint
CREATE INDEX "market_events_category_idx" ON "market_events" ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "markets_slug_unique" ON "markets" ("slug");--> statement-breakpoint
CREATE INDEX "markets_event_id_idx" ON "markets" ("event_id");--> statement-breakpoint
CREATE INDEX "markets_status_idx" ON "markets" ("status");--> statement-breakpoint
CREATE INDEX "markets_volume_usd_minor_idx" ON "markets" ("volume_usd_minor");--> statement-breakpoint
CREATE INDEX "markets_closes_at_idx" ON "markets" ("closes_at");--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_event_id_market_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "market_events"("id") ON DELETE CASCADE;