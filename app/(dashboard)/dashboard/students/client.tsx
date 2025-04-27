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
import { Loader2 } from 'lucide-react'; // For loading indicators
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { addStudentsBatch, addStudentToClass, getStudentsForClass } from './actions'

// Props passed from the server component
interface StudentsPageClientProps {
  teacherClasses: Pick<Class, 'id' | 'name'>[]
}

// Type for student data fetched from the action
type StudentData = {
  student: Student
  enrollmentStatus: string | null
}

// Type for parsed CSV row
type CsvRow = Record<string, string>;

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

  // --- CSV Import State ---
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [firstNameHeader, setFirstNameHeader] = useState<string | null>(null);
  const [lastNameHeader, setLastNameHeader] = useState<string | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCsvPending, startCsvTransition] = useTransition(); // Transition for server action

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

  // --- CSV Handling Functions ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCsvFile(event.target.files ? event.target.files[0] : null);
    setShowMapping(false); // Reset mapping view if file changes
    setCsvData([]);
    setCsvHeaders([]);
    setFirstNameHeader(null);
    setLastNameHeader(null);
  };

  const processCsv = () => {
    if (!csvFile) return;
    setIsProcessingCsv(true);
    setShowMapping(false);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.trim().split(/\r\n|\n/);

        if (lines.length < 2) {
            toast.error("CSV must contain a header row and at least one data row.");
            throw new Error("CSV too short");
        }

        // Basic CSV header parsing (assumes comma-separated, handles simple quotes)
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const data = lines.slice(1).map(line => {
            // Basic row parsing (adjust regex if more complex CSVs are needed)
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const row: CsvRow = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || ''; // Assign value or empty string
            });
            return row;
        });

        setCsvHeaders(headers);
        setCsvData(data);
        setShowMapping(true);
        // Attempt auto-mapping common names
        const fnHeader = headers.find(h => /first.*name/i.test(h)) || null;
        const lnHeader = headers.find(h => /last.*name|surname/i.test(h)) || null;
        setFirstNameHeader(fnHeader);
        setLastNameHeader(lnHeader);

      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast.error("Failed to parse CSV file. Please check the format.");
        setCsvHeaders([]);
        setCsvData([]);
      } finally {
        setIsProcessingCsv(false);
      }
    };

    reader.onerror = () => {
        toast.error("Failed to read file.");
        setIsProcessingCsv(false);
    };

    reader.readAsText(csvFile);
  };

  const handleCsvUpload = () => {
    if (!firstNameHeader || !lastNameHeader || csvData.length === 0) {
      toast.warning("Please select headers for First Name and Last Name and ensure data exists.");
      return;
    }

    startCsvTransition(async () => {
        setIsUploading(true); // Use state for visual feedback if needed beyond transition

        if (!selectedClassId) {
             toast.error("Cannot upload CSV: No class selected.");
             setIsUploading(false);
             return;
        }

        const studentsToUpload = csvData.map(row => ({
            firstName: row[firstNameHeader] || '',
            lastName: row[lastNameHeader] || '',
        })).filter(s => s.firstName && s.lastName); // Filter out rows with missing names

        if (studentsToUpload.length === 0) {
             toast.warning("No students with both first and last names found after mapping.");
             setIsUploading(false);
             return;
        }

        // Pass selectedClassId to the action
        const result = await addStudentsBatch(studentsToUpload, selectedClassId);

        if (result.error) {
            toast.error(`CSV Upload Failed: ${result.error}`);
        } else if (result.success) {
            toast.success(`Successfully added ${result.addedCount} students!`);
            // Reset CSV state
            setCsvFile(null);
            setCsvData([]);
            setCsvHeaders([]);
            setShowMapping(false);
            setFirstNameHeader(null);
            setLastNameHeader(null);
            // Refetch students for the current class
             if (selectedClassId) {
                // No need to set isLoadingStudents, rely on list update via revalidation
                console.log('CSV upload success, student list should revalidate.')
             }
        }
        setIsUploading(false);
    });
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

          {/* --- CSV Import Card --- */}
          <Card>
            <CardHeader>
                <CardTitle>Import Students from CSV</CardTitle>
                <CardDescription>Upload a CSV file with student names.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center gap-4">
                     <Label htmlFor="csv-file-input" className="sr-only">Choose CSV File</Label>
                     <Input
                        id="csv-file-input"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={isProcessingCsv || isCsvPending}
                        className="flex-grow"
                    />
                    <Button
                        onClick={processCsv}
                        disabled={!csvFile || isProcessingCsv || isCsvPending}
                    >
                        {isProcessingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isProcessingCsv ? 'Processing...' : 'Process CSV'}
                    </Button>
                 </div>

                 {showMapping && (
                    <div className="border p-4 rounded-md space-y-4">
                        <h4 className="font-medium">Map CSV Columns</h4>
                        <p className="text-sm text-muted-foreground">
                            Select which columns contain the First Name and Last Name. Found {csvData.length} data rows.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>First Name Column</Label>
                                <Select
                                    value={firstNameHeader || ''}
                                    onValueChange={setFirstNameHeader}
                                    disabled={isCsvPending}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select header..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {csvHeaders.map((header, index) => (
                                            <SelectItem key={`fn-${index}`} value={header}>
                                                {header}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Last Name Column</Label>
                                 <Select
                                    value={lastNameHeader || ''}
                                    onValueChange={setLastNameHeader}
                                     disabled={isCsvPending}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select header..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {csvHeaders.map((header, index) => (
                                            <SelectItem key={`ln-${index}`} value={header}>
                                                {header}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                         <Button
                            onClick={handleCsvUpload}
                            disabled={!firstNameHeader || !lastNameHeader || isCsvPending || isUploading}
                            className="mt-4"
                         >
                             {isCsvPending || isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirm Mapping & Upload Students
                         </Button>
                    </div>
                 )}
            </CardContent>
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