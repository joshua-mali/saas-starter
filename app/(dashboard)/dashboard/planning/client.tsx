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
import { addPlanItem, updatePlanItem, type ActionResult } from './actions'

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
  currentClassId: number;
}

// Helper to get weeks between two dates
function getWeeksBetween(startDate: Date, endDate: Date): Date[] {
  const weeks: Date[] = [];
  let currentDate = new Date(startDate);

  // Adjust to the previous Monday
  const dayOfWeek = currentDate.getDay(); // Sunday = 0, Monday = 1, ...
  const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  currentDate = new Date(currentDate.setDate(diff));
  currentDate.setHours(0, 0, 0, 0); // Normalize time

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
  classData,
  terms,
  availableContentGroups,
  initialPlanItems,
  currentClassId,
}: PlanningBoardClientProps) {
  const [selectedTermNumber, setSelectedTermNumber] = useState<number | null>(terms[0]?.termNumber ?? null);
  const [planItems, setPlanItems] = useState<ClassCurriculumPlanItem[]>(initialPlanItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDragItem, setActiveDragItem] = useState<Active | null>(null);

  // Debug log for initial data
  useEffect(() => {
    console.log('Initial plan items:', initialPlanItems.map(item => ({
      ...item,
      weekStartDate: new Date(item.weekStartDate).toISOString().split('T')[0]
    })));
  }, [initialPlanItems]);

  // Update planItems if initialPlanItems changes
  useEffect(() => {
    setPlanItems(initialPlanItems);
  }, [initialPlanItems]);

  const selectedTerm = useMemo(() => {
    return terms.find(t => t.termNumber === selectedTermNumber);
  }, [selectedTermNumber, terms]);

  // Helper function to format dates consistently
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // Helper function to normalize dates for comparison
  const normalizeDate = (date: Date | string) => {
    const d = new Date(date);
    // Set to midnight UTC to avoid timezone issues
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  };

  const weeksInSelectedTerm = useMemo(() => {
    if (!selectedTerm?.startDate || !selectedTerm?.endDate) return [];
    const start = new Date(selectedTerm.startDate);
    const end = new Date(selectedTerm.endDate);
    
    console.log('Term dates:', {
      start: formatDate(start),
      end: formatDate(end)
    });
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    const weeks = getWeeksBetween(start, end);
    
    console.log('Generated weeks:', weeks.map(w => formatDate(w)));
    
    return weeks;
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
    const termNum = parseInt(value, 10);
    setSelectedTermNumber(isNaN(termNum) ? null : termNum);
  };

  // DND Drag End Handler
  const sensors = useSensors(
    useSensor(PointerSensor, { // Basic pointer sensor
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
    // Add KeyboardSensor if needed for accessibility
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // --- Logic for Adding Item ---
    if (activeType === 'contentGroup' && overType === 'weekColumn') {
      const contentGroupId = active.data.current?.contentGroupId;
      const weekStartDate = over.data.current?.weekStartDate;

      if (contentGroupId && weekStartDate instanceof Date) {
        const tempId = `optimistic-${Date.now()}`;
        const newItem: ClassCurriculumPlanItem = {
          id: tempId as any,
          classId: classData.id,
          contentGroupId: contentGroupId,
          weekStartDate: weekStartDate,
          durationWeeks: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Debug log
        console.log('Adding new item:', newItem);
        
        setPlanItems(prev => [...prev, newItem]);

        addPlanItem({ classId: currentClassId, contentGroupId, weekStartDate })
          .then((result: ActionResult) => {
            if (result.error) {
              toast.error(`Failed to add plan item: ${result.error}`);
              setPlanItems(prev => prev.filter(item => String(item.id) !== tempId));
            } else if (result.success && result.newItem) {
              toast.success('Item added to plan!');
              console.log('Server returned new item:', result.newItem);
              setPlanItems(prev => prev.map(item => 
                String(item.id) === tempId ? result.newItem! : item
              ));
            } else {
              setPlanItems(prev => prev.filter(item => String(item.id) !== tempId));
            }
          });
      }
    }
    // --- Logic for Moving Item ---
    else if (activeType === 'planItem' && overType === 'weekColumn') {
      const planItemId = active.data.current?.planItemId;
      const currentWeek = active.data.current?.currentWeekStartDate;
      const newWeekStartDate = over.data.current?.weekStartDate;

      if (planItemId && newWeekStartDate instanceof Date) {
        const originalItems = [...planItems];
        
        // Debug log
        console.log('Moving item:', { planItemId, from: currentWeek, to: newWeekStartDate });
        
        setPlanItems(prev => prev.map(item =>
          item.id === planItemId ? { ...item, weekStartDate: newWeekStartDate } : item
        ));

        updatePlanItem({ planItemId, weekStartDate: newWeekStartDate })
          .then((result: ActionResult) => {
            if (result.error) {
              toast.error(`Failed to move plan item: ${result.error}`);
              setPlanItems(originalItems);
            } else if (result.success) {
              toast.success('Item moved!');
            }
          });
      }
    }
  };

  // Create a map for quick lookup of content group names
  const contentGroupMap = useMemo(() => {
    return new Map(availableContentGroups.map(cg => [cg.contentGroupId, cg.contentGroupName]));
  }, [availableContentGroups]);

  return (
    // Wrap in DndContext
    <DndContext
        sensors={sensors} // Add sensors
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        // onDragCancel={handleDragCancel} // Optional: Clear active item on cancel
    >
      <div className="flex flex-col h-full"> 
        {/* Header: Class Name, Term Selector */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h1 className="text-xl font-semibold">
            Planning: {classData.name} ({classData.calendarYear})
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

        {selectedTerm ? (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Panel */}
            <div className="w-1/5 max-w-[240px] flex-shrink-0 border-r flex flex-col min-h-0">
              <div className="p-2 space-y-2 flex-shrink-0">
                <h2 className="text-lg font-medium">Available Content</h2>
                <Input
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 p-2">
                  {filteredContentGroups.map((cg) => (
                    <DraggableContentGroup key={cg.contentGroupId} cg={cg} />
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>

            {/* Right Panel */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ScrollArea className="flex-1" type="always">
                <div className="flex space-x-2 p-2 min-w-fit">
                  {weeksInSelectedTerm.map((weekStartDate) => {
                    // Use normalized date comparison
                    const itemsInWeek = planItems.filter(item => {
                      const itemDate = normalizeDate(item.weekStartDate);
                      const weekDate = normalizeDate(weekStartDate);
                      const matches = itemDate === weekDate;
                      
                      console.log('Week comparison:', {
                        weekStartDate: formatDate(weekStartDate),
                        itemWeekStart: formatDate(item.weekStartDate),
                        itemId: item.id,
                        contentGroupId: item.contentGroupId,
                        matches
                      });
                      
                      return matches;
                    });

                    // Log items found for this week
                    if (itemsInWeek.length > 0) {
                      console.log(`Items for week ${formatDate(weekStartDate)}:`, 
                        itemsInWeek.map(item => ({
                          id: item.id,
                          contentGroupId: item.contentGroupId,
                          name: contentGroupMap.get(item.contentGroupId)
                        }))
                      );
                    }

                    return (
                      <DroppableWeekColumn key={weekStartDate.toISOString()} weekStartDate={weekStartDate}>
                        {itemsInWeek.map(item => (
                          <DraggablePlanItem
                            key={item.id}
                            item={item}
                            contentGroupName={contentGroupMap.get(item.contentGroupId)}
                          />
                        ))}
                      </DroppableWeekColumn>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Please define term dates in the settings page or select a term to start planning.</p>
          </div>
        )}
      </div>

      {/* Drag Overlay Implementation */}
      <DragOverlay dropAnimation={null}> {/* Basic overlay, customize animation if needed */} 
        {activeDragItem ? (
            activeDragItem.data.current?.type === 'contentGroup' ? (
                <DraggableContentGroup cg={activeDragItem.data.current.data} isOverlay />
            ) : activeDragItem.data.current?.type === 'planItem' ? (
                <DraggablePlanItem
                    item={activeDragItem.data.current.data}
                    contentGroupName={contentGroupMap.get(activeDragItem.data.current.contentGroupId)}
                    isOverlay
                 />
            ) : null
        ) : null}
      </DragOverlay>

    </DndContext>
  );
} 