'use client';

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    type Class,
    type ClassCurriculumPlanItem,
    type GradeScale,
    type Stage,
    type Student,
    type StudentAssessment,
    type StudentEnrollment,
    type Term
} from '@/lib/db/schema';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from 'react';
import { toast } from "sonner";
import { saveAssessment } from "./actions"; // Import the server action

// --- Prop Types (Matching Server Component Fetches) ---

type StudentWithEnrollment = StudentEnrollment & { student: Student };
type PlannedItemWithContentGroup = ClassCurriculumPlanItem & { contentGroup: { name: string } };
// Remove SimpleClass type if no longer needed here
// type SimpleClass = { id: number; name: string };

interface GradingTableClientProps {
    classData: Class & { stage: Stage | null }; // classData still needed for display
    students: StudentWithEnrollment[];
    gradeScales: GradeScale[];
    plannedItems: PlannedItemWithContentGroup[];
    initialAssessments: StudentAssessment[];
    terms: Term[];
    currentWeek: Date; // Pass the specific week being viewed
    allWeeks: Date[]; // Use pre-calculated weeks from server
    // Remove props related to the class selector previously here
    // currentClassId: number;
    // userTaughtClasses: SimpleClass[];
    // allTeamClasses: SimpleClass[];
    currentClassId: number; // Keep currentClassId to know which class we are viewing
}

// Helper function to format dates consistently to YYYY-MM-DD
const formatDate = (date: Date | string): string => {
    try {
        const d = new Date(date);
        // Ensure we handle potential timezone offsets correctly when getting YYYY-MM-DD
        const year = d.getFullYear(); // Use local year
        const month = (d.getMonth() + 1).toString().padStart(2, '0'); // Use local month
        const day = d.getDate().toString().padStart(2, '0'); // Use local day
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return ''; // Return empty string or handle error appropriately
    }
};

