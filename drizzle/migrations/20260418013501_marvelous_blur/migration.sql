CREATE TYPE "order_outcome" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TYPE "order_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM('queued_for_matching', 'partially_filled', 'filled', 'cancelled');--> statement-breakpoint
CREATE TYPE "order_type" AS ENUM('limit', 'market');--> statement-breakpoint
CREATE TYPE "self_trade_prevention" AS ENUM('decrement_and_cancel', 'cancel_oldest', 'cancel_newest');--> statement-breakpoint
ALTER TYPE "wallet_account_type" ADD VALUE 'user_order_reserved' BEFORE 'platform_clearing';--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" text NOT NULL,
	"type" "order_type" NOT NULL,
	"side" "order_side" NOT NULL,
	"outcome" "order_outcome" NOT NULL,
	"status" "order_status" DEFAULT 'queued_for_matching'::"order_status" NOT NULL,
	"quantity" integer NOT NULL,
	"limit_price_bps" integer,
	"reference_price_bps" integer NOT NULL,
	"reserved_amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"self_trade_prevention" "self_trade_prevention" DEFAULT 'decrement_and_cancel'::"self_trade_prevention" NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" ("user_id");--> statement-breakpoint
CREATE INDEX "orders_market_id_idx" ON "orders" ("market_id");--> statement-breakpoint
CREATE INDEX "orders_user_status_idx" ON "orders" ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_idempotency_key_unique" ON "orders" ("user_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;