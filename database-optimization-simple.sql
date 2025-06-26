-- Database optimization script for grading page performance
-- This version works in Supabase SQL Editor (without CONCURRENTLY)
-- For production, consider using CONCURRENTLY with an external client

-- Index for student enrollments lookup by class and status
CREATE INDEX IF NOT EXISTS idx_student_enrollments_class_status 
ON student_enrollments (class_id, status) 
WHERE status = 'active';

-- Index for class curriculum plan lookup by class and week
CREATE INDEX IF NOT EXISTS idx_class_curriculum_plan_class_week 
ON class_curriculum_plan (class_id, week_start_date);

-- Index for student assessments lookup by enrollment and date
CREATE INDEX IF NOT EXISTS idx_student_assessments_enrollment_date 
ON student_assessments (student_enrollment_id, assessment_date);

-- Composite index for faster joins
CREATE INDEX IF NOT EXISTS idx_student_assessments_composite 
ON student_assessments (student_enrollment_id, class_curriculum_plan_id, content_point_id, assessment_date);

-- Index for terms lookup by team and year
CREATE INDEX IF NOT EXISTS idx_terms_team_year 
ON terms (team_id, calendar_year);

-- Index for class teachers authorization check
CREATE INDEX IF NOT EXISTS idx_class_teachers_class_teacher 
ON class_teachers (class_id, teacher_id);

-- Analyze tables to update statistics after creating indexes
ANALYZE student_enrollments;
ANALYZE class_curriculum_plan;
ANALYZE student_assessments;
ANALYZE terms;
ANALYZE class_teachers; 