ALTER TYPE "market_command_type" ADD VALUE 'match_execution';--> statement-breakpoint
CREATE TABLE "market_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"market_id" uuid NOT NULL,
	"maker_order_id" uuid NOT NULL,
	"taker_order_id" uuid NOT NULL,
	"outcome" "order_outcome" NOT NULL,
	"price_bps" integer NOT NULL,
	"quantity" integer NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "filled_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "market_trades_market_id_idx" ON "market_trades" ("market_id","executed_at");--> statement-breakpoint
CREATE INDEX "market_trades_maker_order_id_idx" ON "market_trades" ("maker_order_id");--> statement-breakpoint
CREATE INDEX "market_trades_taker_order_id_idx" ON "market_trades" ("taker_order_id");--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_maker_order_id_orders_id_fkey" FOREIGN KEY ("maker_order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_trades" ADD CONSTRAINT "market_trades_taker_order_id_orders_id_fkey" FOREIGN KEY ("taker_order_id") REFERENCES "orders"("id") ON DELETE CASCADE;