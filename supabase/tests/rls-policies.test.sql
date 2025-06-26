-- =====================================================
-- MALI-Ed RLS Policy Tests
-- =====================================================
-- Tests for Row Level Security policies using pgTAP
-- Based on Supabase testing best practices

begin;

-- Install pgTAP extension for testing
create extension if not exists pgtap with schema extensions;

-- Declare the number of tests we'll run
select plan(20);

-- =====================================================
-- TEST DATA SETUP
-- =====================================================

-- Create test users in auth.users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@school1.com'),
  ('22222222-2222-2222-2222-222222222222', 'teacher1@school1.com'),
  ('33333333-3333-3333-3333-333333333333', 'teacher2@school1.com'),
  ('44444444-4444-4444-4444-444444444444', 'admin@school2.com'),
  ('55555555-5555-5555-5555-555555555555', 'teacher@school2.com');

-- Create test teams (schools)
insert into teams (id, name, created_at, updated_at) values
  (1001, 'Test School 1', now(), now()),
  (1002, 'Test School 2', now(), now());

-- Create team memberships
insert into team_members (user_id, team_id, role, joined_at) values
  ('11111111-1111-1111-1111-111111111111', 1001, 'admin', now()),
  ('22222222-2222-2222-2222-222222222222', 1001, 'teacher', now()),
  ('33333333-3333-3333-3333-333333333333', 1001, 'teacher', now()),
  ('44444444-4444-4444-4444-444444444444', 1002, 'admin', now()),
  ('55555555-5555-5555-5555-555555555555', 1002, 'teacher', now());

