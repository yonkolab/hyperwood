CREATE TABLE "mfa_login_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mfa_login_challenges_user_id_idx" ON "mfa_login_challenges" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_login_challenges_token_hash_unique" ON "mfa_login_challenges" ("token_hash");--> statement-breakpoint
ALTER TABLE "mfa_login_challenges" ADD CONSTRAINT "mfa_login_challenges_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;