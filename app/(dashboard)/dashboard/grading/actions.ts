'use server';

import { db } from '@/lib/db/drizzle';
import {
    studentAssessments,
    type NewStudentAssessment,
    type StudentAssessment,
} from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// --- Helper: Authorization Check (Placeholder) ---
// TODO: Implement proper check based on class ownership/teacher assignment
async function canUserGradeClass(userId: string, classId: string): Promise<boolean> {
    console.warn(`Authorization check skipped for grading in class ${classId} by user ${userId}`);
    return true; // Assume authorized for now
}

// --- Action Schemas ---

const saveAssessmentSchema = z.object({
    classId: z.string().uuid(), // UUID string for class ID
    studentEnrollmentId: z.string().uuid(), // UUID string for enrollment ID
    classCurriculumPlanId: z.string().uuid(), // UUID string for plan ID  
    contentGroupId: z.coerce.number().int().positive(),
    contentPointId: z.coerce.number().int().positive().optional().nullable(),
    gradeScaleId: z.coerce.number().int().positive(),
    notes: z.string().optional().nullable(),
    assessmentIdToUpdate: z.string().uuid().optional().nullable(), // UUID string for assessment ID
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
    console.log('[saveAssessment] Starting with data:', rawData);
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('[saveAssessment] User not authenticated');
        return { error: 'User not authenticated' };
    }

    console.log('[saveAssessment] User authenticated:', user.id);

    const validatedFields = saveAssessmentSchema.safeParse(rawData);
    if (!validatedFields.success) {
        console.error('[saveAssessment] Validation failed:', validatedFields.error.flatten());
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

    console.log('[saveAssessment] Validated data:', {
        classId,
        studentEnrollmentId,
        classCurriculumPlanId,
        contentGroupId,
        gradeScaleId,
        assessmentIdToUpdate,
        weekStartDateString
    });

    // --- Authorization Check ---
    try {
        const authorized = await canUserGradeClass(user.id, classId);
        if (!authorized) {
            console.error('[saveAssessment] User not authorized for class:', classId);
            return { error: 'User not authorized to grade this class.' };
        }
        console.log('[saveAssessment] Authorization successful');
    } catch (authError) {
        console.error('[saveAssessment] Authorization check failed:', authError);
        return { error: 'Authorization check failed.' };
    }

    try {
        let savedAssessment: StudentAssessment;
        // Parse the week start date string into a UTC Date object
        const assessmentDate = new Date(`${weekStartDateString}T00:00:00Z`); 
        
        console.log('[saveAssessment] Assessment date parsed:', assessmentDate);

        if (assessmentIdToUpdate) {
            console.log('[saveAssessment] Updating existing assessment:', assessmentIdToUpdate);
            
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
                console.error('[saveAssessment] Assessment not found for update:', assessmentIdToUpdate);
                return { error: 'Assessment not found for update.' };
            }
            savedAssessment = updatedItem;
            console.log('[saveAssessment] Assessment updated successfully:', savedAssessment.id);

        } else {
            console.log('[saveAssessment] Creating new assessment');
            
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

            console.log('[saveAssessment] Assessment to insert:', assessmentToInsert);

            const [newItem] = await db.insert(studentAssessments)
                                  .values(assessmentToInsert)
                                  .returning();
            
            if (!newItem) {
                console.error('[saveAssessment] Failed to create new assessment');
                return { error: 'Failed to create assessment.' };
            }
            
            savedAssessment = newItem;
            console.log('[saveAssessment] Assessment created successfully:', savedAssessment.id);
        }

        // Skip revalidatePath to prevent losing URL parameters during client-side optimistic updates
        // The client component handles the state updates optimistically
        console.log('[saveAssessment] Skipping revalidatePath to preserve URL params');
        
        console.log('[saveAssessment] Operation completed successfully');
        return { success: true, error: null, savedAssessment };

    } catch (error: any) {
        console.error('[saveAssessment] Database operation failed:', {
            error: error,
            message: error?.message,
            code: error?.code,
            stack: error?.stack
        });
        
        // Enhanced error handling for different types of database errors
        if (error.message?.includes('student_assessment_unique_idx')) {
            return { error: 'An assessment already exists for this student and item. Update failed.' };
        }
        
        // Handle UUID errors
        if (error.message?.includes('invalid input syntax for type uuid')) {
            return { error: 'Invalid ID format. Please refresh the page and try again.' };
        }
        
        // Handle foreign key constraint errors
        if (error.message?.includes('foreign key constraint')) {
            return { error: 'Referenced data not found. Please refresh the page and try again.' };
        }
        
        // Handle connection errors
        if (error.message?.includes('connect') || error.message?.includes('timeout')) {
            return { error: 'Database connection issue. Please try again.' };
        }
        
        // Generic database error
        return { error: `Failed to save assessment: ${error.message || 'Unknown error'}` };
    }
} 