-- Create test profiles
insert into profiles (id, full_name, email, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', 'Admin User 1', 'admin@school1.com', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'Teacher 1', 'teacher1@school1.com', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'Teacher 2', 'teacher2@school1.com', now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'Admin User 2', 'admin@school2.com', now(), now()),
  ('55555555-5555-5555-5555-555555555555', 'Teacher 3', 'teacher@school2.com', now(), now());

-- Create test classes
insert into classes (id, team_id, calendar_year, stage_id, name, is_active, created_at, updated_at) values
  (2001, 1001, 2024, 705, 'Class 1A School 1', true, now(), now()),
  (2002, 1001, 2024, 706, 'Class 2B School 1', true, now(), now()),
  (2003, 1002, 2024, 705, 'Class 1A School 2', true, now(), now());

-- Assign teachers to classes
insert into class_teachers (class_id, teacher_id, is_primary, created_at, updated_at) values
  (2001, '22222222-2222-2222-2222-222222222222', true, now(), now()),  -- Teacher 1 -> Class 1A School 1
  (2002, '33333333-3333-3333-3333-333333333333', true, now(), now()),  -- Teacher 2 -> Class 2B School 1
  (2003, '55555555-5555-5555-5555-555555555555', true, now(), now());  -- Teacher 3 -> Class 1A School 2

-- Create test students
insert into students (id, team_id, first_name, last_name, is_active, created_at, updated_at) values
  (3001, 1001, 'John', 'Doe', true, now(), now()),
  (3002, 1001, 'Jane', 'Smith', true, now(), now()),
  (3003, 1002, 'Bob', 'Johnson', true, now(), now());

-- =====================================================
-- PROFILE POLICIES TESTS
-- =====================================================

-- Test as School 1 Admin
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Test 1: User can view their own profile
select results_eq(
  'select count(*) from profiles where id = auth.uid()',
  ARRAY[1::bigint],
  'User can view their own profile'
);

-- Test 2: User cannot view other users profiles directly
select results_eq(
  'select count(*) from profiles where id != auth.uid()',
  ARRAY[0::bigint],
  'User cannot view other profiles directly'
);

-- =====================================================
-- TEAM ISOLATION TESTS
-- =====================================================

-- Test as School 1 Admin
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Test 3: Admin can see their team
select results_eq(
  'select count(*) from teams where id = (select auth.get_user_team_id())',
  ARRAY[1::bigint],
  'Admin can see their own team'
);

-- Test 4: Admin cannot see other teams
select results_eq(
  'select count(*) from teams where id != (select auth.get_user_team_id())',
  ARRAY[0::bigint],
  'Admin cannot see other teams'
);

-- =====================================================
-- STUDENT ACCESS TESTS
-- =====================================================

-- Test 5: School 1 admin can see all school 1 students
select results_eq(
  'select count(*) from students where team_id = (select auth.get_user_team_id())',
  ARRAY[2::bigint],
  'School 1 admin can see all school 1 students'
);

-- Test as School 1 Teacher 1 (only teaches Class 1A)
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- Test 6: Teacher can see students in their team
select results_eq(
  'select count(*) from students where team_id = (select auth.get_user_team_id())',
  ARRAY[2::bigint],
  'Teacher can see students in their team'
);

-- Test as School 2 Teacher
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

-- Test 7: School 2 teacher can see school 2 students only
select results_eq(
  'select count(*) from students where team_id = (select auth.get_user_team_id())',
  ARRAY[1::bigint],
  'School 2 teacher can see school 2 students only'
);

-- =====================================================
-- CLASS ACCESS TESTS
-- =====================================================

-- Test as School 1 Teacher 1
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- Test 8: Teacher can see classes in their team
select results_eq(
  'select count(*) from classes where team_id = (select auth.get_user_team_id())',
  ARRAY[2::bigint],
  'Teacher can see all classes in their team'
);

-- Test 9: Teacher can see their assigned classes via helper function
select results_eq(
  'select count(*) from unnest((select auth.get_user_class_ids())) as class_id',
  ARRAY[1::bigint],
  'Teacher can see their assigned class ID'
);

-- Test as School 2 Teacher
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

-- Test 10: School 2 teacher sees only school 2 classes
select results_eq(
  'select count(*) from classes where team_id = (select auth.get_user_team_id())',
  ARRAY[1::bigint],
  'School 2 teacher sees only school 2 classes'
);

-- =====================================================
-- ROLE-BASED ACCESS TESTS
-- =====================================================

-- Test as School 1 Admin
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Test 11: Admin role check works
select results_eq(
  'select auth.is_team_admin()',
  ARRAY[true],
  'Admin role is correctly identified'
);

-- Test as School 1 Teacher
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- Test 12: Teacher role check works
select results_eq(
  'select auth.is_team_admin()',
  ARRAY[false],
  'Teacher role is correctly identified as non-admin'
);

-- =====================================================
-- SECURITY VIOLATION TESTS
-- =====================================================

-- Test as School 1 Teacher trying to access School 2 data
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- Test 13: Cannot see other team's students
select results_eq(
  'select count(*) from students where team_id = 1002',
  ARRAY[0::bigint],
  'School 1 teacher cannot see School 2 students'
);

-- Test 14: Cannot see other team's classes
select results_eq(
  'select count(*) from classes where team_id = 1002',
  ARRAY[0::bigint],
  'School 1 teacher cannot see School 2 classes'
);

-- =====================================================
-- INSERT/UPDATE TESTS
-- =====================================================

-- Test as School 1 Admin
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Test 15: Admin can create student in their team
select lives_ok(
  $$insert into students (team_id, first_name, last_name) values ((select auth.get_user_team_id()), 'Test', 'Student')$$,
  'Admin can create student in their team'
);

-- Test as School 1 Teacher
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- Test 16: Teacher cannot create student (only admins can manage students)
select throws_ok(
  $$insert into students (team_id, first_name, last_name) values ((select auth.get_user_team_id()), 'Unauthorized', 'Student')$$,
  'Students can only be managed by team admins'
);

-- =====================================================
-- HELPER FUNCTION TESTS
-- =====================================================

-- Test as School 1 Teacher 1
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- Test 17: get_user_team_id returns correct team
select results_eq(
  'select auth.get_user_team_id()',
  ARRAY[1001],
  'get_user_team_id returns correct team for School 1 teacher'
);

-- Test 18: user_teaches_class function works correctly
select results_eq(
  'select auth.user_teaches_class(2001)',
  ARRAY[true],
  'user_teaches_class correctly identifies assigned class'
);

-- Test 19: user_teaches_class returns false for unassigned class
select results_eq(
  'select auth.user_teaches_class(2002)',
  ARRAY[false],
  'user_teaches_class correctly rejects unassigned class'
);

-- Test as unauthenticated (anonymous) user
set local role anon;

-- Test 20: Anonymous users cannot access protected data
select results_eq(
  'select count(*) from students',
  ARRAY[0::bigint],
  'Anonymous users cannot access student data'
);

-- Clean up and finish
select * from finish();

rollback; 