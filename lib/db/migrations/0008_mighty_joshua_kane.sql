CREATE TABLE "outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focus_areas" RENAME COLUMN "subject_id" TO "outcome_id";--> statement-breakpoint
ALTER TABLE "focus_areas" DROP CONSTRAINT "focus_areas_subject_id_subjects_id_fk";
--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_areas" ADD CONSTRAINT "focus_areas_outcome_id_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."outcomes"("id") ON DELETE cascade ON UPDATE no action;