ALTER TABLE "operator_role_assignments" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "operator_role";--> statement-breakpoint
CREATE TYPE "operator_role" AS ENUM('super_admin', 'operations_reader', 'operations_scanner', 'market_writer', 'market_settler', 'compliance_admin', 'funding_approver', 'funding_reconciler', 'exchange_admin', 'identity_admin');--> statement-breakpoint
ALTER TABLE "operator_role_assignments" ALTER COLUMN "role" SET DATA TYPE "operator_role" USING "role"::"operator_role";