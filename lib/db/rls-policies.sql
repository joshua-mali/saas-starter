-- =====================================================
-- MALI-Ed Row Level Security (RLS) Policies
-- =====================================================
-- This file contains all RLS policies for securing the MALI-Ed application
-- Based on team-based multi-tenancy with role-based access control

-- =====================================================
-- UTILITY FUNCTIONS FOR RLS
-- =====================================================

-- Function to get current user's team ID
CREATE OR REPLACE FUNCTION auth.get_user_team_id()
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
CREATE OR REPLACE FUNCTION auth.is_team_admin()
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
CREATE OR REPLACE FUNCTION auth.user_teaches_class(class_id_param INTEGER)
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
CREATE OR REPLACE FUNCTION auth.get_user_class_ids()
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
    id = (SELECT auth.get_user_team_id())
  );

-- Team admins can update team details
CREATE POLICY "Team admins can update team" ON teams
  FOR UPDATE USING (
    id = (SELECT auth.get_user_team_id()) 
    AND (SELECT auth.is_team_admin())
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
    team_id = (SELECT auth.get_user_team_id())
  );

-- Team admins can manage team members
CREATE POLICY "Team admins can manage team members" ON team_members
  FOR ALL USING (
    team_id = (SELECT auth.get_user_team_id()) 
    AND (SELECT auth.is_team_admin())
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
    team_id = (SELECT auth.get_user_team_id())
  );

-- System can insert activity logs
CREATE POLICY "System can insert activity logs" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id = (SELECT auth.get_user_team_id())
  );

-- =====================================================
-- INVITATIONS TABLE POLICIES
-- =====================================================

-- Team admins can view and manage invitations for their team
CREATE POLICY "Team admins can manage invitations" ON invitations
  FOR ALL USING (
    team_id = (SELECT auth.get_user_team_id()) 
    AND (SELECT auth.is_team_admin())
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
    team_id = (SELECT auth.get_user_team_id())
  );

-- Team admins can manage all team classes
CREATE POLICY "Team admins can manage classes" ON classes
  FOR ALL USING (
    team_id = (SELECT auth.get_user_team_id()) 
    AND (SELECT auth.is_team_admin())
  );

-- Teachers can update classes they teach
CREATE POLICY "Teachers can update their classes" ON classes
  FOR UPDATE USING (
    team_id = (SELECT auth.get_user_team_id()) 
    AND id = ANY(SELECT auth.get_user_class_ids())
  );

-- =====================================================
-- STUDENTS TABLE POLICIES
-- =====================================================

-- Team members can view students in their team
CREATE POLICY "Team members can view team students" ON students
  FOR SELECT USING (
    team_id = (SELECT auth.get_user_team_id())
  );

-- Team admins can manage all team students
CREATE POLICY "Team admins can manage students" ON students
  FOR ALL USING (
    team_id = (SELECT auth.get_user_team_id()) 
    AND (SELECT auth.is_team_admin())
  );

-- Teachers can view students in their classes
CREATE POLICY "Teachers can view their students" ON students
  FOR SELECT USING (
    team_id = (SELECT auth.get_user_team_id()) 
    AND id IN (
      SELECT student_id 
      FROM student_enrollments 
      WHERE class_id = ANY(SELECT auth.get_user_class_ids())
    )
  );

-- =====================================================
-- CLASS_TEACHERS TABLE POLICIES
-- =====================================================

-- Team members can view class teacher assignments
CREATE POLICY "Team members can view class teachers" ON class_teachers
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
    )
  );

-- Team admins can manage class teacher assignments
CREATE POLICY "Team admins can manage class teachers" ON class_teachers
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
    ) 
    AND (SELECT auth.is_team_admin())
  );

-- =====================================================
-- STUDENT_ENROLLMENTS TABLE POLICIES
-- =====================================================

-- Team members can view enrollments for their team's classes
CREATE POLICY "Team members can view enrollments" ON student_enrollments
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
    )
  );

-- Team admins can manage all enrollments
CREATE POLICY "Team admins can manage enrollments" ON student_enrollments
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
    ) 
    AND (SELECT auth.is_team_admin())
  );

