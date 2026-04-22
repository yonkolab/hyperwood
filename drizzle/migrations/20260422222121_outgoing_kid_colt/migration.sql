ALTER TABLE "exchange_fee_schedules" ALTER COLUMN "currency" SET DATA TYPE varchar(3) USING "currency"::varchar(3);--> statement-breakpoint
ALTER TABLE "markets" ALTER COLUMN "currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "markets" ALTER COLUMN "currency" SET DATA TYPE varchar(3) USING "currency"::varchar(3);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DATA TYPE varchar(3) USING "currency"::varchar(3);--> statement-breakpoint
DROP TYPE "market_currency";