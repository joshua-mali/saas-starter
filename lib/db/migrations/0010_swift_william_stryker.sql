CREATE TABLE "class_curriculum_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"content_group_id" integer NOT NULL,
	"week_start_date" date NOT NULL,
	"duration_weeks" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"calendar_year" integer NOT NULL,
	"term_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_curriculum_plan" ADD CONSTRAINT "class_curriculum_plan_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_curriculum_plan" ADD CONSTRAINT "class_curriculum_plan_content_group_id_content_groups_id_fk" FOREIGN KEY ("content_group_id") REFERENCES "public"."content_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_class_idx" ON "class_curriculum_plan" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_team_year_term_unique_idx" ON "terms" USING btree ("team_id","calendar_year","term_number");