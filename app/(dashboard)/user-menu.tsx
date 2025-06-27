'use client';

import { signOut } from '@/app/(login)/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Home, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Memoize the user fetching function to prevent unnecessary re-renders
  const fetchUser = useCallback(async () => {
    try {
      const { data: { user: fetchedUser }, error: fetchError } = await supabase.auth.getUser();
      
      if (fetchError) {
        console.error("Error fetching user:", fetchError);
        setError(fetchError.message);
        setUser(null);
      } else {
        setUser(fetchedUser);
        setError(null);
      }
    } catch (error) {
      console.error("Unexpected error fetching user:", error);
      setError("Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    // Initial user fetch
    fetchUser();

    // Set up auth state listener with improved error handling
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          // Handle different auth events
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setError(null);
            setLoading(false);
          } else if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user);
            setError(null);
            setLoading(false);
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            setUser(session.user);
            setError(null);
          } else {
            // For other events, fetch user to ensure we have the latest state
            await fetchUser();
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
          setError("Authentication error");
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [fetchUser]);

  async function handleSignOut() {
    try {
      setLoading(true);
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out");
    } finally {
      setLoading(false);
    }
  }

  // Show loading state
  if (loading) {
    return <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse" />;
  }

  // Show error state with retry option
  if (error && !user) {
    return (
      <Button
        onClick={() => {
          setError(null);
          setLoading(true);
          fetchUser();
        }}
        variant="outline"
        size="sm"
        className="text-xs"
      >
        Retry
      </Button>
    );
  }

  // Show unauthenticated state
  if (!user) {
    return (
      <>
        <Link
          href="/pricing"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Pricing
        </Link>
        <Button
          asChild
          className="bg-black hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-full"
        >
          <Link href="/sign-up">Sign Up</Link>
        </Button>
      </>
    );
  }

  // Extract user data with better fallbacks
  const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'User';
  const userInitials = userName
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'; // Limit to 2 characters and provide fallback

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded-full">
          <Avatar className="cursor-pointer size-9">
            <AvatarImage 
              src={user.user_metadata?.avatar_url} 
              alt={`${userName}'s avatar`}
              onError={() => {
                // Handle image loading errors gracefully
                console.log("Avatar image failed to load");
              }}
            />
            <AvatarFallback className="bg-[var(--color-charcoal)] text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem className="cursor-pointer">
          <Link href="/dashboard" className="flex w-full items-center">
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} className="w-full flex-1 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 