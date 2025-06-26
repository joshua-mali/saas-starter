-- =====================================================
-- MALI-Ed Row Level Security (RLS) Policies - FIXED
-- =====================================================
-- This file contains all RLS policies for securing the MALI-Ed application
-- Based on team-based multi-tenancy with role-based access control
-- FIXED: Uses public schema instead of auth schema to avoid permission errors

-- =====================================================
-- UTILITY FUNCTIONS FOR RLS (in public schema)
-- =====================================================

-- Function to get current user's team ID
CREATE OR REPLACE FUNCTION public.get_user_team_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is team admin/owner
CREATE OR REPLACE FUNCTION public.is_team_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user teaches a specific class
CREATE OR REPLACE FUNCTION public.user_teaches_class(class_id_param INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM class_teachers 
    WHERE teacher_id = auth.uid() 
    AND class_id = class_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's taught class IDs
CREATE OR REPLACE FUNCTION public.get_user_class_ids()
RETURNS INTEGER[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT class_id 
    FROM class_teachers 
    WHERE teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

-- Core user and team tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Educational structure tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_curriculum_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_assessments ENABLE ROW LEVEL SECURITY;

-- Note: Curriculum content tables (stages, subjects, outcomes, etc.) are typically
-- global/shared data and may not need RLS unless you have school-specific content

-- =====================================================
-- PROFILES TABLE POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- =====================================================
-- TEAMS TABLE POLICIES
-- =====================================================

-- Team members can view their team
CREATE POLICY "Team members can view their team" ON teams
  FOR SELECT USING (
    id = (SELECT public.get_user_team_id())
  );

-- Team admins can update team details
CREATE POLICY "Team admins can update team" ON teams
  FOR UPDATE USING (
    id = (SELECT public.get_user_team_id()) 
    AND (SELECT public.is_team_admin())
  );

-- Authenticated users can create teams (during signup/onboarding)
CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =====================================================
-- TEAM_MEMBERS TABLE POLICIES
-- =====================================================

-- Team members can view other team members
CREATE POLICY "Team members can view team members" ON team_members
  FOR SELECT USING (
    team_id = (SELECT public.get_user_team_id())
  );

-- Team admins can manage team members
CREATE POLICY "Team admins can manage team members" ON team_members
  FOR ALL USING (
    team_id = (SELECT public.get_user_team_id()) 
    AND (SELECT public.is_team_admin())
  );

-- Users can insert themselves when accepting invitations
CREATE POLICY "Users can join team via invitation" ON team_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- =====================================================
-- ACTIVITY_LOGS TABLE POLICIES
-- =====================================================

-- Team members can view team activity logs
CREATE POLICY "Team members can view activity logs" ON activity_logs
  FOR SELECT USING (
    team_id = (SELECT public.get_user_team_id())
  );

-- System can insert activity logs
CREATE POLICY "System can insert activity logs" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id = (SELECT public.get_user_team_id())
  );

-- =====================================================
-- INVITATIONS TABLE POLICIES
-- =====================================================

-- Team admins can view and manage invitations for their team
CREATE POLICY "Team admins can manage invitations" ON invitations
  FOR ALL USING (
    team_id = (SELECT public.get_user_team_id()) 
    AND (SELECT public.is_team_admin())
  );

-- Anyone can view invitations they were sent (by email)
CREATE POLICY "Users can view their invitations" ON invitations
  FOR SELECT USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- =====================================================
-- CLASSES TABLE POLICIES
-- =====================================================

-- Team members can view classes in their team
CREATE POLICY "Team members can view team classes" ON classes
  FOR SELECT USING (
    team_id = (SELECT public.get_user_team_id())
  );

-- Team admins can manage all team classes
CREATE POLICY "Team admins can manage classes" ON classes
  FOR ALL USING (
    team_id = (SELECT public.get_user_team_id()) 
    AND (SELECT public.is_team_admin())
  );

-- Teachers can update classes they teach
CREATE POLICY "Teachers can update their classes" ON classes
  FOR UPDATE USING (
    team_id = (SELECT public.get_user_team_id()) 
    AND id IN (
      SELECT unnest(public.get_user_class_ids())
    )
  );

-- =====================================================
-- STUDENTS TABLE POLICIES
-- =====================================================

-- Team members can view students in their team
CREATE POLICY "Team members can view team students" ON students
  FOR SELECT USING (
    team_id = (SELECT public.get_user_team_id())
  );

-- Team admins can manage all team students
CREATE POLICY "Team admins can manage students" ON students
  FOR ALL USING (
    team_id = (SELECT public.get_user_team_id()) 
    AND (SELECT public.is_team_admin())
  );

-- Teachers can view students in their classes
CREATE POLICY "Teachers can view their students" ON students
  FOR SELECT USING (
    team_id = (SELECT public.get_user_team_id()) 
    AND id IN (
      SELECT student_id 
      FROM student_enrollments 
      WHERE class_id IN (
        SELECT unnest(public.get_user_class_ids())
      )
    )
  );

-- =====================================================
-- CLASS_TEACHERS TABLE POLICIES
-- =====================================================

-- Team members can view class teacher assignments
CREATE POLICY "Team members can view class teachers" ON class_teachers
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT public.get_user_team_id())
    )
  );

