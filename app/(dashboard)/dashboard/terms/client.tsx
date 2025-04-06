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
import { type Term } from '@/lib/db/schema'
import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { saveTermDates } from './actions'

interface TermDatesClientProps {
  teamId: number
  calendarYear: number
  initialTerms: Term[] // Existing terms for the year
}

// Helper to format date for input type="date"
const formatDateForInput = (date: Date | null | undefined): string => {
  if (!date) return ''
  // Ensure it's a Date object
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return ''; // Invalid date
  // Format as YYYY-MM-DD
  return d.toISOString().split('T')[0];
};

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? 'Saving Dates...' : 'Save Term Dates'}
    </Button>
  )
}

export default function TermDatesClient({
  teamId,
  calendarYear,
  initialTerms,
}: TermDatesClientProps) {

  const [state, formAction] = useActionState(saveTermDates, { error: null, success: false })
  const formRef = useRef<HTMLFormElement>(null)

  // Create a map for easy lookup of initial dates
  const initialTermMap = new Map(initialTerms.map(t => [t.termNumber, t]));

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    } else if (state.success) {
      toast.success('Term dates saved successfully!')
      // Optionally refetch or update initialTerms state if needed
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Term Dates for {calendarYear}</CardTitle>
        <CardDescription>
Enter the start and end dates for each term in {calendarYear}.
        </CardDescription>
      </CardHeader>
      <form ref={formRef} action={formAction}>
        {/* Hidden input for calendarYear */}
        <input type="hidden" name="calendarYear" value={calendarYear} />
        <CardContent className="space-y-6">
          {[1, 2, 3, 4].map((termNum) => {
            const existingTerm = initialTermMap.get(termNum);
            return (
              <div key={termNum} className="rounded border p-4">
                <h4 className="mb-2 font-semibold">Term {termNum}</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`term${termNum}_start`}>Start Date</Label>
                    <Input
                      id={`term${termNum}_start`}
                      name={`term${termNum}_start`}
                      type="date"
                      required
                      defaultValue={formatDateForInput(existingTerm?.startDate)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`term${termNum}_end`}>End Date</Label>
                    <Input
                      id={`term${termNum}_end`}
                      name={`term${termNum}_end`}
                      type="date"
                      required
                      defaultValue={formatDateForInput(existingTerm?.endDate)}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  )
} 