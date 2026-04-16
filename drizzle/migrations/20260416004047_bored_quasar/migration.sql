CREATE TABLE "api_key_request_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"api_key_id" uuid NOT NULL,
	"nonce_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_key_request_nonces_api_key_id_idx" ON "api_key_request_nonces" ("api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_request_nonces_api_key_nonce_unique" ON "api_key_request_nonces" ("api_key_id","nonce_hash");--> statement-breakpoint
ALTER TABLE "api_key_request_nonces" ADD CONSTRAINT "api_key_request_nonces_api_key_id_api_keys_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE;