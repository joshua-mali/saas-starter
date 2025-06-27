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

// Type for Grade Comments (Should match server definition)
type GradeComment = {
    id: string; // assessment id
    contentType: 'contentGroup' | 'contentPoint';
    contentId: number;
    contentName: string;
    contentDescription?: string | null; // For content points
    gradeName: string | null;
    comment: string;
    assessmentDate: Date;
    gradeScaleId: number | null;
};

type StudentComment = {
    id: string;
    title: string | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
};

interface StudentOverviewClientProps {
    student: Student;
    classData: Class & { stage: Stage | null };
    structuredGrades: Record<number, ProcessedNode>; // Map of Subject IDs to ProcessedNodes
    topContentGroups: RankedGroup[]; // Add top groups prop
    bottomContentGroups: RankedGroup[]; // Add bottom groups prop
    gradeComments: GradeComment[]; // Add grade comments prop
    studentComments: StudentComment[]; // Add student comments prop
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
    bottomContentGroups,
    gradeComments,
    studentComments
}: StudentOverviewClientProps) {

    // Helper function to format dates for display
    const formatDisplayDate = (date: Date): string => {
        return new Intl.DateTimeFormat('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(date));
    };

    return (
        <div className="flex flex-col h-[calc(100vh-200px)]">
            {/* 2x2 Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                
                {/* Top Left: Grade Breakdown */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base">Grade Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        <Accordion type="multiple" className="w-full">
                            {Object.values(structuredGrades).map(subjectNode => (
                                <RenderHierarchyNode key={`subject-${subjectNode.id}`} node={subjectNode} level={0} />
                            ))}
                            {Object.keys(structuredGrades).length === 0 && (
                                <p className="text-muted-foreground text-center p-4">No curriculum data found for this class's stage.</p>
                            )}
                        </Accordion>
                    </CardContent>
                </Card>

                {/* Top Right: Performance Highlights */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base">Performance Highlights</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-4 overflow-y-auto">
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

                {/* Bottom Left: Grade Comments */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base">Grade Comments</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-y-auto">
                        {gradeComments.length > 0 ? (
                            <div className="space-y-3">
                                {gradeComments.map(comment => (
                                    <div key={comment.id} className="border-l-2 border-blue-200 pl-3 pb-2">
                                        <div className="flex items-start justify-between mb-1">
                                            <div className="flex-1 min-w-0">
                                                <h5 className="font-medium text-sm truncate" title={comment.contentName}>
                                                    {comment.contentName}
                                                </h5>
                                                {comment.contentDescription && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {comment.contentDescription}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end ml-2 flex-shrink-0">
                                                {comment.gradeName && (
                                                    <span className="text-xs font-semibold text-blue-600 mb-1">
                                                        {comment.gradeName}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDisplayDate(comment.assessmentDate)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded text-left whitespace-pre-wrap">
                                            {comment.comment}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">No grade comments found for this student.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Bottom Right: General Comments */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base">General Comments</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-y-auto">
                        {studentComments.length > 0 ? (
                            <div className="space-y-3">
                                {studentComments.map(comment => (
                                    <div key={comment.id} className="border-l-2 border-green-200 pl-3 pb-2">
                                        <div className="flex items-start justify-between mb-1">
                                            <h5 className="font-medium text-sm">
                                                {comment.title || 'General Comment'}
                                            </h5>
                                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                                {formatDisplayDate(comment.updatedAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded text-left whitespace-pre-wrap">
                                            {comment.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-4">
                                <p className="text-muted-foreground text-sm mb-2">No general comments for this student.</p>
                                <p className="text-xs text-muted-foreground">
                                    General comments can be added to record observations, notes, and other information about the student.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
