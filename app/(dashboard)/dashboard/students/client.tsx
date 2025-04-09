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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type Class, type Student } from '@/lib/db/schema'; // Import types
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { addStudentToClass, getStudentsForClass } from './actions'

// Props passed from the server component
interface StudentsPageClientProps {
  teacherClasses: Pick<Class, 'id' | 'name'>[]
}

// Type for student data fetched from the action
type StudentData = {
  student: Student
  enrollmentStatus: string | null
}

function AddStudentSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? 'Adding Student...' : 'Add Student'}
    </Button>
  )
}

export default function StudentsPageClient({ teacherClasses }: StudentsPageClientProps) {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [students, setStudents] = useState<StudentData[]>([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const router = useRouter()

  const [addStudentState, addStudentFormAction] = useActionState(
    addStudentToClass,
    { error: null, success: false }
  )
  const addStudentFormRef = useRef<HTMLFormElement>(null)

  // Fetch students when class selection changes
  useEffect(() => {
    async function fetchStudents() {
      if (!selectedClassId) {
        setStudents([])
        setFetchError(null)
        return
      }
      setIsLoadingStudents(true)
      setFetchError(null)
      try {
        const result = await getStudentsForClass(selectedClassId)
        if (result.error) {
          setFetchError(result.error)
          setStudents([])
          toast.error(`Failed to fetch students: ${result.error}`)
        } else {
          setStudents(result.students || [])
        }
      } catch (err) {
        console.error(err)
        const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred'
        setFetchError('An error occurred fetching students.')
        toast.error(`Error fetching students: ${errorMsg}`)
        setStudents([])
      }
      setIsLoadingStudents(false)
    }

    fetchStudents()
  }, [selectedClassId])

  // Handle add student form submission result
  useEffect(() => {
    if (addStudentState.error) {
      toast.error(addStudentState.error)
    } else if (addStudentState.success) {
      toast.success('Student added successfully!')
      addStudentFormRef.current?.reset()
      // Refetch students for the current class to show the new student
      if (selectedClassId) {
        setIsLoadingStudents(true) // Indicate loading while refetching
        getStudentsForClass(selectedClassId).then(result => {
          if (!result.error) {
             setStudents(result.students || [])
          }
          setIsLoadingStudents(false)
        })
      }
      // Reset state manually - create a new object for the state setter if needed
      // addStudentState.success = false; // (Avoid direct mutation)
    }
  }, [addStudentState, selectedClassId]) // Depend on state and selectedClassId

  const handleClassChange = (value: string) => {
    const classId = parseInt(value, 10)
    setSelectedClassId(isNaN(classId) ? null : classId)
  }

  // Function to handle navigation to student overview
  const handleStudentClick = (studentId: number) => {
    if (selectedClassId) {
      router.push(`/dashboard/students/${selectedClassId}/${studentId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Class Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Class</CardTitle>
          <CardDescription>Choose a class to view and manage students.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            onValueChange={handleClassChange}
            value={selectedClassId?.toString() ?? ''}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a class..." />
            </SelectTrigger>
            <SelectContent>
              {teacherClasses.length > 0 ? (
                teacherClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id.toString()}>
                    {cls.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-classes-available" disabled>
                  No classes found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClassId && (
        <div className="space-y-6">
          {/* Add Student Form */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Student</CardTitle>
              <CardDescription>Add a new student to the selected class.</CardDescription>
            </CardHeader>
            <form ref={addStudentFormRef} action={addStudentFormAction}>
              {/* Hidden input to pass selectedClassId to the action */}
              <input type="hidden" name="classId" value={selectedClassId} />
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                </div>
              </CardContent>
              <CardFooter>
                <AddStudentSubmitButton />
              </CardFooter>
            </form>
          </Card>

          {/* Student List Table */}
          <Card>
            <CardHeader>
              <CardTitle>Student List</CardTitle>
              <CardDescription>Students enrolled in the selected class.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStudents ? (
                <p>Loading students...</p>
              ) : fetchError ? (
                <p className="text-destructive">Error: {fetchError}</p>
              ) : (
                <Table>
                  <TableCaption>
                    {students.length === 0 ? 'No students found in this class.' : 'A list of students in the class.'}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Last Name</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(({ student, enrollmentStatus }) => (
                      <TableRow 
                        key={student.id}
                        onClick={() => handleStudentClick(student.id)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>{student.lastName}</TableCell>
                        <TableCell>{student.firstName}</TableCell>
                        <TableCell>
                          {student.dateOfBirth
                            ? new Date(student.dateOfBirth).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{enrollmentStatus ?? 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 