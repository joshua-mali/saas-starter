-- schema.sql for Grade Tracker application with updated hierarchy
-- Hierarchy: Stage > Subject > Focus Area > Focus Group > Content Group > Content Point

-- Enable UUID extension for Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools table
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    principal_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (for authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    encrypted_password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'teacher', 'assistant')),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academic years
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_academic_year_name UNIQUE (name)
);

-- Terms/Semesters
CREATE TABLE terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_term_name_per_year UNIQUE (academic_year_id, name)
);

-- Teaching blocks
CREATE TABLE teaching_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_week INT NOT NULL,
    end_week INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_block_name_per_term UNIQUE (term_id, name)
);

-- Stages (Modified - now comes before Subjects in hierarchy)
CREATE TABLE stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    year_levels VARCHAR(50) NOT NULL, -- e.g. "1,2" for Stage 1
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_stage_name UNIQUE (name)
);

-- Subjects (Modified - now comes after Stages in hierarchy)
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_subject_name UNIQUE (name)
);

-- Focus areas (Modified - now explicitly links Stage to Subject)
CREATE TABLE focus_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_focus_area_name_per_stage_subject UNIQUE (name, stage_id, subject_id)
);

-- Focus groups
CREATE TABLE focus_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    focus_area_id UUID NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_focus_group_name_per_area UNIQUE (name, focus_area_id)
);

-- Content groups
CREATE TABLE content_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    focus_group_id UUID NOT NULL REFERENCES focus_groups(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_content_group_name_per_focus_group UNIQUE (name, focus_group_id)
);

-- Content points
CREATE TABLE content_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    content_group_id UUID NOT NULL REFERENCES content_groups(id) ON DELETE CASCADE,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_content_point_name_per_group UNIQUE (name, content_group_id)
);

-- Grade scale
CREATE TABLE grade_scales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    numeric_value INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_grade_scale_name UNIQUE (name),
    CONSTRAINT unique_grade_scale_value UNIQUE (numeric_value)
);

-- Classes (Modified - links to stage)
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_class_name_per_school_year UNIQUE (name, school_id, academic_year_id)
);

-- Class teachers (junction table for many-to-many)
CREATE TABLE class_teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_teacher_class UNIQUE (class_id, teacher_id)
);

-- Students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    external_id VARCHAR(100), -- For integration with school systems
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student class enrollments
CREATE TABLE student_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'withdrawn')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_student_enrollment UNIQUE (student_id, class_id)
);

-- Class curriculum planning table
CREATE TABLE class_curriculum_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teaching_block_id UUID NOT NULL REFERENCES teaching_blocks(id) ON DELETE CASCADE,
    content_group_id UUID NOT NULL REFERENCES content_groups(id) ON DELETE CASCADE,
    planned_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_class_block_content UNIQUE (class_id, teaching_block_id, content_group_id)
);

