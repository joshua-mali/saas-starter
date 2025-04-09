import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// TODO: Import necessary DB types and query functions
// import { db } from '@/lib/db/drizzle';
// import { classTeachers, studentEnrollments, students, classes, type Stage } from '@/lib/db/schema';
// import { and, eq } from 'drizzle-orm';

// TODO: Define Authorization check function (or import if shared)
// async function checkTeacherAuthorization(classId: number, userId: string): Promise<boolean> { ... }

interface StudentOverviewPageProps {
    params: {
        classId: string;
        studentId: string;
    };
}

export default async function StudentOverviewPage({
    params: { classId: rawClassId, studentId: rawStudentId }
}: StudentOverviewPageProps) {

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/sign-in');
    }

    const classId = parseInt(rawClassId, 10);
    const studentId = parseInt(rawStudentId, 10);

    // Temporarily comment out to test
    // if (isNaN(classId) || isNaN(studentId)) {
    //     notFound(); // Invalid parameters
    // }

    // --- Authorization Check ---
    // TODO: Implement checkTeacherAuthorization and uncomment below
    // const isAuthorized = await checkTeacherAuthorization(classId, user.id);
    // if (!isAuthorized) {
    //     notFound(); // User is not a teacher for this class
    // }

    // --- Fetch Basic Data (Placeholder) ---
    // TODO: Fetch student enrollment details using classId and studentId
    // const enrollment = await db.query.studentEnrollments.findFirst({ where: and(eq(studentEnrollments.classId, classId), eq(studentEnrollments.studentId, studentId)), with: { student: true } });
    // if (!enrollment) { notFound(); }

    // TODO: Fetch class details
    // const classData = await db.query.classes.findFirst({ where: eq(classes.id, classId), with: { stage: true } });
    // if (!classData) { notFound(); }

    console.log(`Loading overview for Class ID: ${classId}, Student ID: ${studentId}`);

    // --- Fetch Full Hierarchy and Assessments (To be implemented) ---
    // ...

    // --- Process Data (To be implemented) ---
    // ...

    // --- Pass to Client Component (To be implemented) ---
    // return <StudentOverviewClient student={enrollment.student} classData={classData} structuredGrades={...} />

    return (
        <div className="p-4">
            <h1 className="text-xl font-semibold mb-4">
                Student Overview (Placeholder)
            </h1>
            <p>Class ID: {classId}</p>
            <p>Student ID: {studentId}</p>
            {/* Placeholder for Client Component */}
        </div>
    );
}