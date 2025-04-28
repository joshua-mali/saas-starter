'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import type { Class, Stage, Student } from '@/lib/db/schema';
import React from 'react';

// Reuse the type defined in page.tsx for the processed data
// (Ideally, move this type definition to a shared file)
type ProcessedNode = {
    id: number;
    name: string;
    type: 'subject' | 'outcome' | 'focusArea' | 'focusGroup' | 'contentGroup' | 'contentPoint';
    averageGrade?: number | null; // Average of descendants (null if no grades)
    gradeScaleId?: number | null; // Direct grade if applicable (contentGroup/Point)
    gradeName?: string | null;
    children: Record<number, ProcessedNode>;
    description?: string | null; // For Content Points
};

interface StudentOverviewClientProps {
    student: Student;
    classData: Class & { stage: Stage | null };
    structuredGrades: Record<number, ProcessedNode>; // Map of Subject IDs to ProcessedNodes
}

// Helper to format the average grade for display
function formatAverage(average: number | null | undefined): string {
    if (average === null || average === undefined) {
        return '-';
    }
    return average.toFixed(1); // Display average to one decimal place
}

// Recursive component to render each node in the hierarchy
const RenderHierarchyNode: React.FC<{ node: ProcessedNode, level: number }> = ({ node, level }) => {
    const hasChildren = Object.keys(node.children).length > 0;
    const averageDisplay = formatAverage(node.averageGrade);
    const directGradeDisplay = node.gradeName ? `(${node.gradeName})` : '';

    // Base padding + incremental padding per level
    const paddingLeft = `${1 + level * 1.5}rem`;

    // Leaf nodes (Content Points) or Content Groups with direct grades
    if (node.type === 'contentPoint' || (node.type === 'contentGroup' && !hasChildren)) {
        return (
            <div className="py-2 text-sm flex justify-between items-center" style={{ paddingLeft }}>
                <div>
                    <span className="font-medium">{node.name}</span>
                    {node.description && <p className="text-xs text-muted-foreground pl-2">{node.description}</p>}
                </div>
                <span className="font-semibold text-base pr-4">
                    {averageDisplay !== '-' ? `${averageDisplay} ${directGradeDisplay}`.trim() : '-'}
                </span>
            </div>
        );
    }

    // Nodes with children - render as an Accordion item
    return (
        <AccordionItem value={`node-${node.type}-${node.id}`} className="border-b-0">
            <AccordionTrigger
                className="py-2 hover:no-underline [&[data-state=open]>div>svg]:rotate-180"
                style={{ paddingLeft }}
            >
                <div className="flex-1 flex justify-between items-center pr-4">
                    <span className="font-medium text-left">{node.name}</span>
                    {/* Display average for levels above content group/point */}
                    {(node.type !== 'contentGroup') && (
                         <span className={`font-semibold text-base ml-2 ${averageDisplay === '-' ? 'text-muted-foreground' : ''}`}>
                            Avg: {averageDisplay}
                        </span>
                    )}
                    {/* Display direct grade if it's a content group */}
                     {(node.type === 'contentGroup') && (
                         <span className={`font-semibold text-base ml-2 ${averageDisplay === '-' ? 'text-muted-foreground' : ''}`}>
                           {/* Display direct grade/avg for content group */}
                           {averageDisplay !== '-' ? `${averageDisplay} ${directGradeDisplay}`.trim() : '-'}
                        </span>
                    )}
                </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0 pl-4">
                {/* Recursively render children */}
                {Object.values(node.children).map(childNode => (
                    <RenderHierarchyNode key={`${childNode.type}-${childNode.id}`} node={childNode} level={level + 1} />
                ))}
            </AccordionContent>
        </AccordionItem>
    );
};


export default function StudentOverviewClient({
    student,
    classData,
    structuredGrades
}: StudentOverviewClientProps) {

    return (
        <div>
            {/* Render top-level Accordion for Subjects */}
            <Accordion type="multiple" className="w-full">
                {Object.values(structuredGrades).map(subjectNode => (
                    <RenderHierarchyNode key={`subject-${subjectNode.id}`} node={subjectNode} level={0} />
                ))}
                {Object.keys(structuredGrades).length === 0 && (
                    <p className="text-muted-foreground text-center p-4">No curriculum data found for this class's stage.</p>
                )}
            </Accordion>
        </div>
    );
}