-- Teachers can view enrollments for their classes
CREATE POLICY "Teachers can view their class enrollments" ON student_enrollments
  FOR SELECT USING (
    class_id = ANY(SELECT auth.get_user_class_ids())
  );

-- =====================================================
-- TERMS TABLE POLICIES
-- =====================================================

-- Team members can view their team's terms
CREATE POLICY "Team members can view team terms" ON terms
  FOR SELECT USING (
    team_id = (SELECT auth.get_user_team_id())
  );

-- Team admins can manage terms
CREATE POLICY "Team admins can manage terms" ON terms
  FOR ALL USING (
    team_id = (SELECT auth.get_user_team_id()) 
    AND (SELECT auth.is_team_admin())
  );

-- =====================================================
-- CLASS_CURRICULUM_PLAN TABLE POLICIES
-- =====================================================

-- Team members can view curriculum plans for their team's classes
CREATE POLICY "Team members can view curriculum plans" ON class_curriculum_plan
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
    )
  );

-- Team admins can manage all curriculum plans
CREATE POLICY "Team admins can manage curriculum plans" ON class_curriculum_plan
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
    ) 
    AND (SELECT auth.is_team_admin())
  );

-- Teachers can manage curriculum plans for their classes
CREATE POLICY "Teachers can manage their curriculum plans" ON class_curriculum_plan
  FOR ALL USING (
    class_id = ANY(SELECT auth.get_user_class_ids())
  );

-- =====================================================
-- STUDENT_ASSESSMENTS TABLE POLICIES
-- =====================================================

-- Team members can view assessments for their team's students
CREATE POLICY "Team members can view assessments" ON student_assessments
  FOR SELECT USING (
    class_curriculum_plan_id IN (
      SELECT id FROM class_curriculum_plan 
      WHERE class_id IN (
        SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
      )
    )
  );

-- Team admins can manage all assessments
CREATE POLICY "Team admins can manage assessments" ON student_assessments
  FOR ALL USING (
    class_curriculum_plan_id IN (
      SELECT id FROM class_curriculum_plan 
      WHERE class_id IN (
        SELECT id FROM classes WHERE team_id = (SELECT auth.get_user_team_id())
      )
    ) 
    AND (SELECT auth.is_team_admin())
  );

-- Teachers can manage assessments for their classes
CREATE POLICY "Teachers can manage their assessments" ON student_assessments
  FOR ALL USING (
    class_curriculum_plan_id IN (
      SELECT id FROM class_curriculum_plan 
      WHERE class_id = ANY(SELECT auth.get_user_class_ids())
    )
  );

-- =====================================================
-- GLOBAL/SHARED DATA TABLES
-- =====================================================
-- These tables contain curriculum content that's typically shared
-- across all teams. You may want to keep these without RLS
-- unless you need school-specific curriculum content.

-- If you need to enable RLS on curriculum tables, uncomment below:

/*
-- STAGES, SUBJECTS, OUTCOMES, etc. - Global read access
CREATE POLICY "Anyone can read curriculum content" ON stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read curriculum content" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read curriculum content" ON outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read curriculum content" ON focus_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read curriculum content" ON focus_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read curriculum content" ON content_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read curriculum content" ON content_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read curriculum content" ON grade_scales FOR SELECT TO authenticated USING (true);
*/

-- =====================================================
-- ADDITIONAL SECURITY NOTES
-- =====================================================

-- 1. Make sure to test these policies thoroughly in your development environment
-- 2. Consider adding policies for any new tables you add
-- 3. Monitor query performance - complex policies can slow down queries
-- 4. Use the security definer functions for better performance (already implemented above)
-- 5. Consider adding audit triggers for sensitive operations
-- 6. Regularly review and update policies as your application evolves

-- =====================================================
-- APPLYING THE POLICIES
-- =====================================================

-- To apply these policies:
-- 1. Run this SQL file against your Supabase database
-- 2. Test with different user roles and scenarios
-- 3. Monitor the Supabase logs for any RLS policy violations
-- 4. Update your application code to handle any access denied errors gracefully 