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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Class, Stage } from '@/lib/db/schema'
import { ClipboardList, Edit2, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { createClass, deleteClass, updateClass } from './actions'

interface ClassesPageProps {
  classes: (Class & { stage: Pick<Stage, 'name'> | null })[]
  stages: Stage[]
}

function SubmitButton({ action }: { action: 'create' | 'update' | 'delete' }) {
  const { pending } = useFormStatus()
  
  const buttonText = {
    create: pending ? 'Creating Class...' : 'Create Class',
    update: pending ? 'Updating Class...' : 'Update Class', 
    delete: pending ? 'Deleting Class...' : 'Delete Class'
  }
  
  const variant = action === 'delete' ? 'destructive' : 'default'
  
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} variant={variant}>
      {buttonText[action]}
    </Button>
  )
}

// Edit Class Modal Component
function EditClassModal({ 
  classItem, 
  stages, 
  onClose 
}: { 
  classItem: Class & { stage: Pick<Stage, 'name'> | null }, 
  stages: Stage[],
  onClose: () => void 
}) {
  const [state, formAction] = useActionState(updateClass, { error: null, success: false })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    } else if (state.success) {
      toast.success('Class updated successfully!')
      onClose()
    }
  }, [state, onClose])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Class</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="classId" value={classItem.id} />
          
          <div className="space-y-2">
            <Label htmlFor="edit-className">Class Name</Label>
            <Input
              id="edit-className"
              name="className"
              defaultValue={classItem.name}
              placeholder="e.g., Year 3 Blue"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-calendarYear">Calendar Year</Label>
            <Input
              id="edit-calendarYear"
              name="calendarYear"
              type="number"
              defaultValue={classItem.calendarYear}
              required
              min="2000"
              max="2100"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-stageId">Stage</Label>
            <Select name="stageId" defaultValue={classItem.stageId.toString()} required>
              <SelectTrigger id="edit-stageId">
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {stages.length > 0 ? (
                  stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id.toString()}>
                      {stage.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-stages" disabled>
                    No stages found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
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

// Delete Class Confirmation Dialog
function DeleteClassDialog({ 
  classItem, 
  onConfirm 
}: { 
  classItem: Class & { stage: Pick<Stage, 'name'> | null },
  onConfirm: () => void 
}) {
  const [state, formAction] = useActionState(deleteClass, { error: null, success: false })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
      setIsOpen(false)
    } else if (state.success) {
      toast.success('Class deleted successfully!')
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
          <AlertDialogTitle>Delete Class: {classItem.name}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              <strong>This action cannot be undone.</strong> Deleting this class will permanently remove:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All student enrollments in this class</li>
              <li>All curriculum planning for this class</li>
              <li>All student assessments and grades</li>
              <li>All class-specific grade scales</li>
              <li>All related teacher comments</li>
            </ul>
            <p className="font-medium text-red-600">
              Are you absolutely sure you want to delete "{classItem.name}" ({classItem.calendarYear})?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="classId" value={classItem.id} />
            <AlertDialogAction asChild>
              <SubmitButton action="delete" />
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function ClassesPageClient({ classes: initialClasses, stages }: ClassesPageProps) {
  const [state, formAction] = useActionState(createClass, { error: null, success: false })
  const [editingClass, setEditingClass] = useState<(Class & { stage: Pick<Stage, 'name'> | null }) | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    } else if (state.success) {
      toast.success('Class created successfully!')
      formRef.current?.reset()
    }
  }, [state])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Class</CardTitle>
          <CardDescription>
            Enter the details for your new class.
          </CardDescription>
        </CardHeader>
        <form ref={formRef} action={formAction}>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="className">Class Name</Label>
              <Input
                id="className"
                name="className"
                placeholder="e.g., Year 3 Blue"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendarYear">Calendar Year</Label>
              <Input
                id="calendarYear"
                name="calendarYear"
                type="number"
                placeholder={`e.g., ${new Date().getFullYear()}`}
                required
                min="2000"
                max="2100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stageId">Stage</Label>
              <Select name="stageId" required>
                <SelectTrigger id="stageId">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent>
                  {stages.length > 0 ? (
                    stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id.toString()}>
                        {stage.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-stages" disabled>
                      No stages found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton action="create" />
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Classes</CardTitle>
          <CardDescription>Manage your current classes.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialClasses.length > 0 ? (
            <ul className="space-y-3">
              {initialClasses.map((cls) => (
                <li key={cls.id} className="flex items-center justify-between rounded border p-4">
                  <div>
                    <span className="font-medium">{cls.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({cls.calendarYear})
                    </span>
                    {cls.stage && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        Stage {cls.stage.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/planning/${cls.id}`} passHref>
                      <Button variant="outline" size="sm">
                        <ClipboardList className="mr-1 h-4 w-4" />
                        Plan
                      </Button>
                    </Link>
                    <Link href={`/dashboard/report?classId=${cls.id}`} passHref>
                      <Button variant="outline" size="sm">
                        <ClipboardList className="mr-1 h-4 w-4" />
                        Report
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingClass(cls)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <DeleteClassDialog 
                      classItem={cls} 
                      onConfirm={() => {
                        // The page will automatically revalidate due to revalidatePath in the action
                      }} 
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You haven't created any classes yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Class Modal */}
      {editingClass && (
        <EditClassModal
          classItem={editingClass}
          stages={stages}
          onClose={() => setEditingClass(null)}
        />
      )}
    </div>
  )
} 