-- Student assessments with option to assess at content point or content group level
CREATE TABLE student_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    content_point_id UUID REFERENCES content_points(id) ON DELETE CASCADE,
    content_group_id UUID REFERENCES content_groups(id) ON DELETE CASCADE,
    grade_id UUID NOT NULL REFERENCES grade_scales(id) ON DELETE CASCADE,
    assessed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    teaching_block_id UUID NOT NULL REFERENCES teaching_blocks(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure that either content_point_id OR content_group_id is provided, but not both
    CONSTRAINT check_assessment_level CHECK (
        (content_point_id IS NOT NULL AND content_group_id IS NULL) OR
        (content_point_id IS NULL AND content_group_id IS NOT NULL)
    ),
    CONSTRAINT unique_student_point_assessment UNIQUE (student_id, content_point_id, teaching_block_id) 
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT unique_student_group_assessment UNIQUE (student_id, content_group_id, teaching_block_id) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Add indexes for performance
CREATE INDEX idx_student_assessments_student ON student_assessments(student_id);
CREATE INDEX idx_student_assessments_content_point ON student_assessments(content_point_id);
CREATE INDEX idx_student_assessments_content_group ON student_assessments(content_group_id);
CREATE INDEX idx_student_assessments_teaching_block ON student_assessments(teaching_block_id);
CREATE INDEX idx_student_enrollments_class ON student_enrollments(class_id);
CREATE INDEX idx_content_points_content_group ON content_points(content_group_id);
CREATE INDEX idx_content_groups_focus_group ON content_groups(focus_group_id);
CREATE INDEX idx_focus_groups_focus_area ON focus_groups(focus_area_id);
CREATE INDEX idx_focus_areas_stage ON focus_areas(stage_id);
CREATE INDEX idx_focus_areas_subject ON focus_areas(subject_id);
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_classes_stage ON classes(stage_id);
CREATE INDEX idx_class_curriculum_plans_class ON class_curriculum_plans(class_id);
CREATE INDEX idx_class_curriculum_plans_teaching_block ON class_curriculum_plans(teaching_block_id);
CREATE INDEX idx_class_curriculum_plans_content_group ON class_curriculum_plans(content_group_id);

-- Row Level Security Policies for multi-tenancy

-- Enable Row Level Security
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_curriculum_plans ENABLE ROW LEVEL SECURITY;

-- Policy for schools: Admin can see all, teachers can only see their school
CREATE POLICY school_policy ON schools
    USING (
        (auth.role() = 'admin') OR 
        (auth.role() = 'teacher' AND id = (SELECT school_id FROM users WHERE id = auth.uid()))
    );

-- Policy for users: Admin can see all, teachers can only see users in their school
CREATE POLICY users_policy ON users
    USING (
        (auth.role() = 'admin') OR 
        (auth.role() = 'teacher' AND school_id = (SELECT school_id FROM users WHERE id = auth.uid()))
    );

-- Policy for classes: Admin can see all, teachers can only see their classes
CREATE POLICY classes_policy ON classes
    USING (
        (auth.role() = 'admin') OR 
        (auth.role() = 'teacher' AND id IN (SELECT class_id FROM class_teachers WHERE teacher_id = auth.uid()))
    );

-- Policy for students: Admin can see all, teachers can only see students in their classes
CREATE POLICY students_policy ON students
    USING (
        (auth.role() = 'admin') OR 
        (auth.role() = 'teacher' AND id IN (
            SELECT student_id FROM student_enrollments 
            WHERE class_id IN (
                SELECT class_id FROM class_teachers WHERE teacher_id = auth.uid()
            )
        ))
    );

-- Policy for curriculum plans: Admin can see all, teachers can only see plans for their classes
CREATE POLICY curriculum_plans_policy ON class_curriculum_plans
    USING (
        (auth.role() = 'admin') OR 
        (auth.role() = 'teacher' AND class_id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = auth.uid()
        ))
    );

-- Create functions for managing timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update timestamps
CREATE TRIGGER update_schools_timestamp BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_academic_years_timestamp BEFORE UPDATE ON academic_years FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_terms_timestamp BEFORE UPDATE ON terms FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_teaching_blocks_timestamp BEFORE UPDATE ON teaching_blocks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_subjects_timestamp BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_stages_timestamp BEFORE UPDATE ON stages FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_focus_areas_timestamp BEFORE UPDATE ON focus_areas FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_focus_groups_timestamp BEFORE UPDATE ON focus_groups FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_content_groups_timestamp BEFORE UPDATE ON content_groups FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_content_points_timestamp BEFORE UPDATE ON content_points FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_grade_scales_timestamp BEFORE UPDATE ON grade_scales FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_classes_timestamp BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_class_teachers_timestamp BEFORE UPDATE ON class_teachers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_students_timestamp BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_student_enrollments_timestamp BEFORE UPDATE ON student_enrollments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_class_curriculum_plans_timestamp BEFORE UPDATE ON class_curriculum_plans FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_student_assessments_timestamp BEFORE UPDATE ON student_assessments FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Pre-populate grade scales
INSERT INTO grade_scales (name, numeric_value, description) VALUES
('Extensive', 5, 'Student demonstrates extensive achievement of knowledge, understanding and skills'),
('Thorough', 4, 'Student demonstrates thorough achievement of knowledge, understanding and skills'),
('Sound', 3, 'Student demonstrates sound achievement of knowledge, understanding and skills'),
('Basic', 2, 'Student demonstrates basic achievement of knowledge, understanding and skills'),
('Elementary', 1, 'Student demonstrates elementary achievement of knowledge, understanding and skills');

