CREATE TYPE "funding_discrepancy_severity" AS ENUM('warning', 'critical');--> statement-breakpoint
CREATE TYPE "funding_discrepancy_type" AS ENUM('missing_internal_transfer', 'status_mismatch', 'ledger_invariant_violation');--> statement-breakpoint
CREATE TYPE "funding_reconciliation_run_status" AS ENUM('completed', 'completed_with_discrepancies');--> statement-breakpoint
CREATE TYPE "funding_reconciliation_scope" AS ENUM('funding_transfers');--> statement-breakpoint
CREATE TABLE "funding_reconciliation_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"transfer_id" uuid,
	"discrepancy_type" "funding_discrepancy_type" NOT NULL,
	"severity" "funding_discrepancy_severity" NOT NULL,
	"expected_status" "funding_transfer_status",
	"actual_status" "funding_transfer_status",
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" "funding_reconciliation_scope" NOT NULL,
	"provider" varchar(64),
	"status" "funding_reconciliation_run_status" NOT NULL,
	"compared_records_count" bigint DEFAULT 0 NOT NULL,
	"discrepancy_count" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "funding_reconciliation_discrepancies_run_id_idx" ON "funding_reconciliation_discrepancies" ("run_id");--> statement-breakpoint
CREATE INDEX "funding_reconciliation_discrepancies_transfer_id_idx" ON "funding_reconciliation_discrepancies" ("transfer_id");--> statement-breakpoint
CREATE INDEX "funding_reconciliation_discrepancies_type_idx" ON "funding_reconciliation_discrepancies" ("discrepancy_type");--> statement-breakpoint
CREATE INDEX "funding_reconciliation_discrepancies_resolved_at_idx" ON "funding_reconciliation_discrepancies" ("resolved_at");--> statement-breakpoint
CREATE INDEX "funding_reconciliation_runs_scope_idx" ON "funding_reconciliation_runs" ("scope");--> statement-breakpoint
CREATE INDEX "funding_reconciliation_runs_status_idx" ON "funding_reconciliation_runs" ("status");--> statement-breakpoint
CREATE INDEX "funding_reconciliation_runs_completed_at_idx" ON "funding_reconciliation_runs" ("completed_at");--> statement-breakpoint
ALTER TABLE "funding_reconciliation_discrepancies" ADD CONSTRAINT "funding_reconciliation_discrepancies_bopAeAzk4z3s_fkey" FOREIGN KEY ("run_id") REFERENCES "funding_reconciliation_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "funding_reconciliation_discrepancies" ADD CONSTRAINT "funding_reconciliation_discrepancies_VCef5457kaUk_fkey" FOREIGN KEY ("transfer_id") REFERENCES "funding_transfers"("id") ON DELETE SET NULL;