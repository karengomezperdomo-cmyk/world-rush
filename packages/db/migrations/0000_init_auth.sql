CREATE TABLE "auth_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "auth_nonces_format" CHECK ("auth_nonces"."nonce" ~ '^[A-Za-z0-9]{16,64}$')
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_meta" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"environment" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_meta_singleton" CHECK ("system_meta"."id"),
	CONSTRAINT "system_meta_environment_valid" CHECK ("system_meta"."environment" in ('development', 'staging', 'production'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"username" text,
	"avatar_url" text,
	"profile_synced_at" timestamp with time zone,
	"locale" text,
	"status" text DEFAULT 'active' NOT NULL,
	"human_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_wallet_format" CHECK ("users"."wallet_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "users_status_valid" CHECK ("users"."status" in ('active', 'suspended', 'banned', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "world_id_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"nullifier" numeric(78, 0) NOT NULL,
	"protocol_version" text NOT NULL,
	"credential" text NOT NULL,
	"environment" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wid_action_nullifier_uq" UNIQUE("action","nullifier"),
	CONSTRAINT "wid_user_action_uq" UNIQUE("user_id","action"),
	CONSTRAINT "wid_nullifier_non_negative" CHECK ("world_id_verifications"."nullifier" >= 0),
	CONSTRAINT "wid_protocol_valid" CHECK ("world_id_verifications"."protocol_version" in ('3.0', '4.0')),
	CONSTRAINT "wid_environment_valid" CHECK ("world_id_verifications"."environment" in ('production', 'staging'))
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_id_verifications" ADD CONSTRAINT "world_id_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_nonces_expires_idx" ON "auth_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uidx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_active_idx" ON "sessions" USING btree ("user_id") WHERE "sessions"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_wallet_uidx" ON "users" USING btree ("wallet_address");