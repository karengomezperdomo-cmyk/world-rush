CREATE TABLE "best_scores" (
	"competition_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"best_time_ms" integer NOT NULL,
	"run_id" uuid NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"final_rank" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "best_scores_competition_id_user_id_pk" PRIMARY KEY("competition_id","user_id"),
	CONSTRAINT "best_scores_time_positive" CHECK ("best_scores"."best_time_ms" > 0)
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_slug" text NOT NULL,
	"level_fingerprint" text NOT NULL,
	"ruleset" text NOT NULL,
	"day" timestamp with time zone NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"grace_seconds" integer DEFAULT 120 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"participants_count" integer,
	"winner_time_ms" integer,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_status_valid" CHECK ("competitions"."status" in ('scheduled', 'open', 'closed', 'finalized', 'cancelled')),
	CONSTRAINT "competitions_window_ordered" CHECK ("competitions"."closes_at" > "competitions"."opens_at"),
	CONSTRAINT "competitions_grace_sane" CHECK ("competitions"."grace_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"claimed_duration_ms" integer,
	"ruleset" text NOT NULL,
	"client_version" text,
	"replay" "bytea",
	"replay_hash" "bytea",
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_suspicious" boolean DEFAULT false NOT NULL,
	"invalidated_at" timestamp with time zone,
	"invalidation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_status_valid" CHECK ("runs"."status" in ('started', 'verifying', 'valid', 'invalid', 'abandoned', 'expired')),
	CONSTRAINT "runs_duration_positive" CHECK ("runs"."duration_ms" is null or "runs"."duration_ms" > 0),
	CONSTRAINT "runs_valid_is_complete" CHECK ("runs"."status" <> 'valid' or ("runs"."duration_ms" is not null and "runs"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "best_scores" ADD CONSTRAINT "best_scores_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "best_scores" ADD CONSTRAINT "best_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "best_scores" ADD CONSTRAINT "best_scores_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "best_scores_rank_idx" ON "best_scores" USING btree ("competition_id","best_time_ms","achieved_at","user_id") WHERE "best_scores"."is_visible";--> statement-breakpoint
CREATE INDEX "best_scores_user_idx" ON "best_scores" USING btree ("user_id","achieved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "best_scores_final_rank_uidx" ON "best_scores" USING btree ("competition_id","final_rank") WHERE "best_scores"."final_rank" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_day_uidx" ON "competitions" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_week_map_uidx" ON "competitions" USING btree ("week_start","map_slug");--> statement-breakpoint
CREATE INDEX "competitions_window_idx" ON "competitions" USING btree ("opens_at","closes_at");--> statement-breakpoint
CREATE INDEX "runs_user_comp_idx" ON "runs" USING btree ("user_id","competition_id","started_at");--> statement-breakpoint
CREATE INDEX "runs_comp_status_idx" ON "runs" USING btree ("competition_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_replay_hash_uidx" ON "runs" USING btree ("competition_id","replay_hash") WHERE "runs"."replay_hash" is not null;