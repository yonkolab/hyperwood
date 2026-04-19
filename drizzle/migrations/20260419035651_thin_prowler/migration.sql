CREATE TABLE "market_status_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"market_id" uuid NOT NULL,
	"from_status" "market_status",
	"to_status" "market_status" NOT NULL,
	"reason" text NOT NULL,
	"changed_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "market_status_transitions_market_id_idx" ON "market_status_transitions" ("market_id","created_at");--> statement-breakpoint
ALTER TABLE "market_status_transitions" ADD CONSTRAINT "market_status_transitions_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;