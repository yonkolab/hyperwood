CREATE TYPE "market_resolution_outcome" AS ENUM('yes', 'no', 'void');--> statement-breakpoint
CREATE TABLE "market_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"market_id" uuid NOT NULL,
	"outcome" "market_resolution_outcome" NOT NULL,
	"evidence_summary" text NOT NULL,
	"evidence_sources" jsonb DEFAULT '[]' NOT NULL,
	"approved_by" varchar(128),
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_settlement_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"settlement_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"outcome" "market_resolution_outcome" NOT NULL,
	"quantity" integer NOT NULL,
	"cost_basis_minor" bigint NOT NULL,
	"payout_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"market_id" uuid NOT NULL,
	"resolution_id" uuid NOT NULL,
	"outcome" "market_resolution_outcome" NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_payout_minor" bigint DEFAULT 0 NOT NULL,
	"affected_user_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "market_resolutions_market_id_unique" ON "market_resolutions" ("market_id");--> statement-breakpoint
CREATE INDEX "market_resolutions_outcome_idx" ON "market_resolutions" ("outcome");--> statement-breakpoint
CREATE INDEX "market_settlement_payouts_settlement_id_idx" ON "market_settlement_payouts" ("settlement_id");--> statement-breakpoint
CREATE INDEX "market_settlement_payouts_market_user_idx" ON "market_settlement_payouts" ("market_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_settlements_market_id_unique" ON "market_settlements" ("market_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_settlements_resolution_id_unique" ON "market_settlements" ("resolution_id");--> statement-breakpoint
CREATE INDEX "market_settlements_settled_at_idx" ON "market_settlements" ("settled_at");--> statement-breakpoint
ALTER TABLE "market_resolutions" ADD CONSTRAINT "market_resolutions_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_settlement_payouts" ADD CONSTRAINT "market_settlement_payouts_1vNEQ3yWskFq_fkey" FOREIGN KEY ("settlement_id") REFERENCES "market_settlements"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_settlement_payouts" ADD CONSTRAINT "market_settlement_payouts_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_settlement_payouts" ADD CONSTRAINT "market_settlement_payouts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_settlements" ADD CONSTRAINT "market_settlements_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_settlements" ADD CONSTRAINT "market_settlements_resolution_id_market_resolutions_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "market_resolutions"("id") ON DELETE CASCADE;