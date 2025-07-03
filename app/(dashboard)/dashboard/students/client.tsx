'use client'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { Edit2, Trash2, Upload, UserCog, X } from 'lucide-react'; // For loading indicators and icons
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { addStudentToClass, addStudentsBatch, deleteStudent, updateStudent } from './actions'; // Import new actions

// Type for student data received from server
// (Ideally, move this type definition to a shared file)
type StudentListData = {
    enrollmentId: string;
    studentId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | null;
    externalId: string | null;
    isActive: boolean | null;
};

interface StudentsPageClientProps {
  currentClassId: string | null; // ID of the globally selected class
  students: StudentListData[];   // Students for the selected class, passed from server
}

function SubmitButton({ action }: { action: 'create' | 'update' | 'delete' }) {
  const { pending } = useFormStatus()
  
  const buttonText = {
    create: pending ? 'Adding Student...' : 'Add Student',
    update: pending ? 'Updating Student...' : 'Update Student', 
    delete: pending ? 'Deleting Student...' : 'Delete Student'
  }
  
  const variant = action === 'delete' ? 'destructive' : 'default'
  
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} variant={variant}>
      {buttonText[action]}
    </Button>
  )
}

// Edit Student Modal Component
function EditStudentModal({ 
  student, 
  onClose 
}: { 
  student: StudentListData,
  onClose: () => void 
}) {
  const [state, formAction] = useActionState(updateStudent, { error: null, success: false })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    } else if (state.success) {
      toast.success('Student updated successfully!')
      onClose()
    }
  }, [state, onClose])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Student</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="studentId" value={student.studentId} />
          
          <div className="space-y-2">
            <Label htmlFor="edit-firstName">First Name</Label>
            <Input
              id="edit-firstName"
              name="firstName"
              defaultValue={student.firstName}
              placeholder="e.g., John"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-lastName">Last Name</Label>
            <Input
              id="edit-lastName"
              name="lastName"
              defaultValue={student.lastName}
              placeholder="e.g., Doe"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
            <Input
              id="edit-dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={student.dateOfBirth ? student.dateOfBirth.toISOString().split('T')[0] : ''}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-externalId">External ID</Label>
            <Input
              id="edit-externalId"
              name="externalId"
              placeholder="School ID"
              defaultValue={student.externalId || ''}
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <SubmitButton action="update" />
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Student Confirmation Dialog
function DeleteStudentDialog({ 
  student, 
  onConfirm 
}: { 
  student: StudentListData,
  onConfirm: () => void 
}) {
  const [state, formAction] = useActionState(deleteStudent, { error: null, success: false })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
      setIsOpen(false)
    } else if (state.success) {
      toast.success('Student deleted successfully!')
      setIsOpen(false)
      onConfirm()
    }
  }, [state, onConfirm])

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Student: {student.firstName} {student.lastName}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <div>
              <strong>This action cannot be undone.</strong> Deleting this student will permanently remove:
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All enrollments in classes</li>
              <li>All assessments and grades</li>
              <li>All teacher comments</li>
              <li>All historical data</li>
            </ul>
            <div className="font-medium text-red-600">
              Are you absolutely sure you want to delete {student.firstName} {student.lastName}?
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="studentId" value={student.studentId} />
            <AlertDialogAction asChild>
              <SubmitButton action="delete" />
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function StudentsPageClient({
  currentClassId: initialClassId, // Rename prop for clarity
  students: initialStudents
}: StudentsPageClientProps) {
  const [state, formAction] = useActionState(addStudentToClass, { error: null, success: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentListData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // CSV Upload states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{ firstName: string; lastName: string }[]>([]);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive classId primarily from URL, fall back to initial prop if needed
  const classIdFromUrl = searchParams.get('classId');
  const currentClassId = classIdFromUrl ? classIdFromUrl : initialClassId;
  
  // State for students, potentially updated if classId changes client-side
  // (For now, we rely on server fetch based on URL)
  const [students, setStudents] = useState(initialStudents);

  // Effect to potentially refetch or update students if classId from URL changes
  // This might be complex depending on how you want to handle data fetching
  // For now, let's assume the initialStudents prop corresponds to the initial currentClassId
  useEffect(() => {
    // If the classId derived from the URL is different from the one
    // the initial students were fetched for, we might need to update.
    // Option 1: Rely on full page reload initiated by class selector's router.push
    // Option 2: Trigger a client-side fetch here (more complex)
    // Let's stick with Option 1 for now, assuming router.push causes sufficient reload.
    
    // Update local student list if the prop changes (e.g., due to server action revalidation)
    setStudents(initialStudents);

  }, [initialStudents]);

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
  const filteredStudents = students.filter(student => 
    `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // CSV Upload Functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    parseCSV(file);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('CSV file is empty');
        return;
      }

      // Skip header row if it exists (check if first row contains "first" or "last")
      const startIndex = lines[0].toLowerCase().includes('first') || lines[0].toLowerCase().includes('last') ? 1 : 0;
      
      const parsedData: { firstName: string; lastName: string }[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        
        if (columns.length >= 2) {
          const firstName = columns[0];
          const lastName = columns[1];
          
          if (firstName && lastName) {
            parsedData.push({ firstName, lastName });
          }
        }
      }

      if (parsedData.length === 0) {
        toast.error('No valid student data found in CSV. Expected format: FirstName, LastName');
        return;
      }

      setCsvData(parsedData);
      setShowCsvPreview(true);
    };

    reader.onerror = () => {
      toast.error('Error reading CSV file');
    };

    reader.readAsText(file);
  };

  const handleCsvUpload = async () => {
    if (!currentClassId) {
      toast.error('Please select a class before uploading students');
      return;
    }

    if (csvData.length === 0) {
      toast.error('No student data to upload');
      return;
    }

    setIsUploading(true);
    
    try {
      // Call the server action properly
      const result = await addStudentsBatch(csvData, currentClassId);
      
      if (result.error) {
        toast.error('Upload failed', { description: result.error });
      } else if (result.success) {
        toast.success('Students uploaded successfully!', { 
          description: `Added ${result.addedCount} students to the class` 
        });
        handleCancelCsvUpload();
        // Refresh the page to show new students
        window.location.reload();
      }
    } catch (error) {
      console.error('CSV upload error:', error);
      toast.error('Error uploading students');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelCsvUpload = () => {
    setCsvFile(null);
    setCsvData([]);
    setShowCsvPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Row - Add Student and Bulk Import side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Add Student Card --- */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Student</CardTitle>
            <CardDescription>
              Enter the details for the new student. They will be added to the currently selected class: {currentClassId ? `(Class ID: ${currentClassId})` : '(No class selected)'}
            </CardDescription>
          </CardHeader>
          {/* Pass currentClassId derived from URL to the form action */}
          <form ref={formRef} action={(formData) => {
              if (!currentClassId) {
                  toast.error("Please select a class before adding a student.");
                  return;
              }
              formData.append('classId', currentClassId); // Add classId derived from URL
              formAction(formData); // Call the action with formData
          }}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" placeholder="e.g., John" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" placeholder="e.g., Doe" required />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="externalId">External ID (Optional)</Label>
                  <Input id="externalId" name="externalId" placeholder="School ID" />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <SubmitButton action="create" />
            </CardFooter>
          </form>
        </Card>

        {/* --- CSV Upload Card --- */}
        <Card>
          <CardHeader>
            <CardTitle>Bulk Import Students</CardTitle>
            <CardDescription>
              Upload a CSV file to add multiple students at once. Expected format: FirstName, LastName (with optional header row).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showCsvPreview ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csvFile">Select CSV File</Label>
                  <Input
                    id="csvFile"
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    disabled={!currentClassId}
                  />
                  {!currentClassId && (
                    <p className="text-sm text-muted-foreground">Please select a class first</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">CSV Format Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>First column: First Name</li>
                    <li>Second column: Last Name</li>
                    <li>Optional header row (auto-detected)</li>
                    <li>Example: John,Smith</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Preview ({csvData.length} students)</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancelCsvUpload}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
                
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">First Name</TableHead>
                        <TableHead className="text-xs">Last Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 8).map((student, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">{student.firstName}</TableCell>
                          <TableCell className="text-sm">{student.lastName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {csvData.length > 8 && (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      ... and {csvData.length - 8} more students
                    </p>
                  )}
                </div>
                
                <Button 
                  onClick={handleCsvUpload}
                  disabled={isUploading || !currentClassId}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : `Upload ${csvData.length} Students`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                disabled={!currentClassId} // Disable search if no class selected (use derived ID)
              />
            </div>
        </CardHeader>
        <CardContent>
          {currentClassId ? (
            students.length > 0 ? (
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
                        <div className="flex items-center gap-2 justify-end">
                          {/* Update link format using derived currentClassId */}
                          <Link href={`/dashboard/students/${student.studentId}?classId=${currentClassId}`} passHref>
                              <Button variant="outline" size="sm">
                                  <UserCog className="mr-1 h-4 w-4" /> View Details
                              </Button>
                          </Link>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingStudent(student)}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <DeleteStudentDialog 
                            student={student} 
                            onConfirm={() => {
                              // The page will automatically revalidate due to revalidatePath in the action
                            }} 
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                {students.length === 0 ? "No students found in this class." : "No students match your search."}
              </p>
            )
          ) : (
             <p className="text-sm text-muted-foreground text-center">Select a class from the dropdown above.</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Student Modal */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
        />
      )}
    </div>
  )
} 