-- View for Content Group level averages (Updated for new hierarchy)
CREATE OR REPLACE VIEW vw_student_content_group_averages AS
SELECT 
    sa.student_id,
    COALESCE(sa.content_group_id, cp.content_group_id) AS content_group_id,
    cg.name AS content_group_name,
    sa.teaching_block_id,
    tb.name AS teaching_block_name,
    AVG(gs.numeric_value) AS average_grade
FROM 
    student_assessments sa
LEFT JOIN 
    content_points cp ON sa.content_point_id = cp.id
LEFT JOIN 
    content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
LEFT JOIN 
    teaching_blocks tb ON sa.teaching_block_id = tb.id
LEFT JOIN 
    grade_scales gs ON sa.grade_id = gs.id
GROUP BY 
    sa.student_id, 
    COALESCE(sa.content_group_id, cp.content_group_id),
    cg.name,
    sa.teaching_block_id,
    tb.name;

-- View for Focus Group level averages (Updated for new hierarchy)
CREATE OR REPLACE VIEW vw_student_focus_group_averages AS
SELECT 
    sa.student_id,
    cg.focus_group_id,
    fg.name AS focus_group_name,
    sa.teaching_block_id,
    tb.name AS teaching_block_name,
    AVG(gs.numeric_value) AS average_grade
FROM 
    student_assessments sa
LEFT JOIN 
    content_points cp ON sa.content_point_id = cp.id
LEFT JOIN 
    content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
LEFT JOIN 
    focus_groups fg ON cg.focus_group_id = fg.id
LEFT JOIN 
    teaching_blocks tb ON sa.teaching_block_id = tb.id
LEFT JOIN 
    grade_scales gs ON sa.grade_id = gs.id
GROUP BY 
    sa.student_id, 
    cg.focus_group_id,
    fg.name,
    sa.teaching_block_id,
    tb.name;

-- View for Focus Area level averages (Updated for new hierarchy)
CREATE OR REPLACE VIEW vw_student_focus_area_averages AS
SELECT 
    sa.student_id,
    fg.focus_area_id,
    fa.name AS focus_area_name,
    fa.stage_id,
    st.name AS stage_name,
    fa.subject_id,
    s.name AS subject_name,
    sa.teaching_block_id,
    tb.name AS teaching_block_name,
    AVG(gs.numeric_value) AS average_grade
FROM 
    student_assessments sa
LEFT JOIN 
    content_points cp ON sa.content_point_id = cp.id
LEFT JOIN 
    content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
LEFT JOIN 
    focus_groups fg ON cg.focus_group_id = fg.id
LEFT JOIN 
    focus_areas fa ON fg.focus_area_id = fa.id
LEFT JOIN 
    stages st ON fa.stage_id = st.id
LEFT JOIN 
    subjects s ON fa.subject_id = s.id
LEFT JOIN 
    teaching_blocks tb ON sa.teaching_block_id = tb.id
LEFT JOIN 
    grade_scales gs ON sa.grade_id = gs.id
GROUP BY 
    sa.student_id, 
    fg.focus_area_id,
    fa.name,
    fa.stage_id,
    st.name,
    fa.subject_id,
    s.name,
    sa.teaching_block_id,
    tb.name;

-- View for Subject level averages (Updated for new hierarchy)
CREATE OR REPLACE VIEW vw_student_subject_averages AS
SELECT 
    sa.student_id,
    fa.subject_id,
    s.name AS subject_name,
    fa.stage_id,
    st.name AS stage_name,
    sa.teaching_block_id,
    tb.name AS teaching_block_name,
    AVG(gs.numeric_value) AS average_grade
FROM 
    student_assessments sa
LEFT JOIN 
    content_points cp ON sa.content_point_id = cp.id
LEFT JOIN 
    content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
LEFT JOIN 
    focus_groups fg ON cg.focus_group_id = fg.id
