import { db } from '@/lib/db/drizzle'
import { classes, teamMembers, terms } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/server'
import { eq } from 'drizzle-orm'
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

    // Get classes for the user's team with related data
    const classesData = await db.query.classes.findMany({
      where: eq(classes.teamId, userTeamMembership.teamId),
      with: {
        // Get curriculum plan items for this class
        classCurriculumPlanItems: {
          limit: 1, // Just check if any exist
        },
      },
      orderBy: [classes.calendarYear, classes.name],
    })

    // Get terms for the team and calendar years
    const calendarYears = [...new Set(classesData.map(cls => cls.calendarYear))]
    const teamTerms = calendarYears.length > 0 
      ? await db.query.terms.findMany({
          where: eq(terms.teamId, userTeamMembership.teamId),
        })
      : []

    // Transform the data to include summary information for onboarding
    const classesWithProgress = classesData.map(cls => {
      // Get terms for this class's calendar year
      const classTerms = teamTerms.filter(term => term.calendarYear === cls.calendarYear)
      
      return {
        id: cls.id,
        name: cls.name,
        calendarYear: cls.calendarYear,
        isActive: cls.isActive,
        createdAt: cls.createdAt,
        // Onboarding progress indicators
        terms: classTerms,
        curriculumItems: cls.classCurriculumPlanItems || [],
        hasTerms: classTerms.length > 0,
        hasCurriculum: (cls.classCurriculumPlanItems || []).length > 0,
      }
    })

    return NextResponse.json(classesWithProgress)
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 