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

interface GradingTableClientProps {
    classData: Class & { stage: Stage | null };
    students: StudentWithEnrollment[];
    gradeScales: GradeScale[];
    plannedItems: PlannedItemWithContentGroup[];
    initialAssessments: StudentAssessment[];
    terms: Term[];
    currentWeek: Date; // Pass the specific week being viewed
    allWeeks: Date[]; // Use pre-calculated weeks from server
}

// Helper function to format dates consistently
const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
};

export default function GradingTableClient({
    classData,
    students,
    gradeScales,
    plannedItems,
    initialAssessments,
    terms,
    currentWeek,
    allWeeks, // Use pre-calculated weeks from server
}: GradingTableClientProps) {

    const [assessments, setAssessments] = useState<StudentAssessment[]>(initialAssessments);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // --- Week Navigation Logic (using pre-calculated allWeeks) ---
    const currentWeekIndex = useMemo(() => {
        // Ensure currentWeek is treated as a Date object for comparison
        const currentWeekTime = new Date(currentWeek).getTime();
        return allWeeks.findIndex(week => week.getTime() === currentWeekTime);
    }, [currentWeek, allWeeks]);

    const canGoPrev = currentWeekIndex > 0;
    const canGoNext = currentWeekIndex < allWeeks.length - 1;

    const navigateToWeek = (weekDate: Date) => {
        const formattedDate = formatDate(weekDate);
        router.push(`/dashboard/grading/${classData.id}?week=${formattedDate}`);
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
                assessmentDate: new Date(),
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
                classId: classData.id,
                studentEnrollmentId,
                classCurriculumPlanId,
                contentGroupId,
                contentPointId: null, // Group-level
                gradeScaleId: newGradeScaleId, // Assured not null by logic above
                notes: existingAssessment?.notes ?? null,
                assessmentIdToUpdate: existingAssessment?.id, // Pass ID if updating
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
            {/* Header Section with Week Navigation */}
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                <h1 className="text-xl font-semibold">
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
                        value={formatDate(currentWeek)}
                        onValueChange={(value) => navigateToWeek(new Date(value))}
                        disabled={isPending}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Week..." />
                        </SelectTrigger>
                        <SelectContent>
                            {allWeeks.map((week, index) => (
                                <SelectItem key={index} value={formatDate(week)}>
                                    Week ({new Date(week).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })})
                                </SelectItem>
                            ))}
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
                                    const existingAssessment = assessments.find(
                                        a => a.studentEnrollmentId === enrollment.id &&
                                            a.classCurriculumPlanId === item.id &&
                                            a.contentPointId === null
                                    );
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