-- Team admins can manage class teacher assignments
CREATE POLICY "Team admins can manage class teachers" ON class_teachers
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT public.get_user_team_id())
    ) 
    AND (SELECT public.is_team_admin())
  );

-- =====================================================
-- STUDENT_ENROLLMENTS TABLE POLICIES
-- =====================================================

-- Team members can view enrollments in their team
CREATE POLICY "Team members can view enrollments" ON student_enrollments
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT public.get_user_team_id())
    )
  );

-- Team admins can manage enrollments
CREATE POLICY "Team admins can manage enrollments" ON student_enrollments
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT public.get_user_team_id())
    ) 
    AND (SELECT public.is_team_admin())
  );

-- Teachers can view enrollments for their classes
CREATE POLICY "Teachers can view their class enrollments" ON student_enrollments
  FOR SELECT USING (
    class_id IN (
      SELECT unnest(public.get_user_class_ids())
    )
  );

-- =====================================================
-- TERMS TABLE POLICIES
-- =====================================================

-- Team members can view terms in their team
CREATE POLICY "Team members can view team terms" ON terms
  FOR SELECT USING (
    team_id = (SELECT public.get_user_team_id())
  );

-- Team admins can manage terms
CREATE POLICY "Team admins can manage terms" ON terms
  FOR ALL USING (
    team_id = (SELECT public.get_user_team_id()) 
    AND (SELECT public.is_team_admin())
  );

-- =====================================================
-- CLASS_CURRICULUM_PLAN TABLE POLICIES
-- =====================================================

-- Team members can view curriculum plans for their team's classes
CREATE POLICY "Team members can view curriculum plans" ON class_curriculum_plan
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT public.get_user_team_id())
    )
  );

-- Team admins can manage curriculum plans
CREATE POLICY "Team admins can manage curriculum plans" ON class_curriculum_plan
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT public.get_user_team_id())
    ) 
    AND (SELECT public.is_team_admin())
  );

-- Teachers can manage curriculum plans for their classes
CREATE POLICY "Teachers can manage their curriculum plans" ON class_curriculum_plan
  FOR ALL USING (
    class_id IN (
      SELECT unnest(public.get_user_class_ids())
    )
  );

-- =====================================================
-- STUDENT_ASSESSMENTS TABLE POLICIES
-- =====================================================

-- Team members can view assessments for their team's students
CREATE POLICY "Team members can view student assessments" ON student_assessments
  FOR SELECT USING (
    student_enrollment_id IN (
      SELECT se.id 
      FROM student_enrollments se
      JOIN students s ON se.student_id = s.id
      WHERE s.team_id = (SELECT public.get_user_team_id())
    )
  );

-- Team admins can manage all assessments in their team
CREATE POLICY "Team admins can manage assessments" ON student_assessments
  FOR ALL USING (
    student_enrollment_id IN (
      SELECT se.id 
      FROM student_enrollments se
      JOIN students s ON se.student_id = s.id
      WHERE s.team_id = (SELECT public.get_user_team_id())
    ) 
    AND (SELECT public.is_team_admin())
  );

-- Teachers can manage assessments for students in their classes
CREATE POLICY "Teachers can manage their student assessments" ON student_assessments
  FOR ALL USING (
    student_enrollment_id IN (
      SELECT id 
      FROM student_enrollments 
      WHERE class_id IN (
        SELECT unnest(public.get_user_class_ids())
      )
    )
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after applying policies to verify everything works

-- Check if RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'profiles', 'teams', 'team_members', 'activity_logs', 'invitations',
  'classes', 'students', 'class_teachers', 'student_enrollments', 
  'terms', 'class_curriculum_plan', 'student_assessments'
);

-- Check if helper functions were created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'get_user_team_id', 'is_team_admin', 'user_teaches_class', 'get_user_class_ids'
);

-- Check policies created
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname; 