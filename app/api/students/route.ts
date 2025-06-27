import { db } from '@/lib/db/drizzle'
import { classes, studentEnrollments, students, teamMembers } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's team ID first
    const userTeamMembership = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, user.id),
      columns: { teamId: true }
    })

    if (!userTeamMembership) {
      return NextResponse.json({ error: 'User not associated with any team' }, { status: 403 })
    }

    // Get students from classes that belong to the user's team
    // This ensures teachers only see students from their team's classes
    const studentsData = await db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        classId: classes.id,
        className: classes.name,
      })
      .from(students)
      .innerJoin(studentEnrollments, eq(students.id, studentEnrollments.studentId))
      .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
      .where(
        and(
          eq(students.teamId, userTeamMembership.teamId),
          eq(classes.teamId, userTeamMembership.teamId)
        )
      )
      .orderBy(students.lastName, students.firstName)

    return NextResponse.json(studentsData)
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 