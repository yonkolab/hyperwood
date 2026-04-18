CREATE TYPE "market_command_type" AS ENUM('order_create', 'order_cancel');--> statement-breakpoint
CREATE TABLE "market_command_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"market_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"command_type" "market_command_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "last_command_sequence" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "market_command_events_market_id_idx" ON "market_command_events" ("market_id");--> statement-breakpoint
CREATE INDEX "market_command_events_order_id_idx" ON "market_command_events" ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_command_events_market_sequence_unique" ON "market_command_events" ("market_id","sequence");--> statement-breakpoint
ALTER TABLE "market_command_events" ADD CONSTRAINT "market_command_events_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_command_events" ADD CONSTRAINT "market_command_events_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;