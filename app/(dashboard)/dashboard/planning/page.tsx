'use server';

import { db } from '@/lib/db/drizzle';
import { classTeachers } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function PlanningPage() {
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
    with: {
      class: true
    }
  });

  if (!primaryClass) {
    // If no primary class is found, redirect to classes page
    redirect('/dashboard/classes');
  }

  // Redirect to the planning page for their primary class
  redirect(`/dashboard/planning/${primaryClass.classId}`);
} 