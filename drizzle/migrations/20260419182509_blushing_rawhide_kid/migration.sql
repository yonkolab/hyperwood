CREATE TABLE "exchange_fee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(160) NOT NULL,
	"currency" "market_currency" NOT NULL,
	"maker_fee_bps" integer NOT NULL,
	"taker_fee_bps" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "exchange_fee_schedules_currency_idx" ON "exchange_fee_schedules" ("currency");--> statement-breakpoint
CREATE INDEX "exchange_fee_schedules_effective_from_idx" ON "exchange_fee_schedules" ("effective_from");