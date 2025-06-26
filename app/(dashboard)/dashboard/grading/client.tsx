'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
    currentClassId: string | null; 
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

// Polyfill for requestIdleCallback (for Safari support)
const requestIdleCallbackPolyfill = (callback: () => void) => {
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(callback);
    } else {
        // Fallback for Safari
        setTimeout(callback, 0);
    }
};

// Highly optimized notes input component - memoized and isolated
interface NotesInputProps {
    cellKey: string;
    initialValue: string;
    onNotesChange: (cellKey: string, value: string) => void;
    disabled: boolean;
}

const NotesInput = memo(({ cellKey, initialValue, onNotesChange, disabled }: NotesInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const currentValueRef = useRef(initialValue);
    
    // Use direct DOM manipulation for maximum performance
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const newValue = e.target.value;
        currentValueRef.current = newValue;
        
        // Call the parent's change handler without any React state updates
        onNotesChange(cellKey, newValue);
    }, [cellKey, onNotesChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        e.stopPropagation();
        // Don't close dropdown or save on Enter, just continue typing
    }, []);

    // Initialize the input value only once
    useEffect(() => {
        if (inputRef.current && inputRef.current.value !== initialValue) {
            inputRef.current.value = initialValue;
            currentValueRef.current = initialValue;
        }
    }, [initialValue]);

    return (
        <Input
            ref={inputRef}
            type="text"
            placeholder="Add a note..."
            defaultValue={initialValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="w-full text-sm"
            disabled={disabled}
        />
    );
});

NotesInput.displayName = 'NotesInput';

// Memoized grade cell component to prevent unnecessary re-renders
interface GradeCellProps {
    enrollment: StudentWithEnrollment;
    item: PlannedItemWithContentGroup;
    currentGradeScaleId: number | undefined;
    hasNotes: string | null | undefined;
    gradeScales: GradeScale[];
    isPending: boolean;
    onGradeChange: (studentEnrollmentId: string, classCurriculumPlanId: string, contentGroupId: number, newGradeScaleId: number | null) => void;
    onDropdownClose: (studentEnrollmentId: string, classCurriculumPlanId: string, contentGroupId: number) => void;
    onNotesChange: (cellKey: string, value: string) => void;
    cellNotes: Record<string, string>;
}

const GradeCell = memo(({ 
    enrollment, 
    item, 
    currentGradeScaleId, 
    hasNotes, 
    gradeScales, 
    isPending,
    onGradeChange,
    onDropdownClose,
    onNotesChange,
    cellNotes
}: GradeCellProps) => {
    const cellKey = `${enrollment.id}-${item.id}`;
    
    const handleGradeChange = useCallback((value: string) => {
        const newGradeId = value === '_clear_' || value === '' ? null : parseInt(value, 10);
        onGradeChange(enrollment.id, item.id, item.contentGroupId, newGradeId);
    }, [enrollment.id, item.id, item.contentGroupId, onGradeChange]);

    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) {
            onDropdownClose(enrollment.id, item.id, item.contentGroupId);
        }
    }, [enrollment.id, item.id, item.contentGroupId, onDropdownClose]);

    return (
        <TableCell
            className="px-4 py-2 text-sm align-top"
            style={{
                minWidth: '140px',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
            }}
        >
            <div className="relative">
                <Select
                    value={currentGradeScaleId?.toString() ?? ''}
                    onValueChange={handleGradeChange}
                    onOpenChange={handleOpenChange}
                    disabled={isPending}
                >
                    <SelectTrigger className="w-full">
                        <div className="flex items-center justify-between w-full">
                            <SelectValue placeholder="Select Grade..." />
                            {hasNotes && (
                                <MessageSquare className="h-4 w-4 text-blue-500 ml-2" />
                            )}
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {/* Option to clear the grade */}
                        <SelectItem value="_clear_">-</SelectItem>
                        {gradeScales.map((scale) => (
                            <SelectItem key={scale.id} value={scale.id.toString()}>
                                {scale.name}
                            </SelectItem>
                        ))}
                        {/* Notes input at the bottom */}
                        <div className="p-2 border-t">
                            <NotesInput
                                cellKey={cellKey}
                                initialValue={cellNotes[cellKey] || ''}
                                onNotesChange={onNotesChange}
                                disabled={isPending}
                            />
                        </div>
                    </SelectContent>
                </Select>
            </div>
        </TableCell>
    );
});

