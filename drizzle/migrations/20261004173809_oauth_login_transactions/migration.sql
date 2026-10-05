CREATE TABLE "oauth_login_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" varchar(16) NOT NULL,
	"state_hash" text NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"code_verifier" varchar(128) NOT NULL,
	"user_id" uuid,
	"authorization_code_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oauth_login_transactions_user_id_idx" ON "oauth_login_transactions" ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_login_transactions_expires_at_idx" ON "oauth_login_transactions" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_login_transactions_state_hash_unique" ON "oauth_login_transactions" ("state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_login_transactions_authorization_code_hash_unique" ON "oauth_login_transactions" ("authorization_code_hash");--> statement-breakpoint
ALTER TABLE "oauth_login_transactions" ADD CONSTRAINT "oauth_login_transactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;