'use server';

import { db } from '@/lib/db/drizzle';
import {
    studentAssessments,
    type NewStudentAssessment,
    type StudentAssessment,
} from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// --- Helper: Authorization Check (Placeholder) ---
// TODO: Implement proper check based on class ownership/teacher assignment
async function canUserGradeClass(userId: string, classId: number): Promise<boolean> {
    console.warn(`Authorization check skipped for grading in class ${classId} by user ${userId}`);
    return true; // Assume authorized for now
}

// --- Action Schemas ---

const saveAssessmentSchema = z.object({
    classId: z.coerce.number().int().positive(), // Needed for auth and revalidation path
    studentEnrollmentId: z.coerce.number().int().positive(),
    classCurriculumPlanId: z.coerce.number().int().positive(),
    contentGroupId: z.coerce.number().int().positive(),
    contentPointId: z.coerce.number().int().positive().optional().nullable(),
    gradeScaleId: z.coerce.number().int().positive(),
    notes: z.string().optional().nullable(),
    assessmentIdToUpdate: z.coerce.number().int().positive().optional().nullable(), // If updating existing
    weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
});

// --- Action Result Type ---
// Consider sharing this type if used elsewhere (e.g., planning actions)
interface GradingActionResult {
    error?: string | null;
    success?: boolean;
    savedAssessment?: StudentAssessment | null; // Return the saved/updated item
}

// --- Server Action: Save/Update Assessment ---

export async function saveAssessment(
    rawData: unknown
): Promise<GradingActionResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'User not authenticated' };

    const validatedFields = saveAssessmentSchema.safeParse(rawData);
    if (!validatedFields.success) {
        console.error('Invalid assessment data:', validatedFields.error.flatten());
        return { error: 'Invalid assessment data.' };
    }

    const {
        classId,
        studentEnrollmentId,
        classCurriculumPlanId,
        contentGroupId,
        contentPointId,
        gradeScaleId,
        notes,
        assessmentIdToUpdate,
        weekStartDate: weekStartDateString,
    } = validatedFields.data;

    // --- Authorization Check ---
    const authorized = await canUserGradeClass(user.id, classId);
    if (!authorized) return { error: 'User not authorized to grade this class.' };

    try {
        let savedAssessment: StudentAssessment;
        // Parse the week start date string into a UTC Date object
        const assessmentDate = new Date(`${weekStartDateString}T00:00:00Z`); 

        if (assessmentIdToUpdate) {
            // --- Update Existing Assessment ---
            const [updatedItem] = await db.update(studentAssessments)
                .set({
                    gradeScaleId: gradeScaleId,
                    notes: notes,
                    assessmentDate: assessmentDate, // Use parsed week start date
                    updatedAt: new Date(),
                })
                .where(eq(studentAssessments.id, assessmentIdToUpdate))
                .returning();
            
            if (!updatedItem) {
                return { error: 'Assessment not found for update.' };
            }
            savedAssessment = updatedItem;
            console.log('Assessment updated:', savedAssessment.id);

        } else {
            // --- Insert New Assessment ---
            const assessmentToInsert: NewStudentAssessment = {
                studentEnrollmentId,
                classCurriculumPlanId,
                contentGroupId,
                contentPointId,
                gradeScaleId,
                notes,
                assessmentDate: assessmentDate, // Use parsed week start date
                // createdAt, updatedAt will use defaults
            };

            const [newItem] = await db.insert(studentAssessments)
                                  .values(assessmentToInsert)
                                  .returning();
            savedAssessment = newItem;
            console.log('Assessment created:', savedAssessment.id);
        }

        // Revalidate the grading page path
        revalidatePath(`/dashboard/grading/${classId}`);
        return { success: true, error: null, savedAssessment };

    } catch (error: any) {
        console.error('Error saving assessment:', error);
        // Basic check for unique constraint violation
        if (error.message?.includes('student_assessment_unique_idx')) {
            return { error: 'An assessment already exists for this student and item. Update failed.' };
        }
        return { error: 'Failed to save assessment.' };
    }
} 