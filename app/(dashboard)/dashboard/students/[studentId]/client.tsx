'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Type for Top/Bottom Groups (Should match server definition)
type RankedGroup = {
    id: number;
    name: string;
    gradeName: string | null;
    averageGrade: number | null;
};

interface StudentOverviewClientProps {
    student: Student;
    classData: Class & { stage: Stage | null };
    structuredGrades: Record<number, ProcessedNode>; // Map of Subject IDs to ProcessedNodes
    topContentGroups: RankedGroup[]; // Add top groups prop
    bottomContentGroups: RankedGroup[]; // Add bottom groups prop
}

// Helper to format the average grade for display
function formatAverage(average: number | null | undefined): string {
    if (average === null || average === undefined || isNaN(average)) {
        return '-';
    }
    return average.toFixed(1); // Display average to one decimal place
}

// Recursive component to render each node in the hierarchy
const RenderHierarchyNode: React.FC<{ node: ProcessedNode, level: number }> = ({ node, level }) => {
    const hasChildren = Object.keys(node.children).length > 0;
    const averageDisplay = formatAverage(node.averageGrade);
    const directGradeDisplay = node.gradeName ? `(${node.gradeName})` : '';
    const paddingLeft = `${1 + level * 1.5}rem`;

    // Case 1: Content Point (Always a leaf)
    if (node.type === 'contentPoint') {
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

    // Case 2: Node with Children (Expandable Accordion Item)
    if (hasChildren) {
        return (
            <AccordionItem value={`node-${node.type}-${node.id}`} className="border-b-0">
                <AccordionTrigger
                    className="py-2 hover:no-underline [&[data-state=open]>div>svg]:rotate-180"
                    style={{ paddingLeft }}
                >
                    <div className="flex-1 flex justify-between items-center pr-4">
                        <span className="font-medium text-left">{node.name}</span>
                         {/* Display average or direct grade based on type */}
                        <span className={`font-semibold text-base ml-2 ${averageDisplay === '-' ? 'text-muted-foreground' : ''}`}>
                            {(node.type === 'contentGroup' && node.gradeScaleId !== null) 
                                ? (averageDisplay !== '-' ? `${averageDisplay} ${directGradeDisplay}`.trim() : '-')
                                : `Avg: ${averageDisplay}`
                            }
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0 pl-4">
                    {Object.values(node.children).map(childNode => (
                        <RenderHierarchyNode key={`${childNode.type}-${childNode.id}`} node={childNode} level={level + 1} />
                    ))}
                </AccordionContent>
            </AccordionItem>
        );
    }

    // Case 3: Other Leaf Node (e.g., Content Group without children/grades, Focus Group without children)
    // Render non-expandable item 
    return (
        <div className="py-2 text-sm flex justify-between items-center font-medium" style={{ paddingLeft }}>
            <span>{node.name}</span>
             <span className={`font-semibold text-base pr-4 ${averageDisplay === '-' ? 'text-muted-foreground' : ''}`}>
                 {(node.type === 'contentGroup')
                    ? (averageDisplay !== '-' ? `${averageDisplay} ${directGradeDisplay}`.trim() : '-')
                    : `Avg: ${averageDisplay}`
                 }
             </span>
        </div>
    );
};


export default function StudentOverviewClient({
    student,
    classData,
    structuredGrades,
    topContentGroups,
    bottomContentGroups
}: StudentOverviewClientProps) {

    return (
        <div className="flex flex-col h-[calc(100vh-200px)]">
            <div className="flex-1 overflow-y-auto border rounded-md mb-4">
                <Accordion type="multiple" className="w-full p-2">
                    {Object.values(structuredGrades).map(subjectNode => (
                        <RenderHierarchyNode key={`subject-${subjectNode.id}`} node={subjectNode} level={0} />
                    ))}
                    {Object.keys(structuredGrades).length === 0 && (
                        <p className="text-muted-foreground text-center p-4">No curriculum data found for this class's stage.</p>
                    )}
                </Accordion>
            </div>

            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Performance Highlights</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-4">
                        <div>
                            <h4 className="font-semibold mb-1">Top 3 Content Groups</h4>
                            {topContentGroups.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1">
                                    {topContentGroups.map(cg => (
                                        <li key={`top-${cg.id}`}>
                                            {cg.name} 
                                            <span className="text-muted-foreground ml-1">
                                                ({cg.gradeName ?? `Avg: ${formatAverage(cg.averageGrade)}`})
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground">Not enough data.</p>
                            )}
                        </div>
                         <div>
                            <h4 className="font-semibold mb-1">Bottom 3 Content Groups</h4>
                             {bottomContentGroups.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1">
                                    {bottomContentGroups.map(cg => (
                                        <li key={`bottom-${cg.id}`}>
                                            {cg.name} 
                                             <span className="text-muted-foreground ml-1">
                                                ({cg.gradeName ?? `Avg: ${formatAverage(cg.averageGrade)}`})
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground">Not enough data or fewer than 4 groups graded.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Comments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">Teacher comments will appear here.</p>
                        {/* TODO: Add comment input and display list later */}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
