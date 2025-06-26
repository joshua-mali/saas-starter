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
import { Class, Stage } from '@/lib/db/schema'
import { ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { createClass } from './actions'

interface ClassesPageProps {
  classes: (Class & { stage: Pick<Stage, 'name'> | null })[]
  stages: Stage[]
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? 'Creating Class...' : 'Create Class'}
    </Button>
  )
}

export default function ClassesPageClient({ classes: initialClasses, stages }: ClassesPageProps) {
  const [state, formAction] = useActionState(createClass, { error: null, success: false })
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
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Classes</CardTitle>
          <CardDescription>A list of your current classes.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialClasses.length > 0 ? (
            <ul className="space-y-2">
              {initialClasses.map((cls) => (
                <li key={cls.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <span className="font-medium">{cls.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({cls.calendarYear})
                    </span>
                    {cls.stage && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {cls.stage.name}
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
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You haven't created any classes yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 