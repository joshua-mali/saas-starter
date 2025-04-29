import { db } from '@/lib/db/drizzle';
import { studentEnrollments, students } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import StudentsPageClient from './client';

// Define the type for the student data we select
type StudentListData = {
    enrollmentId: number;
    studentId: number;
    firstName: string;
    lastName: string;
};

// Fetch students enrolled in a specific class
async function getStudentsForClass(classId: number): Promise<StudentListData[]> {
  return db.select({
      enrollmentId: studentEnrollments.id,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      // Add other student fields if needed by the client
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .where(eq(studentEnrollments.classId, classId))
    .orderBy(students.lastName, students.firstName); 
}

interface StudentsPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StudentsPage({ searchParams: searchParamsPromise }: StudentsPageProps) {
  const searchParams = await searchParamsPromise;
  const rawClassId = Array.isArray(searchParams.classId) ? searchParams.classId[0] : searchParams.classId;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  let classId: number | null = null;
  let fetchedStudents: StudentListData[] = [];

  if (rawClassId) {
      const parsedId = parseInt(rawClassId, 10);
      if (!isNaN(parsedId)) {
          // TODO: Add authorization check - can user view this class?
          classId = parsedId;
          fetchedStudents = await getStudentsForClass(classId);
      }
  }

  // We might still need the list of classes for the global selector state, 
  // but the page itself now depends on the selected classId.
  // const userClasses = await getTeacherClasses(user.id);

  return <StudentsPageClient 
           currentClassId={classId} // Pass the selected class ID (or null)
           students={fetchedStudents} // Pass the fetched students (now typed)
           // teacherClasses={userClasses} // No longer needed for local dropdown
          />;
} 