GradeCell.displayName = 'GradeCell';

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
    const currentClassId = classIdFromUrl ? classIdFromUrl : initialClassId;

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

    // State for tracking notes input for each cell (batched updates for performance)
    const [cellNotes, setCellNotes] = useState<Record<string, string>>({});
    
    // Refs to track the actual current values and pending updates
    const cellNotesRef = useRef<Record<string, string>>({});
    const pendingUpdatesRef = useRef<Set<string>>(new Set());
    const updateQueuedRef = useRef(false);

    // Effect to update local state when initial props change 
    // (e.g., after navigation finishes and server component refetches)
    useEffect(() => {
        setAssessments(initialAssessments);
        setStudents(initialStudents);
        setPlannedItems(initialPlannedItems);
        setClassData(initialClassData);
        
        // Initialize notes state from existing assessments
        const initialNotes: Record<string, string> = {};
        initialAssessments.forEach(assessment => {
            if (assessment.notes) {
                const cellKey = `${assessment.studentEnrollmentId}-${assessment.classCurriculumPlanId}`;
                initialNotes[cellKey] = assessment.notes;
            }
        });
        setCellNotes(initialNotes);
        cellNotesRef.current = initialNotes;
        
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

    const navigateToWeek = useCallback((weekDate: Date) => {
        if (!currentClassId) return; // Should not happen if URL logic is correct
        const formattedDate = formatDate(weekDate);
        // Construct URL with classId derived from URL state
        const targetUrl = `/dashboard/grading?classId=${currentClassId}&week=${formattedDate}`;
        console.log(`[Grading Client] Navigating to URL: ${targetUrl}`);
        router.push(targetUrl); 
    }, [currentClassId, router]);

    const handlePreviousWeek = useCallback(() => {
        if (canGoPrev) {
            navigateToWeek(allWeeks[currentWeekIndex - 1]);
        }
    }, [canGoPrev, navigateToWeek, allWeeks, currentWeekIndex]);

    const handleNextWeek = useCallback(() => {
        if (canGoNext) {
            navigateToWeek(allWeeks[currentWeekIndex + 1]);
        }
    }, [canGoNext, navigateToWeek, allWeeks, currentWeekIndex]);

    const currentWeekFormatted = formatDate(currentWeek);

    // --- Batched state update function ---
    const flushPendingUpdates = useCallback(() => {
        if (pendingUpdatesRef.current.size > 0) {
            const updates: Record<string, string> = {};
            pendingUpdatesRef.current.forEach(cellKey => {
                updates[cellKey] = cellNotesRef.current[cellKey] || '';
            });
            
            setCellNotes(prev => ({ ...prev, ...updates }));
            pendingUpdatesRef.current.clear();
        }
        updateQueuedRef.current = false;
    }, []);

    // --- Grade Change Handler ---
    const handleGradeChange = useCallback((
        studentEnrollmentId: string,
        classCurriculumPlanId: string,
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

        // Get the current notes for this cell from ref (most up-to-date)
        const cellKey = `${studentEnrollmentId}-${classCurriculumPlanId}`;
        const currentNotes = cellNotesRef.current[cellKey] || existingAssessment?.notes || '';

        // Prevent redundant updates
        if (existingAssessment?.gradeScaleId === newGradeScaleId && existingAssessment?.notes === currentNotes) return;

        // Optimistic Update
        const originalAssessments = [...assessments];
        let optimisticAssessment: StudentAssessment | null = null;

        if (newGradeScaleId === null) {
            // Removing the grade - optimistically filter it out
            if (existingAssessment) {
                setAssessments(prev => prev.filter(a => a.id !== existingAssessment.id));
                // Clear notes from local state as well
                delete cellNotesRef.current[cellKey];
                setCellNotes(prev => {
                    const newNotes = { ...prev };
                    delete newNotes[cellKey];
                    return newNotes;
                });
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
                notes: currentNotes,
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
                notes: currentNotes,
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
    }, [currentClassId, assessments, currentWeek, cellNotesRef]);

    // --- Notes Change Handler (optimized for performance) ---
    const handleNotesChange = useCallback((
        cellKey: string,
        newNotes: string
    ) => {
        // Immediately update the ref (this is fast and doesn't trigger re-renders)
        cellNotesRef.current[cellKey] = newNotes;
        
        // Mark this cell as needing a state update
        pendingUpdatesRef.current.add(cellKey);
        
        // Queue a batched update using requestIdleCallback for better performance
        if (!updateQueuedRef.current) {
            updateQueuedRef.current = true;
            requestIdleCallbackPolyfill(flushPendingUpdates);
        }
    }, [flushPendingUpdates]);

    // --- Handle dropdown close - save notes if they changed ---
    const handleDropdownClose = useCallback((
        studentEnrollmentId: string,
        classCurriculumPlanId: string,
        contentGroupId: number
    ) => {
        const cellKey = `${studentEnrollmentId}-${classCurriculumPlanId}`;
        
        // Flush any pending updates first
        if (pendingUpdatesRef.current.has(cellKey)) {
            flushPendingUpdates();
        }
        
        const currentNotes = cellNotesRef.current[cellKey] || '';
        
        // Find existing assessment
        const existingAssessment = assessments.find(
            a => a.studentEnrollmentId === studentEnrollmentId &&
                a.classCurriculumPlanId === classCurriculumPlanId &&
                a.contentPointId === null
        );
        
        // Check if notes have actually changed
        const existingNotes = existingAssessment?.notes || '';
        if (currentNotes !== existingNotes) {
            // Notes have changed, save them
            handleGradeChange(
                studentEnrollmentId,
                classCurriculumPlanId,
                contentGroupId,
                existingAssessment?.gradeScaleId || null
            );
        }
    }, [assessments, flushPendingUpdates, handleGradeChange]);

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
        <div className="space-y-4">
            {/* Header Section: Class Name, Week Navigation */}
            <div className="flex flex-wrap justify-between items-center gap-4 px-4 py-2">
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
                            {allWeeks.map((week, globalIndex) => {
                                const weekStr = formatDate(week);
                                
                                // Find the term this week belongs to more accurately
                                const term = terms.find(t => {
                                    // Calculate Monday of the week the term starts
                                    const termStartMonday = new Date(t.startDate);
                                    const day = termStartMonday.getDay();
                                    const diff = termStartMonday.getDate() - day + (day === 0 ? -6 : 1);
                                    termStartMonday.setDate(diff);
                                    termStartMonday.setHours(0, 0, 0, 0);

                                    // Get term end date
                                    const termEndDate = new Date(t.endDate);
                                    termEndDate.setHours(0, 0, 0, 0);

                                    // Check if the current week's Monday falls within the term's effective range
                                    return week.getTime() >= termStartMonday.getTime() && week.getTime() <= termEndDate.getTime();
                                });

                                let weekNumberInTerm: number | string = 'N/A';
                                if (term) {
                                    // Find the index within allWeeks of the first Monday associated with this term
                                    const firstWeekOfTermIndex = allWeeks.findIndex(w => {
                                        const termStartMonday = new Date(term.startDate);
                                        const day = termStartMonday.getDay();
                                        const diff = termStartMonday.getDate() - day + (day === 0 ? -6 : 1);
                                        termStartMonday.setDate(diff);
                                        termStartMonday.setHours(0, 0, 0, 0);
                                        return w.getTime() >= termStartMonday.getTime(); 
                                    });

                                    // Calculate week number relative to the start of the term weeks
                                    if (firstWeekOfTermIndex !== -1) {
                                        weekNumberInTerm = globalIndex - firstWeekOfTermIndex + 1;
                                    }
                                }

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
                <div className="w-full overflow-x-auto">
                    <Table className="border w-full min-w-full table-fixed">
                        <TableHeader>
                            <TableRow>
                                {/* Student Column - Fixed width */}
                                <TableHead
                                    className="sticky left-0 bg-background z-10 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider align-top border-r"
                                    style={{
                                        width: '200px',
                                        minWidth: '200px',
                                        maxWidth: '200px'
                                    }}
                                >
                                    Student
                                </TableHead>

                                {/* Planned Item Columns - Equal width distribution */}
                                {plannedItems.map((item, index) => (
                                    <TableHead
                                        key={item.id}
                                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider align-top"
                                        style={{
                                            width: `calc((100% - 200px) / ${plannedItems.length})`,
                                            minWidth: '140px',
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
                                    <Link 
                                        href={`/dashboard/students/${enrollment.student.id}?classId=${currentClassId}`}
                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                        {enrollment.student.firstName} {enrollment.student.lastName}
                                    </Link>
                                </TableCell>

                                {/* Grading Cells - Equal width distribution */}
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
                                    const cellKey = `${enrollment.id}-${item.id}`;
                                    const hasNotes = cellNotes[cellKey] || existingAssessment?.notes;

                                    return (
                                        <TableCell
                                            key={item.id}
                                            className="px-4 py-2 text-sm align-top"
                                            style={{
                                                width: `calc((100% - 200px) / ${plannedItems.length})`,
                                                minWidth: '140px',
                                                overflowWrap: 'break-word',
                                                wordBreak: 'break-word',
                                                whiteSpace: 'normal'
                                            }}
                                        >
                                            <GradeCell
                                                enrollment={enrollment}
                                                item={item}
                                                currentGradeScaleId={currentGradeScaleId}
                                                hasNotes={hasNotes}
                                                gradeScales={gradeScales}
                                                isPending={isPending}
                                                onGradeChange={handleGradeChange}
                                                onDropdownClose={handleDropdownClose}
                                                onNotesChange={handleNotesChange}
                                                cellNotes={cellNotes}
                                            />
                                        </TableCell>
                                    );
                                })}
                                                                </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-4">
                    {plannedItems.length === 0 ? "No content planned for this week." : "No students found in this class."}
                </p>
            )}
        </div>
    );
} 