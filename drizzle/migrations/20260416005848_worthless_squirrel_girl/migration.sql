CREATE TABLE "mfa_action_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mfa_action_authorizations_user_id_idx" ON "mfa_action_authorizations" ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_action_authorizations_user_action_idx" ON "mfa_action_authorizations" ("user_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_action_authorizations_token_hash_unique" ON "mfa_action_authorizations" ("token_hash");--> statement-breakpoint
ALTER TABLE "mfa_action_authorizations" ADD CONSTRAINT "mfa_action_authorizations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;