export default function GradingTableClient({
    classData,
    students,
    gradeScales,
    plannedItems,
    initialAssessments,
    terms,
    currentWeek,
    allWeeks,
    // Remove destructured props
    currentClassId, // Keep this one
    // userTaughtClasses, 
    // allTeamClasses,
}: GradingTableClientProps) {

    // --- Log props received by client ---
    console.log('[GradingTable Client] Received Props:', {
        classId: currentClassId, // Use currentClassId prop
        currentWeek: formatDate(currentWeek),
        plannedItemsCount: plannedItems.length,
        plannedItemsSample: plannedItems.slice(0, 5).map(p => ({ id: p.id, name: p.contentGroup.name })), // Log first 5 planned item IDs/names
        initialAssessmentsCount: initialAssessments.length,
        initialAssessmentsSample: initialAssessments.slice(0, 10).map(a => ({ // Log first 10 assessment details
            id: a.id,
            enrollmentId: a.studentEnrollmentId,
            planId: a.classCurriculumPlanId,
            gradeId: a.gradeScaleId,
            date: a.assessmentDate
        }))
    });
    // --- End Logging ---

    const [assessments, setAssessments] = useState<StudentAssessment[]>(initialAssessments);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    // Remove client-side class selection logic
    // const pathname = usePathname();
    // const searchParams = useSearchParams();
    // const [selectedValue, setSelectedValue] = useState(...);
    // useEffect(...);
    // const handleClassChange = (...);

    // --- Week Navigation Logic (using pre-calculated allWeeks) ---
    const currentWeekIndex = useMemo(() => {
        const currentWeekString = formatDate(currentWeek);
        console.log(`[Grading Client] Current Week String: ${currentWeekString}`);
        console.log('[Grading Client] All Weeks Strings:', allWeeks.map(w => formatDate(w)));
        // Find index by comparing YYYY-MM-DD strings
        const index = allWeeks.findIndex(week => formatDate(week) === currentWeekString);
        console.log(`[Grading Client] Calculated currentWeekIndex (Date String Match): ${index}`);
        // Fallback check if string match fails (shouldn't be needed now, but keep for safety)
        if (index === -1) {
             console.warn('[Grading Client] Date string match failed, attempting timestamp match as fallback...');
             const currentWeekTime = new Date(currentWeek).setHours(0,0,0,0); // Normalize time for comparison
             const fallbackIndex = allWeeks.findIndex(week => new Date(week).setHours(0,0,0,0) === currentWeekTime);
             console.log(`[Grading Client] Fallback timestamp match index: ${fallbackIndex}`);
             return fallbackIndex; // Use fallback index if primary failed
        }
        return index;
    }, [currentWeek, allWeeks]);

    const canGoPrev = currentWeekIndex > 0;
    const canGoNext = currentWeekIndex < allWeeks.length - 1;
    console.log(`[Grading Client] Navigation State: canGoPrev=${canGoPrev}, canGoNext=${canGoNext}, index=${currentWeekIndex}, totalWeeks=${allWeeks.length}`);

    const navigateToWeek = (weekDate: Date) => {
        const formattedDate = formatDate(weekDate);
        const targetUrl = `/dashboard/grading?classId=${currentClassId}&week=${formattedDate}`;
        console.log(`[Grading Client] Navigating to URL: ${targetUrl}`);
        router.push(targetUrl); 
    };
    const handlePreviousWeek = () => {
        if (canGoPrev) {
            console.log(`[Grading Client] Handling Previous Week. Index: ${currentWeekIndex}, Target Index: ${currentWeekIndex - 1}`);
            navigateToWeek(allWeeks[currentWeekIndex - 1]);
        }
    };
    const handleNextWeek = () => {
        if (canGoNext) {
            console.log(`[Grading Client] Handling Next Week. Index: ${currentWeekIndex}, Target Index: ${currentWeekIndex + 1}`);
            navigateToWeek(allWeeks[currentWeekIndex + 1]);
        }
    };

    const currentWeekFormatted = formatDate(currentWeek);
    console.log(`[Grading Client] Initial formatted week for Select value: ${currentWeekFormatted}`);

    // --- Grade Change Handler ---
    const handleGradeChange = (
        studentEnrollmentId: number,
        classCurriculumPlanId: number,
        contentGroupId: number,
        newGradeScaleId: number | null // Can be null if unsetting
    ) => {
        // Find if an assessment already exists for this cell
        const existingAssessmentIndex = assessments.findIndex(
            a => a.studentEnrollmentId === studentEnrollmentId &&
                a.classCurriculumPlanId === classCurriculumPlanId &&
                a.contentPointId === null // Group-level
        );
        const existingAssessment = existingAssessmentIndex !== -1 ? assessments[existingAssessmentIndex] : null;

        // Prevent redundant updates
        if (existingAssessment?.gradeScaleId === newGradeScaleId) return;

        // Optimistic Update
        const originalAssessments = [...assessments];
        let optimisticAssessment: StudentAssessment | null = null;

        if (newGradeScaleId === null) {
            // Removing the grade - optimistically filter it out
            if (existingAssessment) {
                setAssessments(prev => prev.filter(a => a.id !== existingAssessment.id));
                // TODO: Implement deleteAssessment server action if needed
                toast.info('Grade removed (Deletion not yet implemented)');
                return; // Stop here until deletion is implemented
            } else {
                return; // Nothing to remove
            }
        } else {
            // Adding or updating the grade
            optimisticAssessment = {
                id: existingAssessment?.id ?? `optimistic-${Date.now()}` as any,
                studentEnrollmentId,
                classCurriculumPlanId,
                contentGroupId,
                contentPointId: null,
                gradeScaleId: newGradeScaleId,
                assessmentDate: currentWeek,
                notes: existingAssessment?.notes ?? null,
                createdAt: existingAssessment?.createdAt ?? new Date(),
                updatedAt: new Date(),
            };

            if (existingAssessment) {
                // Update existing assessment optimistically
                setAssessments(prev => prev.map(a => a.id === existingAssessment.id ? optimisticAssessment! : a));
            } else {
                // Add new assessment optimistically
                setAssessments(prev => [...prev, optimisticAssessment!]);
            }
        }

        // Call Server Action
        startTransition(() => {
            saveAssessment({
                classId: currentClassId, // Use currentClassId prop here
                studentEnrollmentId,
                classCurriculumPlanId,
                contentGroupId,
                contentPointId: null, // Group-level
                gradeScaleId: newGradeScaleId, // Assured not null by logic above
                notes: existingAssessment?.notes ?? null,
                assessmentIdToUpdate: existingAssessment?.id, // Pass ID if updating
                weekStartDate: formatDate(currentWeek) // Pass the correct week start date string
            }).then(result => {
                if (result.error) {
                    toast.error(`Failed to save grade: ${result.error}`);
                    // Revert optimistic update on error
                    setAssessments(originalAssessments);
                } else if (result.success && result.savedAssessment) {
                    toast.success('Grade saved!');
                    // Update state with the actual assessment from server (replaces optimistic)
                    setAssessments(prev => {
                        const index = prev.findIndex(a =>
                            a.studentEnrollmentId === result.savedAssessment!.studentEnrollmentId &&
                            a.classCurriculumPlanId === result.savedAssessment!.classCurriculumPlanId &&
                            a.contentPointId === result.savedAssessment!.contentPointId
                        );
                        if (index !== -1) {
                            const newState = [...prev];
                            newState[index] = result.savedAssessment!;
                            return newState;
                        } else {
                            // Should have been added optimistically, but ensure it's there
                            return [...prev.filter(a => typeof a.id === 'number'), result.savedAssessment!];
                        }
                    });
                } else {
                    // Handle unexpected success case without data
                    setAssessments(originalAssessments);
                }
            });
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Section - Remove Class Selector, keep Week Navigation */}
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0 flex-wrap gap-4">
                 {/* Display current class name and week */}
                 <h1 className="text-xl font-semibold flex-shrink-0">
                     Grading: {classData.name} - Week of {new Date(currentWeek).toLocaleDateString('en-AU')}
                </h1>
                
                {/* Week Navigation Controls */}
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePreviousWeek}
                        disabled={!canGoPrev || isPending}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Previous Week</span>
                    </Button>
                    {/* Week Selector Dropdown */}
                    <Select
                        value={currentWeekFormatted}
                        onValueChange={(value) => navigateToWeek(new Date(value))}
                        disabled={isPending}
                    >
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select week..." />
                        </SelectTrigger>
                        <SelectContent>
                            {allWeeks.map((week, index) => {
                                const formattedWeekValue = formatDate(week);
                                return (
                                    <SelectItem key={index} value={formattedWeekValue}>
                                        {formattedWeekValue} 
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleNextWeek}
                        disabled={!canGoNext || isPending}
                    >
                        <ChevronRight className="h-4 w-4" />
                        <span className="sr-only">Next Week</span>
                    </Button>
                </div>
            </div>

            {/* Grading Table */}
            <div className="flex-1 overflow-auto">
                <Table className="min-w-full divide-y divide-gray-200">
                    <TableHeader>
                        <TableRow>
                            {/* Student Column - Fixed width */}
                            <TableHead
                                className="sticky left-0 bg-background z-10 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider align-top"
                                style={{
                                    width: '200px',
                                    minWidth: '200px',
                                    maxWidth: '200px'
                                }}
                            >
                                Student
                            </TableHead>

                            {/* Planned Item Columns - Dynamic width */}
                            {plannedItems.map((item) => (
                                <TableHead
                                    key={item.id}
                                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider align-top"
                                    style={{
                                        minWidth: '140px', // Minimum width for content
                                        overflowWrap: 'break-word',
                                        wordBreak: 'break-word',
                                        whiteSpace: 'normal'
                                    }}
                                    title={item.contentGroup.name}
                                >
                                    {item.contentGroup.name}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-200 bg-white">
                        {students.map((enrollment) => (
                            <TableRow key={enrollment.id}>
                                {/* Student Cell - Fixed width */}
                                <TableCell
                                    className="sticky left-0 bg-white z-10 px-4 py-2 text-sm font-medium align-top"
                                    style={{
                                        width: '200px',
                                        minWidth: '200px',
                                        maxWidth: '200px'
                                    }}
                                >
                                    {enrollment.student.firstName} {enrollment.student.lastName}
                                </TableCell>

                                {/* Grading Cells - Dynamic width */}
                                {plannedItems.map((item) => {
                                    // Find assessment in local state
                                    const existingAssessment = assessments.find(
                                        a => a.studentEnrollmentId === enrollment.id &&
                                            a.classCurriculumPlanId === item.id &&
                                            a.contentPointId === null
                                    );
                                    // --- Log matching logic ---
                                    console.log(`[GradingTable Client Cell] Trying to match: StudentEnrollmentId=${enrollment.id}, PlannedItemId=${item.id}`);
                                    console.log(`[GradingTable Client Cell] Found Assessment:`, existingAssessment ? { id: existingAssessment.id, gradeId: existingAssessment.gradeScaleId } : null);
                                    // --- End Logging ---
                                    // Use state for the select value to reflect optimistic updates
                                    const currentGradeScaleId = existingAssessment?.gradeScaleId;

                                    return (
                                        <TableCell
                                            key={item.id}
                                            className="px-4 py-2 text-sm align-top"
                                            style={{
                                                minWidth: '140px',
                                                overflowWrap: 'break-word',
                                                wordBreak: 'break-word',
                                                whiteSpace: 'normal'
                                            }}
                                        >
                                            <Select
                                                value={currentGradeScaleId?.toString() ?? ''}
                                                onValueChange={(value) => {
                                                    // Convert the selected string value back to a number or null
                                                    const newGradeId = value === '_clear_' || value === '' ? null : parseInt(value, 10);
                                                    
                                                    // Call the handler function
                                                    handleGradeChange(
                                                        enrollment.id,          // studentEnrollmentId
                                                        item.id,                // classCurriculumPlanId
                                                        item.contentGroupId,    // contentGroupId
                                                        newGradeId              // newGradeScaleId (number | null)
                                                    );
                                                }}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select Grade..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {/* Option to clear the grade */}
                                                    <SelectItem value="_clear_">-</SelectItem>
                                                    {gradeScales.map((scale) => (
                                                        <SelectItem key={scale.id} value={scale.id.toString()}>
                                                            {scale.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
} 