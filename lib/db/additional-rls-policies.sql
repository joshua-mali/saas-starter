-- =====================================================
-- Additional RLS Policies for Remaining Tables
-- =====================================================

-- =====================================================
-- USERS TABLE POLICIES (CRITICAL)
-- =====================================================
-- Note: This appears to be a separate users table from auth.users

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own record
CREATE POLICY "Users can view own record" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update their own record  
CREATE POLICY "Users can update own record" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Users can insert their own record during signup
CREATE POLICY "Users can insert own record" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- =====================================================
-- CURRICULUM CONTENT TABLES - READ-ONLY ACCESS
-- =====================================================
-- These are shared curriculum content that all authenticated users should be able to read

-- Enable RLS on curriculum tables
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_points ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STAGES TABLE POLICIES
-- =====================================================

-- All authenticated users can read stages
CREATE POLICY "Authenticated users can view stages" ON stages
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- SUBJECTS TABLE POLICIES  
-- =====================================================

-- All authenticated users can read subjects
CREATE POLICY "Authenticated users can view subjects" ON subjects
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- GRADE_SCALES TABLE POLICIES
-- =====================================================

-- All authenticated users can read grade scales
CREATE POLICY "Authenticated users can view grade scales" ON grade_scales
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- OUTCOMES TABLE POLICIES
-- =====================================================

-- All authenticated users can read outcomes
CREATE POLICY "Authenticated users can view outcomes" ON outcomes
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- FOCUS_AREAS TABLE POLICIES
-- =====================================================

-- All authenticated users can read focus areas
CREATE POLICY "Authenticated users can view focus areas" ON focus_areas
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- FOCUS_GROUPS TABLE POLICIES
-- =====================================================

-- All authenticated users can read focus groups
CREATE POLICY "Authenticated users can view focus groups" ON focus_groups
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- CONTENT_GROUPS TABLE POLICIES
-- =====================================================

-- All authenticated users can read content groups
CREATE POLICY "Authenticated users can view content groups" ON content_groups
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- CONTENT_POINTS TABLE POLICIES
-- =====================================================

-- All authenticated users can read content points
CREATE POLICY "Authenticated users can view content points" ON content_points
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is now enabled on all remaining tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'users', 'stages', 'subjects', 'grade_scales', 'outcomes',
  'focus_areas', 'focus_groups', 'content_groups', 'content_points'
);

-- Check policies were created for these tables
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
  'users', 'stages', 'subjects', 'grade_scales', 'outcomes',
  'focus_areas', 'focus_groups', 'content_groups', 'content_points'
)
ORDER BY tablename, policyname; 