CREATE TYPE "market_currency" AS ENUM('USD', 'BRL');--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "currency" "market_currency" DEFAULT 'USD'::"market_currency" NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DATA TYPE "market_currency" USING "currency"::"market_currency";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD'::"market_currency";