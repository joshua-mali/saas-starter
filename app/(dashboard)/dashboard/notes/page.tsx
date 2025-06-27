import { getUserGeneralNotes } from './actions'
import NotesClient from './client'

type Note = Awaited<ReturnType<typeof getUserGeneralNotes>>[0]

export default async function NotesPage() {
    let notes: Note[] = []
    let error: string | null = null

    try {
        notes = await getUserGeneralNotes()
    } catch (err) {
        console.error('Error fetching notes:', err)
        error = err instanceof Error ? err.message : 'Failed to load notes'
    }

    return (
        <div className="p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-gray-900">General Notes</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create and manage your personal notes and reminders
                    </p>
                </div>

                {error ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-red-800 text-sm">{error}</p>
                    </div>
                ) : (
                    <NotesClient initialNotes={notes} />
                )}
            </div>
        </div>
    )
} 