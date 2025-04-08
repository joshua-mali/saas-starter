CREATE TABLE "student_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_enrollment_id" integer NOT NULL,
	"class_curriculum_plan_id" integer NOT NULL,
	"content_group_id" integer NOT NULL,
	"content_point_id" integer,
	"grade_scale_id" integer NOT NULL,
	"assessment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_student_enrollment_id_student_enrollments_id_fk" FOREIGN KEY ("student_enrollment_id") REFERENCES "public"."student_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_class_curriculum_plan_id_class_curriculum_plan_id_fk" FOREIGN KEY ("class_curriculum_plan_id") REFERENCES "public"."class_curriculum_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_content_group_id_content_groups_id_fk" FOREIGN KEY ("content_group_id") REFERENCES "public"."content_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_content_point_id_content_points_id_fk" FOREIGN KEY ("content_point_id") REFERENCES "public"."content_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessments" ADD CONSTRAINT "student_assessments_grade_scale_id_grade_scales_id_fk" FOREIGN KEY ("grade_scale_id") REFERENCES "public"."grade_scales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_assessment_unique_idx" ON "student_assessments" USING btree ("student_enrollment_id","class_curriculum_plan_id","content_point_id");