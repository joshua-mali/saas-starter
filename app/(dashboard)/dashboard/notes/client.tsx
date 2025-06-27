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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Edit3, Plus, Save, StickyNote, Trash2, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createGeneralNote, deleteGeneralNote, updateGeneralNote } from './actions'

type Note = {
  id: string
  title: string | null
  content: string
  isPrivate: boolean | null
  createdAt: Date
  updatedAt: Date
}

interface NotesClientProps {
  initialNotes: Note[]
}

interface NoteFormData {
  title: string
  content: string
  isPrivate: boolean
}

export default function NotesClient({ initialNotes }: NotesClientProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [isCreating, setIsCreating] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [isPending, startTransition] = useTransition()

  const [formData, setFormData] = useState<NoteFormData>({
    title: '',
    content: '',
    isPrivate: true,
  })

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      isPrivate: true,
    })
  }

  const startCreating = () => {
    resetForm()
    setEditingNote(null)
    setIsCreating(true)
  }

  const startEditing = (note: Note) => {
    setFormData({
      title: note.title || '',
      content: note.content,
      isPrivate: note.isPrivate ?? true,
    })
    setEditingNote(note)
    setIsCreating(true)
  }

  const cancelEditing = () => {
    setIsCreating(false)
    setEditingNote(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    startTransition(async () => {
      try {
        if (editingNote) {
          // Update existing note
          const result = await updateGeneralNote({
            id: editingNote.id,
            ...formData,
          })
          
          if (result.error) {
            toast.error('Update Failed', { description: result.error })
          } else {
            toast.success('Success', { description: result.message })
            // Update the note in the local state
            setNotes(prev => prev.map(note => 
              note.id === editingNote.id 
                ? { ...note, ...formData, updatedAt: new Date() }
                : note
            ))
            cancelEditing()
          }
        } else {
          // Create new note
          const result = await createGeneralNote(formData)
          
          if (result.error) {
            toast.error('Creation Failed', { description: result.error })
          } else {
            toast.success('Success', { description: result.message })
            // Refresh the page to get the new note with proper ID
            window.location.reload()
          }
        }
      } catch (error) {
        toast.error('Error', { description: 'An unexpected error occurred' })
      }
    })
  }

  const handleDelete = async (noteId: string) => {
    startTransition(async () => {
      try {
        const result = await deleteGeneralNote({ id: noteId })
        
        if (result.error) {
          toast.error('Delete Failed', { description: result.error })
        } else {
          toast.success('Success', { description: result.message })
          // Remove the note from local state
          setNotes(prev => prev.filter(note => note.id !== noteId))
        }
      } catch (error) {
        toast.error('Error', { description: 'An unexpected error occurred' })
      }
    })
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">Your Notes</h2>
          <p className="text-sm text-muted-foreground">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </p>
        </div>
        
        {!isCreating && (
          <Button onClick={startCreating}>
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingNote ? 'Edit Note' : 'Create New Note'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter note title..."
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter your note content..."
                  rows={6}
                  required
                  className="flex min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={formData.isPrivate}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  className="h-4 w-4 rounded border border-input bg-transparent"
                />
                <Label htmlFor="isPrivate" className="text-sm">
                  Private note (only visible to you)
                </Label>
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {isPending ? 'Saving...' : (editingNote ? 'Update Note' : 'Create Note')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={cancelEditing}
                  disabled={isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notes Grid */}
      {notes.length === 0 && !isCreating ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StickyNote className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No notes yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first note to get started organizing your thoughts and reminders.
            </p>
            <Button onClick={startCreating}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-6 line-clamp-2">
                    {note.title || 'Untitled Note'}
                  </CardTitle>
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(note)}
                      disabled={isPending || isCreating}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending || isCreating}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Note</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{note.title || 'this note'}"? 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(note.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                  {note.content}
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {note.isPrivate && '🔒 Private'}
                  </span>
                  <span>
                    {formatDate(note.updatedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 