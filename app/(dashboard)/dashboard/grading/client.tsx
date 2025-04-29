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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from "sonner";
import { saveAssessment } from "./actions"; // Import the server action

// --- Prop Types (Matching Server Component Fetches) ---

type StudentWithEnrollment = StudentEnrollment & { student: Student };
type PlannedItemWithContentGroup = ClassCurriculumPlanItem & { contentGroup: { name: string } };
// Remove SimpleClass type if no longer needed here
// type SimpleClass = { id: number; name: string };

interface GradingTableClientProps {
    classData: Class & { stage: Stage | null };
    students: StudentWithEnrollment[];
    gradeScales: GradeScale[];
    plannedItems: PlannedItemWithContentGroup[];
    initialAssessments: StudentAssessment[];
    terms: Term[];
    currentWeek: Date;
    allWeeks: Date[];
    // Prop for initial ID, can be null if URL is missing it initially
    currentClassId: number | null; 
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
    classData: initialClassData,
    students: initialStudents,
    gradeScales,
    plannedItems: initialPlannedItems,
    initialAssessments,
    terms,
    currentWeek: initialCurrentWeek,
    allWeeks,
    currentClassId: initialClassId, // Rename prop
}: GradingTableClientProps) {

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Derive classId primarily from URL, fall back to initial prop
    const classIdFromUrl = searchParams.get('classId');
    const currentClassId = classIdFromUrl ? parseInt(classIdFromUrl, 10) : initialClassId;

    // Derive week primarily from URL, fall back to initial prop
    const weekFromUrl = searchParams.get('week'); // Week is expected as YYYY-MM-DD string
    const currentWeek = useMemo(() => 
        weekFromUrl ? new Date(weekFromUrl + 'T00:00:00') : initialCurrentWeek, 
        [weekFromUrl, initialCurrentWeek]
    );

    // Local state for data that might change based on URL params
    const [assessments, setAssessments] = useState<StudentAssessment[]>(initialAssessments);
    const [students, setStudents] = useState(initialStudents);
    const [plannedItems, setPlannedItems] = useState(initialPlannedItems);
    const [classData, setClassData] = useState(initialClassData);

    // Effect to update local state when initial props change 
    // (e.g., after navigation finishes and server component refetches)
    useEffect(() => {
        setAssessments(initialAssessments);
        setStudents(initialStudents);
        setPlannedItems(initialPlannedItems);
        setClassData(initialClassData);
        // Note: currentWeek is handled by the useMemo above
    }, [initialAssessments, initialStudents, initialPlannedItems, initialClassData]);

    const [isPending, startTransition] = useTransition();

    // --- Log props/state --- 
    console.log('[GradingTable Client] Render State:', {
        classId: currentClassId, // Use derived currentClassId
        currentWeek: formatDate(currentWeek),
        plannedItemsCount: plannedItems.length,
        assessmentsCount: assessments.length,
    });
    // --- End Logging ---

    // --- Week Navigation Logic ---
    const currentWeekIndex = useMemo(() => {
        const currentWeekString = formatDate(currentWeek);
        const index = allWeeks.findIndex(week => formatDate(week) === currentWeekString);
        return index;
    }, [currentWeek, allWeeks]);

    const canGoPrev = currentWeekIndex > 0;
    const canGoNext = currentWeekIndex < allWeeks.length - 1;

    const navigateToWeek = (weekDate: Date) => {
        if (!currentClassId) return; // Should not happen if URL logic is correct
        const formattedDate = formatDate(weekDate);
        // Construct URL with classId derived from URL state
        const targetUrl = `/dashboard/grading?classId=${currentClassId}&week=${formattedDate}`;
        console.log(`[Grading Client] Navigating to URL: ${targetUrl}`);
        router.push(targetUrl); 
    };
    const handlePreviousWeek = () => {
        if (canGoPrev) {
            navigateToWeek(allWeeks[currentWeekIndex - 1]);
        }
    };
    const handleNextWeek = () => {
        if (canGoNext) {
            navigateToWeek(allWeeks[currentWeekIndex + 1]);
        }
    };

    const currentWeekFormatted = formatDate(currentWeek);

    // --- Grade Change Handler ---
    const handleGradeChange = (
        studentEnrollmentId: number,
        classCurriculumPlanId: number,
        contentGroupId: number,
        newGradeScaleId: number | null
    ) => {
        if (!currentClassId) {
            toast.error("Cannot save grade: Class ID is missing.");
            return; 
        }
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

        // Call Server Action (ensure it uses the derived currentClassId)
        startTransition(() => {
            saveAssessment({
                classId: currentClassId, // Use derived currentClassId
                studentEnrollmentId,
                classCurriculumPlanId,
                contentGroupId,
                contentPointId: null, // Group-level
                gradeScaleId: newGradeScaleId, // Assured not null by logic above
                notes: existingAssessment?.notes ?? null,
                assessmentIdToUpdate: existingAssessment?.id, // Pass ID if updating
                weekStartDate: formatDate(currentWeek) // Use derived currentWeek
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

    // --- Rendering Logic ---

    // Display message if class ID is missing
    if (!currentClassId) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Please select a class first.</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* Header Section: Class Name, Week Navigation */}
            <div className="flex justify-between items-center">
                 {/* Use classData state */}
                <h1 className="text-xl font-semibold">
                    Grading: {classData?.name ?? 'Loading...'} ({classData?.calendarYear})
                </h1>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePreviousWeek}
                        disabled={!canGoPrev || isPending}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Select
                        value={currentWeekFormatted} // Use formatted string derived from currentWeek state
                        onValueChange={(weekString) => {
                            if (weekString) navigateToWeek(new Date(weekString + 'T00:00:00'));
                        }}
                        disabled={isPending}
                    >
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select Week..." />
                        </SelectTrigger>
                        <SelectContent>
                            {allWeeks.map((week, index) => {
                                const weekStr = formatDate(week);
                                // Find term for this week
                                const term = terms.find(t => 
                                    new Date(week) >= new Date(t.startDate) && 
                                    new Date(week) <= new Date(t.endDate)
                                );
                                const weekNumberInTerm = term ? 
                                    Math.floor((new Date(week).getTime() - new Date(term.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                                    : 'N/A';
                                return (
                                    <SelectItem key={weekStr} value={weekStr}>
                                        Week {weekNumberInTerm} {term ? `(Term ${term.termNumber})` : ''} - {weekStr}
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
                    </Button>
                </div>
            </div>

            {/* Grading Table */} 
            {/* Use plannedItems state and students state */}
            {(plannedItems.length > 0 && students.length > 0) ? (
                <Table className="border">
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
            ) : (
                <p className="text-muted-foreground text-center py-4">
                    {plannedItems.length === 0 ? "No content planned for this week." : "No students found in this class."}
                </p>
            )}
        </div>
    );
} 