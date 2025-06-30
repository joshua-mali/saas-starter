'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type Class,
  type ClassCurriculumPlanItem,
  type Stage,
  type Term
} from '@/lib/db/schema'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

// DND Imports
import { cn } from '@/lib/utils'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

// Import server actions
import { addPlanItem, updatePlanItem } from './actions'

// Type for content groups fetched by the server component
type ContentGroupWithContext = {
    contentGroupId: number;
    contentGroupName: string;
    focusGroupId: number;
    focusGroupName: string;
    focusAreaId: number;
    focusAreaName: string;
    outcomeId: number;
    outcomeName: string;
    subjectId: number;
    subjectName: string;
}

// Props passed from the server component
interface PlanningBoardClientProps {
  classData: Class & { stage: Stage | null };
  terms: Term[];
  availableContentGroups: ContentGroupWithContext[];
  initialPlanItems: ClassCurriculumPlanItem[];
  currentClassId: string | null;
}

// Helper function to get weeks between two dates (Ensure this matches Grading page version if needed)
function getWeeksBetween(startDate: Date, endDate: Date): Date[] {
  const weeks: Date[] = [];
  let currentDate = new Date(startDate);
  const dayOfWeek = currentDate.getDay();
  const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  currentDate = new Date(currentDate.setDate(diff));
  currentDate.setHours(0, 0, 0, 0);
  const finalEndDate = new Date(endDate);
  finalEndDate.setHours(0, 0, 0, 0);
  while (currentDate <= finalEndDate) {
      weeks.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 7);
  }
  return weeks;
}

// --- Draggable Content Group Component ---
interface DraggableContentGroupProps {
  cg: ContentGroupWithContext;
  isOverlay?: boolean; // Flag for overlay rendering
}
function DraggableContentGroup({ cg, isOverlay }: DraggableContentGroupProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `contentgroup-${cg.contentGroupId}`,
    data: {
      type: 'contentGroup',
      contentGroupId: cg.contentGroupId,
      contentGroupName: cg.contentGroupName,
      data: cg, // Pass the full object for overlay rendering
    },
  });

  const style = transform && !isOverlay ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Hide original element when dragging if not rendering in overlay
  if (isDragging && !isOverlay) {
      return <div ref={setNodeRef} className="opacity-30 h-16"></div>; // Placeholder or just hidden
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab rounded border bg-card p-2 text-sm shadow-sm mb-2", isOverlay && "shadow-lg")}
    >
      <p className="font-semibold">{cg.contentGroupName}</p>
      <p className="text-xs text-muted-foreground">
        {cg.subjectName} &gt; {cg.outcomeName} &gt; {cg.focusAreaName} &gt; {cg.focusGroupName}
      </p>
    </div>
  );
}

// --- Draggable Plan Item Component ---
interface DraggablePlanItemProps {
  item: ClassCurriculumPlanItem;
  contentGroupName?: string;
  contentGroupData?: ContentGroupWithContext;
  isOverlay?: boolean; // Flag for overlay rendering
}
function DraggablePlanItem({ item, contentGroupName, contentGroupData, isOverlay }: DraggablePlanItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `planitem-${item.id}`,
    data: {
      type: 'planItem',
      planItemId: item.id,
      contentGroupId: item.contentGroupId,
      currentWeekStartDate: item.weekStartDate,
      data: item, // Pass the full object for overlay rendering
    },
  });

  const style = transform && !isOverlay ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Hide original element when dragging if not rendering in overlay
  if (isDragging && !isOverlay) {
       return <div ref={setNodeRef} className="opacity-30 h-16"></div>; // Placeholder
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab rounded border bg-card p-2 text-sm shadow mb-2", isOverlay && "shadow-lg")}
    >
      <p className="font-semibold">{contentGroupData?.contentGroupName || contentGroupName || `Content Group ${item.contentGroupId}`}</p>
      {contentGroupData && (
        <p className="text-xs text-muted-foreground">
          {contentGroupData.subjectName} &gt; {contentGroupData.outcomeName} &gt; {contentGroupData.focusAreaName} &gt; {contentGroupData.focusGroupName}
        </p>
      )}
    </div>
  );
}

