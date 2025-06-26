/**
 * MALI-Ed RLS Integration Tests
 * Tests Row Level Security policies through the application layer
 * Based on Supabase application-level testing best practices
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('MALI-Ed RLS Integration Tests', () => {
  // Generate unique IDs for this test suite to avoid conflicts
  const ADMIN_1_ID = crypto.randomUUID()
  const TEACHER_1_ID = crypto.randomUUID()
  const TEACHER_2_ID = crypto.randomUUID()
  const ADMIN_2_ID = crypto.randomUUID()
  
  const TEAM_1_ID = Math.floor(Math.random() * 10000) + 20000
  const TEAM_2_ID = Math.floor(Math.random() * 10000) + 30000
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  beforeAll(async () => {
    // Setup test data with unique IDs
    console.log('🏗️ Setting up test data...')

    // Create test users
    await adminSupabase.auth.admin.createUser({
      id: ADMIN_1_ID,
      email: `admin1-${ADMIN_1_ID}@test.com`,
      password: 'password123',
      email_confirm: true,
    })

    await adminSupabase.auth.admin.createUser({
      id: TEACHER_1_ID,
      email: `teacher1-${TEACHER_1_ID}@test.com`,
      password: 'password123',
      email_confirm: true,
    })

    await adminSupabase.auth.admin.createUser({
      id: TEACHER_2_ID,
      email: `teacher2-${TEACHER_2_ID}@test.com`,
      password: 'password123',
      email_confirm: true,
    })

    await adminSupabase.auth.admin.createUser({
      id: ADMIN_2_ID,
      email: `admin2-${ADMIN_2_ID}@test.com`,
      password: 'password123',
      email_confirm: true,
    })

    // Create test teams
    await adminSupabase.from('teams').insert([
      { id: TEAM_1_ID, name: `Test School 1 - ${TEAM_1_ID}` },
      { id: TEAM_2_ID, name: `Test School 2 - ${TEAM_2_ID}` },
    ])

    // Create team memberships
    await adminSupabase.from('team_members').insert([
      { user_id: ADMIN_1_ID, team_id: TEAM_1_ID, role: 'admin' },
      { user_id: TEACHER_1_ID, team_id: TEAM_1_ID, role: 'teacher' },
      { user_id: TEACHER_2_ID, team_id: TEAM_1_ID, role: 'teacher' },
      { user_id: ADMIN_2_ID, team_id: TEAM_2_ID, role: 'admin' },
    ])

    // Create test classes
    const { data: classes } = await adminSupabase.from('classes').insert([
      { team_id: TEAM_1_ID, calendar_year: 2024, stage_id: 705, name: `Class 1A - ${TEAM_1_ID}` },
      { team_id: TEAM_1_ID, calendar_year: 2024, stage_id: 706, name: `Class 2B - ${TEAM_1_ID}` },
      { team_id: TEAM_2_ID, calendar_year: 2024, stage_id: 705, name: `Class 1A - ${TEAM_2_ID}` },
    ]).select()

    if (classes && classes.length >= 3) {
      // Assign teachers to classes
      await adminSupabase.from('class_teachers').insert([
        { class_id: classes[0].id, teacher_id: TEACHER_1_ID, is_primary: true },
        { class_id: classes[1].id, teacher_id: TEACHER_2_ID, is_primary: true },
      ])
    }

    // Create test students
    await adminSupabase.from('students').insert([
      { team_id: TEAM_1_ID, first_name: 'John', last_name: 'Doe' },
      { team_id: TEAM_1_ID, first_name: 'Jane', last_name: 'Smith' },
      { team_id: TEAM_2_ID, first_name: 'Bob', last_name: 'Johnson' },
    ])

    console.log('✅ Test data setup complete')
  })

  afterAll(async () => {
    // Cleanup test users
    console.log('🧹 Cleaning up test data...')
    await adminSupabase.auth.admin.deleteUser(ADMIN_1_ID)
    await adminSupabase.auth.admin.deleteUser(TEACHER_1_ID)
    await adminSupabase.auth.admin.deleteUser(TEACHER_2_ID)
    await adminSupabase.auth.admin.deleteUser(ADMIN_2_ID)
    console.log('✅ Cleanup complete')
  })

  describe('Team Isolation', () => {
    it('should allow Team 1 admin to see only Team 1 data', async () => {
      await supabase.auth.signInWithPassword({
        email: `admin1-${ADMIN_1_ID}@test.com`,
        password: 'password123',
      })

      // Should see own team
      const { data: teams } = await supabase.from('teams').select('*')
      expect(teams).toHaveLength(1)
      expect(teams?.[0].id).toBe(TEAM_1_ID)

      // Should see own team's students
      const { data: students } = await supabase.from('students').select('*')
      expect(students).toHaveLength(2)
      students?.forEach(student => {
        expect(student.team_id).toBe(TEAM_1_ID)
      })

      // Should see own team's classes
      const { data: classes } = await supabase.from('classes').select('*')
      expect(classes).toHaveLength(2)
      classes?.forEach(classItem => {
        expect(classItem.team_id).toBe(TEAM_1_ID)
      })
    })

    it('should allow Team 2 admin to see only Team 2 data', async () => {
      await supabase.auth.signInWithPassword({
        email: `admin2-${ADMIN_2_ID}@test.com`,
        password: 'password123',
      })

      // Should see own team
      const { data: teams } = await supabase.from('teams').select('*')
      expect(teams).toHaveLength(1)
      expect(teams?.[0].id).toBe(TEAM_2_ID)

      // Should see own team's students
      const { data: students } = await supabase.from('students').select('*')
      expect(students).toHaveLength(1)
      expect(students?.[0].team_id).toBe(TEAM_2_ID)

      // Should see own team's classes
      const { data: classes } = await supabase.from('classes').select('*')
      expect(classes).toHaveLength(1)
      expect(classes?.[0].team_id).toBe(TEAM_2_ID)
    })
  })

  describe('Role-Based Access', () => {
    it('should allow teacher to view team data but restrict modifications', async () => {
      await supabase.auth.signInWithPassword({
        email: `teacher1-${TEACHER_1_ID}@test.com`,
        password: 'password123',
      })

      // Teacher can view team students
      const { data: students } = await supabase.from('students').select('*')
      expect(students).toHaveLength(2)

      // Teacher can view team classes
      const { data: classes } = await supabase.from('classes').select('*')
      expect(classes).toHaveLength(2)

      // Teacher cannot create students (admin-only operation)
      const { error } = await supabase.from('students').insert({
        team_id: TEAM_1_ID,
        first_name: 'Unauthorized',
        last_name: 'Student'
      })
      expect(error).toBeTruthy()
    })

    it('should allow admin to manage all team data', async () => {
      await supabase.auth.signInWithPassword({
        email: `admin1-${ADMIN_1_ID}@test.com`,
        password: 'password123',
      })

      // Admin can create students
      const { error } = await supabase.from('students').insert({
        team_id: TEAM_1_ID,
        first_name: 'Test',
        last_name: 'Student'
      })
      expect(error).toBeNull()

      // Verify student was created
      const { data: students } = await supabase.from('students').select('*')
      expect(students).toHaveLength(3) // 2 original + 1 created
    })
  })

  describe('Profile Access', () => {
    it('should allow users to view only their own profile', async () => {
      await supabase.auth.signInWithPassword({
        email: `teacher1-${TEACHER_1_ID}@test.com`,
        password: 'password123',
      })

      const { data: profiles } = await supabase.from('profiles').select('*')
      
      // Should only see own profile
      expect(profiles).toHaveLength(1)
      expect(profiles?.[0].id).toBe(TEACHER_1_ID)
    })
  })

  describe('Anonymous User Access', () => {
    it('should prevent anonymous users from accessing protected data', async () => {
      // Sign out to become anonymous
      await supabase.auth.signOut()

      // Should not be able to access any protected data
      const { data: students, error: studentsError } = await supabase.from('students').select('*')
      expect(students).toHaveLength(0)

      const { data: classes, error: classesError } = await supabase.from('classes').select('*')
      expect(classes).toHaveLength(0)

      const { data: teams, error: teamsError } = await supabase.from('teams').select('*')
      expect(teams).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle RLS policy violations gracefully', async () => {
      await supabase.auth.signInWithPassword({
        email: `teacher1-${TEACHER_1_ID}@test.com`,
        password: 'password123',
      })

      // Try to directly query data that should be filtered by RLS
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('team_id', TEAM_2_ID) // Trying to access Team 2 data as Team 1 user

      // Should return empty result, not an error (RLS filters silently)
      expect(data).toHaveLength(0)
      expect(error).toBeNull()
    })
  })

  describe('Class Teacher Assignment', () => {
    it('should respect teacher-class assignments', async () => {
      await supabase.auth.signInWithPassword({
        email: `teacher1-${TEACHER_1_ID}@test.com`,
        password: 'password123',
      })

      // Teacher should see class assignments
      const { data: classTeachers } = await supabase
        .from('class_teachers')
        .select('*')
      
      // Should see their own assignment
      expect(classTeachers?.some(ct => ct.teacher_id === TEACHER_1_ID)).toBe(true)
    })
  })

  describe('Data Consistency', () => {
    it('should maintain data consistency across related tables', async () => {
      await supabase.auth.signInWithPassword({
        email: `admin1-${ADMIN_1_ID}@test.com`,
        password: 'password123',
      })

      // Get classes
      const { data: classes } = await supabase.from('classes').select('*')
      
      // Get class teachers for those classes
      const { data: classTeachers } = await supabase
        .from('class_teachers')
        .select('*')
        .in('class_id', classes?.map(c => c.id) || [])

      // All class teachers should belong to classes in the same team
      const classIds = classes?.map(c => c.id) || []
      classTeachers?.forEach(ct => {
        expect(classIds).toContain(ct.class_id)
      })
    })
  })
}) 