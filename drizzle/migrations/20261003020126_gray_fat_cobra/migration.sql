CREATE TABLE "market_comment_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_comment_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_comment_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"comment_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"market_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "market_comment_bookmarks_unique" ON "market_comment_bookmarks" ("comment_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_comment_likes_unique" ON "market_comment_likes" ("comment_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_comment_reports_unique" ON "market_comment_reports" ("comment_id","reporter_id");--> statement-breakpoint
CREATE INDEX "market_comments_market_created_idx" ON "market_comments" ("market_id","created_at");--> statement-breakpoint
CREATE INDEX "market_comments_parent_idx" ON "market_comments" ("parent_id");--> statement-breakpoint
CREATE INDEX "market_comments_user_idx" ON "market_comments" ("user_id");--> statement-breakpoint
ALTER TABLE "market_comment_bookmarks" ADD CONSTRAINT "market_comment_bookmarks_comment_id_market_comments_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "market_comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_comment_bookmarks" ADD CONSTRAINT "market_comment_bookmarks_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_comment_likes" ADD CONSTRAINT "market_comment_likes_comment_id_market_comments_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "market_comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_comment_likes" ADD CONSTRAINT "market_comment_likes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_comment_reports" ADD CONSTRAINT "market_comment_reports_comment_id_market_comments_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "market_comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_comment_reports" ADD CONSTRAINT "market_comment_reports_reporter_id_users_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_comments" ADD CONSTRAINT "market_comments_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_comments" ADD CONSTRAINT "market_comments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;