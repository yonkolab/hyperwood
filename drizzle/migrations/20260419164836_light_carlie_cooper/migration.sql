CREATE TABLE "market_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"market_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"published_by" varchar(128),
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "market_announcements_market_id_idx" ON "market_announcements" ("market_id","published_at");--> statement-breakpoint
ALTER TABLE "market_announcements" ADD CONSTRAINT "market_announcements_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;