LEFT JOIN 
    focus_areas fa ON fg.focus_area_id = fa.id
LEFT JOIN 
    subjects s ON fa.subject_id = s.id
LEFT JOIN 
    stages st ON fa.stage_id = st.id
LEFT JOIN 
    teaching_blocks tb ON sa.teaching_block_id = tb.id
LEFT JOIN 
    grade_scales gs ON sa.grade_id = gs.id
GROUP BY 
    sa.student_id, 
    fa.subject_id,
    s.name,
    fa.stage_id,
    st.name,
    sa.teaching_block_id,
    tb.name;

-- View for Stage level averages (New view for the updated hierarchy)
CREATE OR REPLACE VIEW vw_student_stage_averages AS
SELECT 
    sa.student_id,
    fa.stage_id,
    st.name AS stage_name,
    sa.teaching_block_id,
    tb.name AS teaching_block_name,
    AVG(gs.numeric_value) AS average_grade
FROM 
    student_assessments sa
LEFT JOIN 
    content_points cp ON sa.content_point_id = cp.id
LEFT JOIN 
    content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
LEFT JOIN 
    focus_groups fg ON cg.focus_group_id = fg.id
LEFT JOIN 
    focus_areas fa ON fg.focus_area_id = fa.id
LEFT JOIN 
    stages st ON fa.stage_id = st.id
LEFT JOIN 
    teaching_blocks tb ON sa.teaching_block_id = tb.id
LEFT JOIN 
    grade_scales gs ON sa.grade_id = gs.id
GROUP BY 
    sa.student_id, 
    fa.stage_id,
    st.name,
    sa.teaching_block_id,
    tb.name;

-- View to see available content groups for marking in a specific teaching block for a class (Updated for new hierarchy)
CREATE OR REPLACE VIEW vw_class_teaching_block_content AS
SELECT 
    ccp.class_id,
    c.name AS class_name,
    ccp.teaching_block_id,
    tb.name AS teaching_block_name,
    tb.start_week,
    tb.end_week,
    ccp.content_group_id,
    cg.name AS content_group_name,
    fg.id AS focus_group_id,
    fg.name AS focus_group_name,
    fa.id AS focus_area_id,
    fa.name AS focus_area_name,
    fa.stage_id,
    st.name AS stage_name,
    fa.subject_id,
    s.name AS subject_name,
    ccp.is_completed,
    ccp.notes
FROM 
    class_curriculum_plans ccp
JOIN 
    classes c ON ccp.class_id = c.id
JOIN 
    teaching_blocks tb ON ccp.teaching_block_id = tb.id
JOIN 
    content_groups cg ON ccp.content_group_id = cg.id
JOIN 
    focus_groups fg ON cg.focus_group_id = fg.id
JOIN 
    focus_areas fa ON fg.focus_area_id = fa.id
JOIN 
    stages st ON fa.stage_id = st.id
JOIN 
    subjects s ON fa.subject_id = s.id;

-- View to see content points available for marking within planned content groups (Updated for new hierarchy)
CREATE OR REPLACE VIEW vw_class_teaching_block_content_points AS
SELECT 
    ccp.class_id,
    c.name AS class_name,
    ccp.teaching_block_id,
    tb.name AS teaching_block_name,
    ccp.content_group_id,
    cg.name AS content_group_name,
    cp.id AS content_point_id,
    cp.name AS content_point_name,
    fg.id AS focus_group_id,
    fg.name AS focus_group_name,
    fa.id AS focus_area_id,
    fa.name AS focus_area_name,
    fa.stage_id,
    st.name AS stage_name,
    fa.subject_id,
    s.name AS subject_name,
    ccp.is_completed
FROM 
    class_curriculum_plans ccp
JOIN 
    classes c ON ccp.class_id = c.id
JOIN 
    teaching_blocks tb ON ccp.teaching_block_id = tb.id
JOIN 
    content_groups cg ON ccp.content_group_id = cg.id
JOIN 
    content_points cp ON cg.id = cp.content_group_id
JOIN 
    focus_groups fg ON cg.focus_group_id = fg.id