// --- Droppable Week Column Component ---
interface DroppableWeekColumnProps {
  weekStartDate: Date;
  children: React.ReactNode;
}
function DroppableWeekColumn({ weekStartDate, children }: DroppableWeekColumnProps) {
  const formattedDate = weekStartDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const id = `week-${weekStartDate.toISOString()}`;
  const { isOver, setNodeRef } = useDroppable({ id: id, data: { type: 'weekColumn', weekStartDate } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-48 flex-shrink-0 rounded border p-2 flex flex-col h-full", 
        isOver ? "bg-primary/10 border-primary" : "bg-muted/40"
      )}
    >
      <h3 className="mb-2 text-center font-medium flex-shrink-0">Week of {formattedDate}</h3>
      <div className="flex-grow overflow-y-auto">
        <div className="space-y-1"> 
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PlanningBoardClient({
  classData: initialClassData,
  terms,
  availableContentGroups,
  initialPlanItems,
  currentClassId: initialClassId,
}: PlanningBoardClientProps) {
  const searchParams = useSearchParams();

  const classIdFromUrl = searchParams.get('classId');
  const currentClassId = classIdFromUrl ? classIdFromUrl : initialClassId;

  const [planItems, setPlanItems] = useState<ClassCurriculumPlanItem[]>(initialPlanItems);
  const [classData, setClassData] = useState(initialClassData);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDragItem, setActiveDragItem] = useState<Active | null>(null);
  const [selectedTermNumber, setSelectedTermNumber] = useState<number | null>(terms[0]?.termNumber ?? null);

  // Ref for the content groups scroll container
  const contentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlanItems(initialPlanItems);
    setClassData(initialClassData);
    if (!terms.some(t => t.termNumber === selectedTermNumber)) {
        setSelectedTermNumber(terms[0]?.termNumber ?? null);
    }
  }, [initialPlanItems, initialClassData, terms, selectedTermNumber]);

  const selectedTerm = useMemo(() => {
    return terms.find(t => t.termNumber === selectedTermNumber);
  }, [selectedTermNumber, terms]);

  const formatDate = (date: Date | string): string => {
      try {
          const d = new Date(date);
          const year = d.getFullYear();
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          const day = d.getDate().toString().padStart(2, '0');
          return `${year}-${month}-${day}`;
      } catch (e) {
          console.error("Error formatting date:", date, e);
          return '';
      }
  };

  const weeksInSelectedTerm = useMemo(() => {
    if (!selectedTerm?.startDate || !selectedTerm?.endDate) return [];
    const start = new Date(selectedTerm.startDate);
    const end = new Date(selectedTerm.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    return getWeeksBetween(start, end);
  }, [selectedTerm]);

  const filteredContentGroups = useMemo(() => {
    if (!searchTerm) return availableContentGroups;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return availableContentGroups.filter(cg =>
      cg.contentGroupName.toLowerCase().includes(lowerSearchTerm) ||
      cg.focusGroupName.toLowerCase().includes(lowerSearchTerm) ||
      cg.focusAreaName.toLowerCase().includes(lowerSearchTerm) ||
      cg.outcomeName.toLowerCase().includes(lowerSearchTerm) ||
      cg.subjectName.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm, availableContentGroups]);

  // Separate content groups into planned and unplanned
  const { unplannedContentGroups, plannedContentGroups } = useMemo(() => {
    const plannedContentGroupIds = new Set(planItems.map(item => item.contentGroupId));
    
    const unplanned = filteredContentGroups.filter(cg => 
      !plannedContentGroupIds.has(cg.contentGroupId)
    );
    
    const planned = filteredContentGroups.filter(cg => 
      plannedContentGroupIds.has(cg.contentGroupId)
    );
    
    return { unplannedContentGroups: unplanned, plannedContentGroups: planned };
  }, [filteredContentGroups, planItems]);

  const handleTermChange = (value: string) => {
    setSelectedTermNumber(parseInt(value, 10) || null);
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;

    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    const overWeekStartDate = over.data.current?.weekStartDate as Date | undefined;

    if (!currentClassId) {
        toast.error("Cannot modify plan: Class ID is missing.");
        return;
    }

    if (activeType === 'contentGroup' && overType === 'weekColumn' && overWeekStartDate) {
        const contentGroupId = active.data.current?.contentGroupId as number;
        const weekStartDateString = formatDate(overWeekStartDate);

        // Preserve scroll position
        const scrollTop = contentScrollRef.current?.scrollTop || 0;

        // Optimistic Update: Add a temporary item
        const tempId = `optimistic-${Date.now()}`;
        const optimisticItem: ClassCurriculumPlanItem = {
            id: tempId as any, // Temporary ID
            classId: currentClassId!, // Use non-null assertion since we check above
            contentGroupId,
            weekStartDate: overWeekStartDate,
            durationWeeks: 1, // Add default duration
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setPlanItems(prev => [...prev, optimisticItem]);

        // Restore scroll position after state update
        setTimeout(() => {
            if (contentScrollRef.current) {
                contentScrollRef.current.scrollTop = scrollTop;
            }
        }, 0);

        // Call Server Action to add the item
        addPlanItem({
            classId: currentClassId, // Use derived classId
            contentGroupId,
            weekStartDate: weekStartDateString, 
            // durationWeeks is handled by default in action
        }).then(result => {
            if (result.error) {
                toast.error(`Failed to add item: ${result.error}`);
                // Revert optimistic update - compare item.id as string
                setPlanItems(prev => prev.filter(item => String(item.id) !== tempId));
            } else if (result.success && result.newItem) { 
                toast.success('Item added successfully!');
                // Replace optimistic item - compare item.id as string
                setPlanItems(prev => prev.map(item => 
                    String(item.id) === tempId ? result.newItem! : item 
                ));
            } else {
                 toast.warning('Failed to add item, please try again.');
                 // Revert optimistic update - compare item.id as string
                 setPlanItems(prev => prev.filter(item => String(item.id) !== tempId));
            }
            
            // Restore scroll position after server response
            setTimeout(() => {
                if (contentScrollRef.current) {
                    contentScrollRef.current.scrollTop = scrollTop;
                }
            }, 0);
        }).catch(err => {
             console.error("Error calling addPlanItem:", err);
             toast.error('An unexpected error occurred.');
             // Revert optimistic update - compare item.id as string
             setPlanItems(prev => prev.filter(item => String(item.id) !== tempId));
             
             // Restore scroll position after error
             setTimeout(() => {
                 if (contentScrollRef.current) {
                     contentScrollRef.current.scrollTop = scrollTop;
                 }
             }, 0);
        });
    }

    if (activeType === 'planItem' && overType === 'weekColumn' && overWeekStartDate) {
        const planItemId = active.data.current?.planItemId as string;
        const originalWeekStartDate = active.data.current?.currentWeekStartDate as Date;
        const newWeekStartDateString = formatDate(overWeekStartDate);
        const originalWeekString = formatDate(originalWeekStartDate);

        if (newWeekStartDateString === originalWeekString) return;

        const originalItems = [...planItems];
        setPlanItems(prev => prev.map(item => 
            item.id === planItemId ? { ...item, weekStartDate: overWeekStartDate } : item
        ));

        updatePlanItem({ 
            planItemId,
            classId: currentClassId,
            newWeekStartDate: newWeekStartDateString,
        }).then(result => {
            if (result.error) {
                toast.error(`Failed to move item: ${result.error}`);
                setPlanItems(originalItems);
            } else if (result.success) {
                toast.success('Item moved successfully!');
            } else {
                toast.warning('Failed to move item, please try again.');
                setPlanItems(originalItems);
            }
        }).catch(err => {
             console.error("Error calling updatePlanItem:", err);
             toast.error('An unexpected error occurred.');
             setPlanItems(originalItems);
        });
    }
  };

  const contentGroupMap = useMemo(() => {
    return new Map(availableContentGroups.map(cg => [cg.contentGroupId, cg.contentGroupName]));
  }, [availableContentGroups]);

  if (!currentClassId) {
      return (
          <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Please select a class first.</p>
          </div>
      );
  }

  // Check if terms are available
  if (!terms || terms.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="max-w-md space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900">No Term Dates Set</h2>
                  <p className="text-muted-foreground">
                      You need to set up term dates before you can start planning curriculum content. 
                      Term dates define the weeks available for planning.
                  </p>
                  <div className="pt-4">
                      <button
                          onClick={() => window.location.href = '/dashboard/settings'}
                          className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-medium transition-colors"
                      >
                          Go to Settings to Set Term Dates
                      </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                      Once term dates are configured, you'll be able to drag and drop curriculum content onto specific weeks.
                  </p>
              </div>
          </div>
      );
  }

  return (
    <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full"> 
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h1 className="text-xl font-semibold">
            Planning: {classData?.name ?? 'Loading...'} ({classData?.calendarYear})
          </h1>
          <Select
            onValueChange={handleTermChange}
            value={selectedTermNumber?.toString() ?? ''}
            disabled={terms.length === 0}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Term..." />
            </SelectTrigger>
            <SelectContent>
              {terms.length > 0 ? (
                terms.map((term) => (
                  <SelectItem key={term.termNumber} value={term.termNumber.toString()}>
                    Term {term.termNumber}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-terms" disabled>
                  No terms defined
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Content groups */}
          <aside className="w-64 border-r p-2 flex flex-col h-full flex-shrink-0">
            <div className="p-2 space-y-2 flex-shrink-0">
              <h2 className="text-lg font-medium">Available Content</h2>
              <div className="text-xs text-muted-foreground">
                {unplannedContentGroups.length} unplanned • {plannedContentGroups.length} allocated
              </div>
              <Input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            {/* Content groups area - Make this scrollable */}
            <div className="flex-grow overflow-y-auto mt-2 pr-2" ref={contentScrollRef}>
              {/* Unplanned Content Groups */}
              {unplannedContentGroups.map(cg => (
                <DraggableContentGroup key={cg.contentGroupId} cg={cg} />
              ))}
              
              {/* Divider and Planned Content Groups */}
              {plannedContentGroups.length > 0 && (
                <>
                  <div className="my-4 border-t border-gray-200">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">Already Allocated</span>
                      </div>
                    </div>
                  </div>
                  
                  {plannedContentGroups.map(cg => (
                    <div key={`planned-${cg.contentGroupId}`} className="opacity-60">
                      <DraggableContentGroup cg={cg} />
                    </div>
                  ))}
                </>
              )}
              
              {/* Empty state when no content groups match search */}
              {unplannedContentGroups.length === 0 && plannedContentGroups.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No content groups match your search.</p>
                </div>
              )}
            </div>
          </aside>

          {/* Main content area - Week columns */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {weeksInSelectedTerm.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">No Weeks Available</h3>
                  <p className="text-muted-foreground">
                    {selectedTerm 
                      ? `Term ${selectedTerm.termNumber} has no valid weeks. Please check that the term dates are set correctly in settings.`
                      : "Please select a term to view the planning weeks."
                    }
                  </p>
                  {selectedTerm && (
                    <div className="pt-2">
                      <button
                        onClick={() => window.location.href = '/dashboard/settings'}
                        className="inline-flex items-center px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium transition-colors"
                      >
                        Check Settings
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Make this scrollable horizontally */
              <div className="flex-1 overflow-x-auto">
                <div className="flex flex-nowrap space-x-2 p-2 h-full min-h-full">
                  {weeksInSelectedTerm.map(week => (
                    <DroppableWeekColumn key={week.toISOString()} weekStartDate={week}>
                      {planItems
                        .filter(item => formatDate(item.weekStartDate) === formatDate(week))
                        .map(item => (
                          <DraggablePlanItem 
                            key={item.id} 
                            item={item} 
                            contentGroupName={contentGroupMap.get(item.contentGroupId)} 
                            contentGroupData={item.contentGroupId ? availableContentGroups.find(cg => cg.contentGroupId === item.contentGroupId) : undefined}
                          />
                        ))}
                    </DroppableWeekColumn>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeDragItem?.data.current?.type === 'contentGroup' && (
            <DraggableContentGroup cg={activeDragItem.data.current.data} isOverlay />
          )}
                     {activeDragItem?.data.current?.type === 'planItem' && activeDragItem.data.current && (
             <DraggablePlanItem 
               item={activeDragItem.data.current.data}
               contentGroupName={contentGroupMap.get(activeDragItem.data.current.contentGroupId)}
               contentGroupData={activeDragItem.data.current.data?.contentGroupId ? availableContentGroups.find(cg => cg.contentGroupId === activeDragItem.data.current!.data.contentGroupId) : undefined}
               isOverlay 
             />
           )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}