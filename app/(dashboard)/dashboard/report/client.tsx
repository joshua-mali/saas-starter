"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Assuming Shadcn UI Table
import Link from 'next/link';
import React from 'react';

// Matches the server component's expected structure
type ProcessedStudentReportData = {
    studentId: string;
    studentFirstName: string;
    studentLastName: string;
    overallAverage: number | null;
    subjectAverages: Map<number, { name: string; average: number | null; outcomes: Map<number, { name: string; average: number | null }> }>;
    topContentGroupsBySubject: Map<number, Array<{ id: number; name: string; gradeName: string | null }>>;
    bottomContentGroupsBySubject: Map<number, Array<{ id: number; name: string; gradeName: string | null }>>;
};

interface ClassReportClientProps {
    classId: string;
    studentReportData: ProcessedStudentReportData[];
    subjectHeaders: { id: number; name: string; outcomes: Array<{ id: number; name: string }> }[];
}

// Helper to format grade numbers (e.g., to 1 decimal place)
const formatAverage = (avg: number | null): string => {
    if (avg === null || isNaN(avg)) return '-';
    return avg.toFixed(1);
};

export default function ClassReportClient({ classId, studentReportData, subjectHeaders }: ClassReportClientProps) {

    console.log("Client Component Render: Received", studentReportData.length, "students and", subjectHeaders.length, "subjects");

    // Calculate total columns needed for proper colspan
    const totalOutcomeColumns = subjectHeaders.reduce((sum, subject) => sum + subject.outcomes.length, 0);
    const totalTopBottomColumns = subjectHeaders.length * 2; // 2 columns per subject (top 3 + bottom 3)

    return (
        <Table>
            <TableHeader>
                {/* First header row - Subject groupings */}
                <TableRow>
                    <TableHead rowSpan={2} className="border-b">Student Name</TableHead>
                    <TableHead rowSpan={2} className="text-center border-b">Overall Avg</TableHead>
                    {subjectHeaders.map(subject => (
                        <TableHead key={`subject-${subject.id}`} colSpan={subject.outcomes.length} className="text-center border-b">
                            {subject.name}
                        </TableHead>
                    ))}
                    {subjectHeaders.map(subject => (
                        <TableHead key={`subject-top-bottom-${subject.id}`} colSpan={2} className="text-center border-b">
                            {subject.name} - Top/Bottom 3
                        </TableHead>
                    ))}
                </TableRow>
                {/* Second header row - Outcome details and Top/Bottom labels */}
                <TableRow>
                    {subjectHeaders.map(subject => 
                        subject.outcomes.map(outcome => (
                            <TableHead key={`outcome-${outcome.id}`} className="text-center text-xs">
                                {outcome.name} Avg
                            </TableHead>
                        ))
                    )}
                    {subjectHeaders.map(subject => (
                        <React.Fragment key={`top-bottom-${subject.id}`}>
                            <TableHead className="text-center text-xs">Top 3</TableHead>
                            <TableHead className="text-center text-xs">Bottom 3</TableHead>
                        </React.Fragment>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {studentReportData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={2 + totalOutcomeColumns + totalTopBottomColumns} className="text-center text-muted-foreground">
                            No student data available for this report.
                        </TableCell>
                    </TableRow>
                )}
                {studentReportData.map(student => (
                    <TableRow key={student.studentId}>
                        <TableCell className="font-medium">
                            <Link href={`/dashboard/students/${student.studentId}?classId=${classId}`}>
                                <span className="hover:underline cursor-pointer text-blue-600">
                                    {student.studentFirstName} {student.studentLastName}
                                </span>
                            </Link>
                        </TableCell>
                        <TableCell className="text-center">
                            {formatAverage(student.overallAverage)}
                        </TableCell>
                        {/* Outcome averages grouped by subject */}
                        {subjectHeaders.map(subject => {
                            const subjectData = student.subjectAverages.get(subject.id);
                            return subject.outcomes.map(outcome => (
                                <TableCell key={`${student.studentId}-outcome-${outcome.id}`} className="text-center">
                                    {formatAverage(subjectData?.outcomes.get(outcome.id)?.average ?? null)}
                                </TableCell>
                            ));
                        })}
                        {/* Top/Bottom content groups by subject */}
                        {subjectHeaders.map(subject => {
                            const topGroups = student.topContentGroupsBySubject.get(subject.id) || [];
                            const bottomGroups = student.bottomContentGroupsBySubject.get(subject.id) || [];
                            
                            return (
                                <React.Fragment key={`${student.studentId}-groups-${subject.id}`}>
                                    <TableCell className="text-xs">
                                        {topGroups.length > 0 ? (
                                            topGroups.map(cg => (
                                                <div key={`top-${cg.id}`}>
                                                    {cg.name}{cg.gradeName ? ` (${cg.gradeName})` : ''}
                                                </div>
                                            ))
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {bottomGroups.length > 0 ? (
                                            bottomGroups.map(cg => (
                                                <div key={`bottom-${cg.id}`}>
                                                    {cg.name}{cg.gradeName ? ` (${cg.gradeName})` : ''}
                                                </div>
                                            ))
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </TableCell>
                                </React.Fragment>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
} 