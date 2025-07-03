import { db } from '@/lib/db/drizzle';
import { studentEnrollments, students } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import StudentsPageClient from './client';

// Define the type for the student data we select
type StudentListData = {
    enrollmentId: string;
    studentId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | null;
    externalId: string | null;
    isActive: boolean | null;
};

// Fetch students enrolled in a specific class
async function getStudentsForClass(classId: string): Promise<StudentListData[]> {
  return db.select({
      enrollmentId: studentEnrollments.id,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      dateOfBirth: students.dateOfBirth,
      externalId: students.externalId,
      isActive: students.isActive,
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

  let classId: string | null = null;
  let fetchedStudents: StudentListData[] = [];

  if (rawClassId) {
      // TODO: Add authorization check - can user view this class?
      classId = rawClassId; // Now expects UUID string
      fetchedStudents = await getStudentsForClass(classId);
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