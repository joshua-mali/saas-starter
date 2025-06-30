'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Plus, Save, StickyNote, X } from 'lucide-react'
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

  if (loading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">
        Welcome back, {getFirstName(user.user_metadata?.full_name, user.email)}!
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side - Quick Actions */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          
          {/* General Notes Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-yellow-600" />
                General Notes
              </CardTitle>
              <CardDescription>
                Add quick notes and reminders for yourself
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showQuickNoteForm ? (
                <form onSubmit={handleSubmitQuickNote} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quickTitle">Title <span className="text-xs text-muted-foreground">(optional - defaults to current date/time)</span></Label>
                    <Input
                      id="quickTitle"
                      value={quickNoteData.title}
                      onChange={(e) => setQuickNoteData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter note title or leave blank for auto-generated title..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="quickContent">Content</Label>
                    <textarea
                      id="quickContent"
                      value={quickNoteData.content}
                      onChange={(e) => setQuickNoteData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Enter your note content..."
                      rows={4}
                      required
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Saving...' : 'Save Note'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCancelQuickNote}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Create personal notes that only you can see. Perfect for lesson ideas, reminders, or general thoughts.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleQuickNote} variant="outline" className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      Quick Note
                    </Button>
                    <Button onClick={handleGoToNotes} variant="outline" className="flex-1">
                      View All Notes
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Comments Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Student Comments
              </CardTitle>
              <CardDescription>
                Add comments about specific students (separate from grades)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showQuickCommentForm ? (
                <form onSubmit={handleSubmitQuickComment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentSelect">Select Student</Label>
                    <Select onValueChange={handleStudentSelect} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a student..." />
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

                  <div className="space-y-2">
                    <Label htmlFor="commentTitle">Title <span className="text-xs text-muted-foreground">(optional - defaults to current date/time)</span></Label>
                    <Input
                      id="commentTitle"
                      value={quickCommentData.title}
                      onChange={(e) => setQuickCommentData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Comment title or leave blank for auto-generated title..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="commentContent">Comment</Label>
                    <textarea
                      id="commentContent"
                      value={quickCommentData.content}
                      onChange={(e) => setQuickCommentData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Enter your comment about this student..."
                      rows={4}
                      required
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      disabled={isSubmittingComment || !quickCommentData.studentId} 
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmittingComment ? 'Saving...' : 'Save Comment'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCancelQuickComment}
                      disabled={isSubmittingComment}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Record behavioral observations, parent meeting notes, or general comments about students that are unrelated to their academic grades.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleQuickComment} variant="outline" className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      Quick Comment
                    </Button>
                    <Button onClick={handleGoToStudents} variant="outline" className="flex-1">
                      Go to Students
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Placeholder Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-gray-400" />
                Coming Soon
              </CardTitle>
              <CardDescription>
                More quick actions will be available here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We're working on additional features to make your teaching workflow even more efficient.
                </p>
                <Button className="w-full" variant="outline" disabled>
                  Feature Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Team Info */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Team Management</h2>
          <Card>
            <CardHeader>
              <CardTitle>Your Team</CardTitle>
              <CardDescription>
                Team settings and member management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Team: {teamData?.name || 'Loading...'}
                </p>
                <Button 
                  onClick={() => router.push('/dashboard/settings')} 
                  className="w-full" 
                  variant="outline"
                >
                  Manage Team Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
