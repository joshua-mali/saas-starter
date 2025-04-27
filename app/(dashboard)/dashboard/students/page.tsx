import { getTeacherClasses } from '@/app/actions/get-classes';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import StudentsPageClient from './client';

// Fetch classes for the current user/teacher to populate the dropdown
// async function getTeacherClasses(userId: string) {
//   const teacherClasses = await db
//     .select({
//       id: classes.id,
//       name: classes.name,
//       // Add other fields if needed by the client
//     })
//     .from(classes)
//     .innerJoin(classTeachers, eq(classes.id, classTeachers.classId))
//     .where(eq(classTeachers.teacherId, userId))
//     .orderBy(classes.name); // Order alphabetically
//
//   return teacherClasses;
// }

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect('/sign-in');
  }

  const userClasses = await getTeacherClasses(data.user.id);

  return <StudentsPageClient teacherClasses={userClasses} />;
} 