ALTER TABLE "academic_years" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teaching_blocks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "terms" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "academic_years" CASCADE;--> statement-breakpoint
DROP TABLE "teaching_blocks" CASCADE;--> statement-breakpoint
DROP TABLE "terms" CASCADE;--> statement-breakpoint
ALTER TABLE "classes" RENAME COLUMN "academic_year_id" TO "calendar_year";--> statement-breakpoint
