'use client'

import { createClient } from '@/lib/supabase/client'; // Client-side Supabase
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { completeUserProfile } from './actions'; // We'll create this server action next

// Basic UI components (assuming similar styling to login/signup)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function CompleteProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    // Fetch the current user's email when the component mounts
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        console.error('Error fetching user or no user logged in:', error)
        // Redirect to login if no user is found (they shouldn't be here)
        router.replace('/login')
      } else {
        setUserEmail(user.email ?? null) // Get email from the user object
      }
    }
    getUser()
  }, [supabase, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!fullName.trim()) {
        setError('Please enter your full name.')
        setIsLoading(false)
        return
    }

    try {
      const result = await completeUserProfile({ fullName })

      if (result?.error) {
        setError(result.error)
      } else {
        // On success, redirect to the main dashboard (or wherever appropriate)
        router.push('/dashboard')
      }
    } catch (e) {
      console.error('Unexpected error completing profile:', e)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!userEmail) {
    // Show loading or a placeholder while fetching user email
    return <div>Loading...</div>
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Welcome! Please enter your name to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userEmail}
                disabled // Email confirmed via link, should not be changeable here
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="mt-1"
                disabled={isLoading} // Disable while loading
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 