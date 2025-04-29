'use client'

import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { UserCog } from 'lucide-react'; // For loading indicators and icons
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { addStudentToClass } from './actions'; // Corrected action name

// Type for student data received from server
// (Ideally, move this type definition to a shared file)
type StudentListData = {
    enrollmentId: number;
    studentId: number;
    firstName: string;
    lastName: string;
};

interface StudentsPageClientProps {
  currentClassId: number | null; // ID of the globally selected class
  students: StudentListData[];   // Students for the selected class, passed from server
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? 'Adding Student...' : 'Add Student'}
    </Button>
  )
}

export default function StudentsPageClient({
  currentClassId, 
  students: initialStudents // Rename prop for clarity
}: StudentsPageClientProps) {
  const [state, formAction] = useActionState(addStudentToClass, { error: null, success: false });
  const [searchTerm, setSearchTerm] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Effect to show toast messages for addStudent action
  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    } else if (state.success) {
      toast.success('Student added successfully!')
      formRef.current?.reset()
      // Optionally, trigger re-fetch or rely on server revalidation if needed
    }
  }, [state])

  // Filter students based on search term (client-side filtering)
  const filteredStudents = initialStudents.filter(student => 
    `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* --- Add Student Card --- */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Student</CardTitle>
          <CardDescription>
Enter the details for the new student. They will be added to the currently selected class: {currentClassId ? `(Class ID: ${currentClassId})` : '(No class selected)'}
          </CardDescription>
        </CardHeader>
        {/* Pass currentClassId to the form action if needed by the action */}
        <form ref={formRef} action={(formData) => {
            if (!currentClassId) {
                toast.error("Please select a class before adding a student.");
                return;
            }
            formData.append('classId', currentClassId.toString()); // Add classId to form data
            formAction(formData); // Call the action with formData
        }}>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" placeholder="e.g., John" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" placeholder="e.g., Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="externalId">External ID (Optional)</Label>
              <Input id="externalId" name="externalId" placeholder="School ID" />
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>

      {/* --- Student List Card --- */}
      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>
            {currentClassId 
              ? `Students enrolled in the selected class (ID: ${currentClassId}).`
              : "Please select a class to view students."
            }
          </CardDescription>
           <div className="pt-2">
              <Input 
                placeholder="Search students in current class..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
                disabled={!currentClassId} // Disable search if no class selected
              />
            </div>
        </CardHeader>
        <CardContent>
          {currentClassId ? (
            filteredStudents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {/* Add other relevant headers if needed */}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell>
                        {student.firstName} {student.lastName}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Update link format */}
                        <Link href={`/dashboard/students/${student.studentId}?classId=${currentClassId}`} passHref>
                            <Button variant="outline" size="sm">
                                <UserCog className="mr-1 h-4 w-4" /> View Details
                            </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                {initialStudents.length === 0 ? "No students found in this class." : "No students match your search."}
              </p>
            )
          ) : (
             <p className="text-sm text-muted-foreground text-center">Select a class from the dropdown above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 