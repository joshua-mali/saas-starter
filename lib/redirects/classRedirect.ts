import { db } from '@/lib/db/drizzle';
import { classTeachers } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export async function redirectToClassPage(destination: 'grading' | 'planning') {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
  
    if (error || !user) {
      redirect('/sign-in');
    }
  
    const primaryClass = await db.query.classTeachers.findFirst({
      where: and(
        eq(classTeachers.teacherId, user.id),
        eq(classTeachers.isPrimary, true)
      ),
      columns: { classId: true }
    });
  
    if (!primaryClass) {
      redirect(`/dashboard/classes?error=no_primary_class`);
    }
  
    redirect(`/dashboard/${destination}/${primaryClass.classId}`);
  }
  