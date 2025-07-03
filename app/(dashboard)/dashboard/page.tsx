'use client'

import { ProgressStepper } from '@/components/onboarding/progress-stepper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOnboarding } from '@/lib/hooks/use-onboarding'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Plus, Save, StickyNote, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createGeneralNote, createStudentComment } from './notes/actions'

// --- Helper: Generate default title ---
function generateDefaultTitle(): string {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Sydney'
  }
  return now.toLocaleDateString('en-AU', options).replace(' at ', ' - ')
}

interface QuickNoteFormData {
  title: string
  content: string
}

interface QuickCommentFormData {
  studentId: string
  classId: string
  title: string
  content: string
}

interface Student {
  id: string
  firstName: string
  lastName: string
  classId: string
  className: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [teamData, setTeamData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  
  // Onboarding state
  const onboarding = useOnboarding()
  
  const [showQuickNoteForm, setShowQuickNoteForm] = useState(false)
  const [quickNoteData, setQuickNoteData] = useState<QuickNoteFormData>({
    title: '',
    content: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Helper function to get first name from full name
  const getFirstName = (fullName: string | null | undefined, email: string | null | undefined): string => {
    if (fullName) {
      const firstName = fullName.split(' ')[0]
      return firstName
    }
    return email || 'there'
  }

  const [showQuickCommentForm, setShowQuickCommentForm] = useState(false)
  const [quickCommentData, setQuickCommentData] = useState<QuickCommentFormData>({
    studentId: '',
    classId: '',
    title: '',
    content: ''
  })
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        
        if (error || !currentUser) {
          router.push('/sign-in')
          return
        }
        
        setUser(currentUser)
        setTeamData({ name: `${currentUser.user_metadata?.full_name || currentUser.email}'s Team` })
        
        // Fetch students for the comment selector
        await fetchStudents()
      } catch (error) {
        console.error('Error fetching user data:', error)
        toast.error('Error loading dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const fetchStudents = async () => {
    try {
      const response = await fetch('/api/students')
      if (response.ok) {
        const studentsData = await response.json()
        setStudents(studentsData)
      }
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleGoToNotes = () => {
    router.push('/dashboard/notes')
  }

  const handleQuickNote = () => {
    setShowQuickNoteForm(true)
  }

  const handleCancelQuickNote = () => {
    setShowQuickNoteForm(false)
    setQuickNoteData({ title: '', content: '' })
  }

  const handleSubmitQuickNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await createGeneralNote({
        title: quickNoteData.title.trim() || undefined,
        content: quickNoteData.content,
        isPrivate: true
      })

      if (result.error) {
        toast.error('Failed to create note', { description: result.error })
      } else {
        toast.success('Note created successfully!')
        handleCancelQuickNote()
      }
    } catch (error) {
      toast.error('Error creating note')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickComment = () => {
    setShowQuickCommentForm(true)
  }

  const handleCancelQuickComment = () => {
    setShowQuickCommentForm(false)
    setQuickCommentData({
      studentId: '',
      classId: '',
      title: '',
      content: ''
    })
  }

  const handleStudentSelect = (studentId: string) => {
    const selectedStudent = students.find(s => s.id === studentId)
    if (selectedStudent) {
      setQuickCommentData(prev => ({
        ...prev,
        studentId: selectedStudent.id,
        classId: selectedStudent.classId
      }))
    }
  }

  const handleSubmitQuickComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmittingComment(true)

    try {
      const result = await createStudentComment({
        studentId: quickCommentData.studentId,
        classId: quickCommentData.classId,
        title: quickCommentData.title.trim() || undefined,
        content: quickCommentData.content
      })

      if (result.error) {
        toast.error('Failed to create comment', { description: result.error })
      } else {
        toast.success('Student comment created successfully!')
        handleCancelQuickComment()
      }
    } catch (error) {
      toast.error('Error creating comment')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleGoToStudents = () => {
    router.push('/dashboard/students')
  }

  const handleGoToGrading = () => {
    router.push('/dashboard/grading')
  }

  const handleGoToPlanning = () => {
    router.push('/dashboard/planning')
  }

  const handleGoToReports = () => {
    router.push('/dashboard/report')
  }

  if (loading || onboarding.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand)] mx-auto mb-4"></div>
          <p className="text-[var(--color-charcoal)]">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Completion Banner - only show when onboarding is complete */}
      {onboarding.isOnboardingComplete && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="text-2xl">🎉</div>
            <p className="text-green-800 font-medium">
              Congrats, you're all set! Your classroom is ready to go.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Header */}
      <div className="text-center mb-8">
        <Image
          src="/MALI Ed Logo (Black).svg"
          alt="MALI Ed"
          width={200}
          height={60}
          className="h-16 w-auto mx-auto mb-4"
        />
        <h1 className="text-3xl font-bold text-[var(--color-dark-grey)] mb-2">
          Welcome back, {getFirstName(user?.user_metadata?.full_name, user?.email)}!
        </h1>
        <p className="text-[var(--color-charcoal)]">
          {onboarding.isOnboardingComplete
            ? "Your classroom is all set up and ready to go."
            : "Let's continue setting up your classroom."
          }
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2">
          {onboarding.isOnboardingComplete ? (
            // Dashboard Content for completed onboarding
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="flex items-center p-6">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4m9-14h-4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {students.length}
                        </p>
                        <p className="text-gray-600 text-sm">Students</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center p-6">
                    <div className="flex items-center space-x-4">
                      <div className="bg-green-100 p-2 rounded-full">
                        <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">✓</p>
                        <p className="text-gray-600 text-sm">Setup Complete</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center p-6">
                    <div className="flex items-center space-x-4">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">📊</p>
                        <p className="text-gray-600 text-sm">Ready to Track</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* What's Next Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-[var(--color-brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    What's Next?
                  </CardTitle>
                  <CardDescription>
                    Common tasks to help you get started with your classroom
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="bg-[var(--color-brand)] text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center">
                        1
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Start grading your students</p>
                        <p className="text-sm text-gray-600">Begin assessing student progress and track their learning journey.</p>
                      </div>
                      <Button size="sm" asChild>
                        <Link href="/dashboard/grading">View Grading</Link>
                      </Button>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="bg-[var(--color-brand)] text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center">
                        2
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Generate detailed reports</p>
                        <p className="text-sm text-gray-600">View comprehensive analytics of your class performance.</p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/dashboard/report">View Reports</Link>
                      </Button>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="bg-[var(--color-brand)] text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center">
                        3
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Add more classes</p>
                        <p className="text-sm text-gray-600">Scale your teaching with additional classes and students.</p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/dashboard/classes">Manage Classes</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Show onboarding progress when not complete
            <ProgressStepper
              steps={onboarding.steps}
              nextStep={onboarding.nextStep}
              progressPercentage={onboarding.progressPercentage}
              onRefresh={onboarding.refreshProgress}
            />
          )}
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-4">
          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[var(--color-dark-grey)]">Quick Actions</CardTitle>
              <CardDescription>Common tasks at your fingertips</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Quick Note */}
              {!showQuickNoteForm ? (
                <Button
                  onClick={handleQuickNote}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <StickyNote className="h-4 w-4 mr-2" />
                  Quick Note
                </Button>
              ) : (
                <Card className="border-[var(--color-brand)]/20 bg-[var(--color-ivory)]">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Quick Note</CardTitle>
                      <Button
                        onClick={handleCancelQuickNote}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <form onSubmit={handleSubmitQuickNote} className="space-y-3">
                      <div>
                        <Label htmlFor="noteTitle" className="text-xs">
                          Title (optional)
                        </Label>
                        <Input
                          id="noteTitle"
                          placeholder={generateDefaultTitle()}
                          value={quickNoteData.title}
                          onChange={(e) =>
                            setQuickNoteData(prev => ({ ...prev, title: e.target.value }))
                          }
                          className="text-sm"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="noteContent" className="text-xs">
                          Content *
                        </Label>
                        <textarea
                          id="noteContent"
                          placeholder="What's on your mind?"
                          value={quickNoteData.content}
                          onChange={(e) =>
                            setQuickNoteData(prev => ({ ...prev, content: e.target.value }))
                          }
                          required
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent resize-none"
                        />
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSubmitting || !quickNoteData.content.trim()}
                          className="bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 text-white"
                        >
                          {isSubmitting ? (
                            <>
                              <Save className="h-3 w-3 mr-1 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCancelQuickNote}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Quick Comment */}
              {students.length > 0 && !showQuickCommentForm ? (
                <Button
                  onClick={handleQuickComment}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Student Comment
                </Button>
              ) : students.length > 0 && showQuickCommentForm ? (
                <Card className="border-[var(--color-brand)]/20 bg-[var(--color-ivory)]">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Student Comment</CardTitle>
                      <Button
                        onClick={handleCancelQuickComment}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <form onSubmit={handleSubmitQuickComment} className="space-y-3">
                      <div>
                        <Label htmlFor="studentSelect" className="text-xs">
                          Student *
                        </Label>
                        <Select onValueChange={handleStudentSelect} required>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select a student" />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.firstName} {student.lastName} ({student.className})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="commentTitle" className="text-xs">
                          Title (optional)
                        </Label>
                        <Input
                          id="commentTitle"
                          placeholder={generateDefaultTitle()}
                          value={quickCommentData.title}
                          onChange={(e) =>
                            setQuickCommentData(prev => ({ ...prev, title: e.target.value }))
                          }
                          className="text-sm"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="commentContent" className="text-xs">
                          Comment *
                        </Label>
                        <textarea
                          id="commentContent"
                          placeholder="What would you like to note about this student?"
                          value={quickCommentData.content}
                          onChange={(e) =>
                            setQuickCommentData(prev => ({ ...prev, content: e.target.value }))
                          }
                          required
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent resize-none"
                        />
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            isSubmittingComment || 
                            !quickCommentData.content.trim() || 
                            !quickCommentData.studentId
                          }
                          className="bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 text-white"
                        >
                          {isSubmittingComment ? (
                            <>
                              <Save className="h-3 w-3 mr-1 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCancelQuickComment}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : null}

              {/* Navigation buttons */}
              <div className="border-t pt-3 space-y-2">
                <Button
                  onClick={handleGoToNotes}
                  variant="ghost"
                  className="w-full justify-start text-[var(--color-charcoal)] hover:text-[var(--color-brand)]"
                >
                  <StickyNote className="h-4 w-4 mr-2" />
                  All Notes
                </Button>
                
                {onboarding.isStepAvailable('add-students') && (
                  <Button
                    onClick={handleGoToStudents}
                    variant="ghost"
                    className="w-full justify-start text-[var(--color-charcoal)] hover:text-[var(--color-brand)]"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Students
                  </Button>
                )}
                
                {onboarding.isStepAvailable('plan-curriculum') && (
                  <Button
                    onClick={handleGoToPlanning}
                    variant="ghost"
                    className="w-full justify-start text-[var(--color-charcoal)] hover:text-[var(--color-brand)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Planning
                  </Button>
                )}
                
                {onboarding.isStepAvailable('start-grading') && (
                  <Button
                    onClick={handleGoToGrading}
                    variant="ghost"
                    className="w-full justify-start text-[var(--color-charcoal)] hover:text-[var(--color-brand)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Grading
                  </Button>
                )}

                {onboarding.isOnboardingComplete && (
                  <Button
                    onClick={handleGoToReports}
                    variant="ghost"
                    className="w-full justify-start text-[var(--color-charcoal)] hover:text-[var(--color-brand)]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Reports
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
