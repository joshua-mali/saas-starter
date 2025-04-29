'use client'

import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
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
import { useEffect, useMemo, useState } from 'react'
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
  currentClassId: number | null;
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
      className={cn("cursor-grab rounded border bg-card p-2 text-sm shadow-sm", isOverlay && "shadow-lg")}
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
  isOverlay?: boolean; // Flag for overlay rendering
}
function DraggablePlanItem({ item, contentGroupName, isOverlay }: DraggablePlanItemProps) {
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
       return <div ref={setNodeRef} className="opacity-30 h-10"></div>; // Placeholder
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab rounded border bg-card p-2 text-sm shadow", isOverlay && "shadow-lg")}
    >
      <p>{contentGroupName || `Content Group ${item.contentGroupId}`} (ID: {item.id})</p>
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
        "w-48 flex-shrink-0 rounded border p-2 flex flex-col", 
        isOver ? "bg-primary/10 border-primary" : "bg-muted/40"
      )}
    >
      <h3 className="mb-2 text-center font-medium flex-shrink-0">Week of {formattedDate}</h3>
      <ScrollArea className="flex-grow">
           <div className="space-y-1 h-full min-h-full"> 
              {children}
           </div>
           <ScrollBar orientation="vertical" /> 
       </ScrollArea>
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
  const currentClassId = classIdFromUrl ? parseInt(classIdFromUrl, 10) : initialClassId;

  const [planItems, setPlanItems] = useState<ClassCurriculumPlanItem[]>(initialPlanItems);
  const [classData, setClassData] = useState(initialClassData);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDragItem, setActiveDragItem] = useState<Active | null>(null);
  const [selectedTermNumber, setSelectedTermNumber] = useState<number | null>(terms[0]?.termNumber ?? null);

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

        // Optimistic Update: Add a temporary item
        const tempId = `optimistic-${Date.now()}`;
        const optimisticItem: ClassCurriculumPlanItem = {
            id: tempId as any, // Temporary ID
            classId: currentClassId, 
            contentGroupId,
            weekStartDate: overWeekStartDate,
            durationWeeks: 1, // Add default duration
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setPlanItems(prev => [...prev, optimisticItem]);

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
        }).catch(err => {
             console.error("Error calling addPlanItem:", err);
             toast.error('An unexpected error occurred.');
             // Revert optimistic update - compare item.id as string
             setPlanItems(prev => prev.filter(item => String(item.id) !== tempId));
        });
    }

    if (activeType === 'planItem' && overType === 'weekColumn' && overWeekStartDate) {
        const planItemId = active.data.current?.planItemId as number;
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
          <aside className="w-64 border-r p-2 flex flex-col">
            <div className="p-2 space-y-2 flex-shrink-0">
              <h2 className="text-lg font-medium">Available Content</h2>
              <Input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <ScrollArea className="flex-grow mt-2">
                <div className="space-y-1">
                   {filteredContentGroups.map(cg => (
                      <DraggableContentGroup key={cg.contentGroupId} cg={cg} />
                   ))}
                </div>
               <ScrollBar orientation="vertical" />
            </ScrollArea>
          </aside>

          <ScrollArea className="flex-1">
            <div className="flex space-x-2 p-2 h-full min-h-full">
               {weeksInSelectedTerm.map(week => (
                 <DroppableWeekColumn key={week.toISOString()} weekStartDate={week}>
                   {planItems
                     .filter(item => formatDate(item.weekStartDate) === formatDate(week))
                     .map(item => (
                       <DraggablePlanItem 
                         key={item.id} 
                         item={item} 
                         contentGroupName={contentGroupMap.get(item.contentGroupId)} 
                       />
                     ))}
                 </DroppableWeekColumn>
               ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

         <DragOverlay>
           {activeDragItem?.data.current?.type === 'contentGroup' && (
             <DraggableContentGroup cg={activeDragItem.data.current.data} isOverlay />
           )}
           {activeDragItem?.data.current?.type === 'planItem' && (
             <DraggablePlanItem 
               item={activeDragItem.data.current.data}
               contentGroupName={contentGroupMap.get(activeDragItem.data.current.contentGroupId)}
               isOverlay 
             />
           )}
         </DragOverlay>
      </div>
    </DndContext>
  );
} 