JOIN 
    focus_areas fa ON fg.focus_area_id = fa.id
JOIN 
    stages st ON fa.stage_id = st.id
JOIN 
    subjects s ON fa.subject_id = s.id;

-- Function to get student grade average at any level (Updated for new hierarchy)
CREATE OR REPLACE FUNCTION get_student_average_grade(
    p_student_id UUID,
    p_level VARCHAR(50),  -- 'content_group', 'focus_group', 'focus_area', 'subject', 'stage'
    p_id UUID,            -- ID of the entity at the specified level
    p_teaching_block_id UUID DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
    avg_grade DECIMAL;
BEGIN
    IF p_level = 'content_group' THEN
        SELECT AVG(gs.numeric_value) INTO avg_grade
        FROM student_assessments sa
        JOIN grade_scales gs ON sa.grade_id = gs.id
        LEFT JOIN content_points cp ON sa.content_point_id = cp.id
        WHERE sa.student_id = p_student_id
        AND (sa.content_group_id = p_id OR cp.content_group_id = p_id)
        AND (p_teaching_block_id IS NULL OR sa.teaching_block_id = p_teaching_block_id);
    
    ELSIF p_level = 'focus_group' THEN
        SELECT AVG(gs.numeric_value) INTO avg_grade
        FROM student_assessments sa
        JOIN grade_scales gs ON sa.grade_id = gs.id
        LEFT JOIN content_points cp ON sa.content_point_id = cp.id
        LEFT JOIN content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
        WHERE sa.student_id = p_student_id
        AND cg.focus_group_id = p_id
        AND (p_teaching_block_id IS NULL OR sa.teaching_block_id = p_teaching_block_id);
    
    ELSIF p_level = 'focus_area' THEN
        SELECT AVG(gs.numeric_value) INTO avg_grade
        FROM student_assessments sa
        JOIN grade_scales gs ON sa.grade_id = gs.id
        LEFT JOIN content_points cp ON sa.content_point_id = cp.id
        LEFT JOIN content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
        LEFT JOIN focus_groups fg ON cg.focus_group_id = fg.id
        WHERE sa.student_id = p_student_id
        AND fg.focus_area_id = p_id
        AND (p_teaching_block_id IS NULL OR sa.teaching_block_id = p_teaching_block_id);
    
    ELSIF p_level = 'subject' THEN
        SELECT AVG(gs.numeric_value) INTO avg_grade
        FROM student_assessments sa
        JOIN grade_scales gs ON sa.grade_id = gs.id
        LEFT JOIN content_points cp ON sa.content_point_id = cp.id
        LEFT JOIN content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
        LEFT JOIN focus_groups fg ON cg.focus_group_id = fg.id
        LEFT JOIN focus_areas fa ON fg.focus_area_id = fa.id
        WHERE sa.student_id = p_student_id
        AND fa.subject_id = p_id
        AND (p_teaching_block_id IS NULL OR sa.teaching_block_id = p_teaching_block_id);
        
    ELSIF p_level = 'stage' THEN
        SELECT AVG(gs.numeric_value) INTO avg_grade
        FROM student_assessments sa
        JOIN grade_scales gs ON sa.grade_id = gs.id
        LEFT JOIN content_points cp ON sa.content_point_id = cp.id
        LEFT JOIN content_groups cg ON COALESCE(sa.content_group_id, cp.content_group_id) = cg.id
        LEFT JOIN focus_groups fg ON cg.focus_group_id = fg.id
        LEFT JOIN focus_areas fa ON fg.focus_area_id = fa.id
        WHERE sa.student_id = p_student_id
        AND fa.stage_id = p_id
        AND (p_teaching_block_id IS NULL OR sa.teaching_block_id = p_teaching_block_id);
    END IF;
    
    RETURN avg_grade;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a student has been assessed for all content in a teaching block
CREATE OR REPLACE FUNCTION check_student_block_completion(
    p_student_id UUID,
    p_teaching_block_id UUID,
    p_class_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    total_content_points INTEGER;
    assessed_content_points INTEGER;
    total_content_groups INTEGER;
    assessed_content_groups INTEGER;
    is_complete BOOLEAN;
BEGIN
    -- Count total content points in planned curriculum
    SELECT COUNT(cp.id) INTO total_content_points
    FROM class_curriculum_plans ccp
    JOIN content_groups cg ON ccp.content_group_id = cg.id
    JOIN content_points cp ON cg.id = cp.content_group_id
    WHERE ccp.class_id = p_class_id
    AND ccp.teaching_block_id = p_teaching_block_id;
    
    -- Count assessed content points
    SELECT COUNT(DISTINCT sa.content_point_id) INTO assessed_content_points
    FROM student_assessments sa
    WHERE sa.student_id = p_student_id
    AND sa.teaching_block_id = p_teaching_block_id
    AND sa.content_point_id IS NOT NULL;
    
    -- Count total content groups in planned curriculum
    SELECT COUNT(ccp.content_group_id) INTO total_content_groups
    FROM class_curriculum_plans ccp
    WHERE ccp.class_id = p_class_id
    AND ccp.teaching_block_id = p_teaching_block_id;
    
    -- Count assessed content groups
    SELECT COUNT(DISTINCT sa.content_group_id) INTO assessed_content_groups
    FROM student_assessments sa
    WHERE sa.student_id = p_student_id
    AND sa.teaching_block_id = p_teaching_block_id
    AND sa.content_group_id IS NOT NULL;
    
    -- Check if all content has been assessed (either at point or group level)
    -- A content group is considered assessed if either the group itself or all its points are assessed
    is_complete := (assessed_content_points = total_content_points) OR 
                  (assessed_content_groups = total_content_groups);
    
    RETURN is_complete;
END;
$$ LANGUAGE plpgsql;

-- Function to get all students in a class with their assessment completion status for a teaching block
CREATE OR REPLACE FUNCTION get_class_assessment_status(
    p_class_id UUID,
    p_teaching_block_id UUID
) RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    is_complete BOOLEAN,
    completion_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH student_list AS (
        SELECT 
            s.id,
            s.first_name || ' ' || s.last_name AS full_name
        FROM 
            students s
        JOIN 
            student_enrollments se ON s.id = se.student_id
        WHERE 
            se.class_id = p_class_id
            AND se.status = 'active'
    ),
    content_counts AS (
        SELECT
            COUNT(DISTINCT cp.id) AS total_points,
            COUNT(DISTINCT ccp.content_group_id) AS total_groups
        FROM 
            class_curriculum_plans ccp
        JOIN 
            content_groups cg ON ccp.content_group_id = cg.id
        LEFT JOIN 
            content_points cp ON cg.id = cp.content_group_id
        WHERE 
            ccp.class_id = p_class_id
            AND ccp.teaching_block_id = p_teaching_block_id
    ),
    student_assessments_count AS (
        SELECT
            sl.id AS student_id,
            COUNT(DISTINCT sa.content_point_id) AS assessed_points,
            COUNT(DISTINCT sa.content_group_id) AS assessed_groups
        FROM 
            student_list sl
        LEFT JOIN 
            student_assessments sa ON sl.id = sa.student_id
                AND sa.teaching_block_id = p_teaching_block_id
        GROUP BY 
            sl.id
    )
    SELECT
        sl.id,
        sl.full_name,
        CASE
            WHEN sac.assessed_points = cc.total_points OR sac.assessed_groups = cc.total_groups THEN TRUE
            ELSE FALSE
        END AS is_complete,
        CASE
            WHEN cc.total_points = 0 THEN 0
            ELSE ROUND(
                (COALESCE(sac.assessed_points, 0)::NUMERIC / NULLIF(cc.total_points, 0)::NUMERIC) * 100
                + (COALESCE(sac.assessed_groups, 0)::NUMERIC / NULLIF(cc.total_groups, 0)::NUMERIC) * 100
            ) / 2
        END AS completion_percentage
    FROM
        student_list sl
    CROSS JOIN
        content_counts cc
    LEFT JOIN
        student_assessments_count sac ON sl.id = sac.student_id
    ORDER BY
        sl.full_name;
END;
$$ LANGUAGE plpgsql;