"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Assuming Shadcn UI Table
import Link from 'next/link';

// Matches the server component's expected structure
type ProcessedStudentReportData = {
    studentId: string;
    studentFirstName: string;
    studentLastName: string;
    overallAverage: number | null;
    outcomeAverages: Map<number, { name: string; average: number | null }>;
    topContentGroups: Array<{ id: number; name: string; gradeName: string | null }>;
    bottomContentGroups: Array<{ id: number; name: string; gradeName: string | null }>;
};

interface ClassReportClientProps {
    classId: string;
    studentReportData: ProcessedStudentReportData[];
    outcomeHeaders: { id: number; name: string }[];
}

// Helper to format grade numbers (e.g., to 1 decimal place)
const formatAverage = (avg: number | null): string => {
    if (avg === null || isNaN(avg)) return '-';
    return avg.toFixed(1);
};

export default function ClassReportClient({ classId, studentReportData, outcomeHeaders }: ClassReportClientProps) {

    console.log("Client Component Render: Received", studentReportData.length, "students and", outcomeHeaders.length, "outcomes");

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-center">Overall Avg</TableHead>
                    {outcomeHeaders.map(header => (
                        <TableHead key={header.id} className="text-center">{header.name} Avg</TableHead>
                    ))}
                    <TableHead>Top 3 Content Groups</TableHead>
                    <TableHead>Bottom 3 Content Groups</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {studentReportData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4 + outcomeHeaders.length} className="text-center text-muted-foreground">
                            No student data available for this report.
                        </TableCell>
                    </TableRow>
                )}
                {studentReportData.map(student => (
                    <TableRow key={student.studentId}>
                        <TableCell className="font-medium">
                            {/* Link to student profile page - updated format */}
                            <Link href={`/dashboard/students/${student.studentId}?classId=${classId}`}>
                                <span className="hover:underline cursor-pointer text-blue-600">
                                    {student.studentFirstName} {student.studentLastName}
                                </span>
                            </Link>
                        </TableCell>
                        <TableCell className="text-center">
                            {formatAverage(student.overallAverage)}
                        </TableCell>
                        {outcomeHeaders.map(header => (
                            <TableCell key={header.id} className="text-center">
                                {formatAverage(student.outcomeAverages.get(header.id)?.average ?? null)}
                            </TableCell>
                        ))}
                        <TableCell className="text-xs">
                            {student.topContentGroups.length > 0 ? (
                                student.topContentGroups.map(cg => (
                                    <div key={`top-${cg.id}`}>
                                        {cg.name}{cg.gradeName ? ` (${cg.gradeName})` : ''}
                                    </div>
                                ))
                            ) : (
                                <span>-</span>
                            )}
                        </TableCell>
                        <TableCell className="text-xs">
                            {student.bottomContentGroups.length > 0 ? (
                                student.bottomContentGroups.map(cg => (
                                    <div key={`bottom-${cg.id}`}>
                                        {cg.name}{cg.gradeName ? ` (${cg.gradeName})` : ''}
                                    </div>
                                ))
                            ) : (
                                <span>-</span>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
} 