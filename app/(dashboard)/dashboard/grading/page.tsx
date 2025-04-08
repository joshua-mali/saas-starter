'use server';

import { db } from '@/lib/db/drizzle';
import { classTeachers } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

/**
 * Redirects the user to the grading page for their primary class.
 */
export default async function GradingRedirectPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  // Find the user's primary class
  const primaryClass = await db.query.classTeachers.findFirst({
    where: and(
      eq(classTeachers.teacherId, user.id),
      eq(classTeachers.isPrimary, true)
    ),
    // Select only the classId needed for the redirect
    columns: {
      classId: true,
    },
  });

  if (!primaryClass) {
    // TODO: Add a more user-friendly message or page here
    console.error(`User ${user.id} has no primary class assigned.`);
    // For now, redirect to classes page
    redirect('/dashboard/classes?error=no_primary_class');
  }

  // Redirect to the grading page for their primary class
  redirect(`/dashboard/grading/${primaryClass.classId}`);
} 