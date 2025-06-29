'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ActionState } from '@/lib/auth/middleware';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { signIn, signUp } from './actions';

// Extend props for Login component
interface LoginProps {
  mode?: 'signup' | 'signin';
  inviteToken?: string;
  teamId?: string;
  role?: string;
}

// Initial state definition matching ActionState (or a subset)
const initialState: ActionState = { error: '' };

export function Login({ mode = 'signin', inviteToken, teamId, role }: LoginProps) {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  // inviteId from params seems redundant if we have inviteToken
  // const inviteId = searchParams.get('inviteId');

  const isSignUp = mode === 'signup';
  const actionToUse = isSignUp ? signUp : signIn;

  // Use useActionState
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    actionToUse,
    initialState,
  );

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
       <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        {/* MALI Ed Logo */}
         <div className="mx-auto w-fit">
           <Image
             src="/MALI Ed Logo (Black).svg"
             alt="MALI Ed"
             width={200}
             height={60}
             className="h-12 w-auto"
           />
         </div>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" action={formAction}>
          {/* Pass hidden fields */}
          {redirectParam && <input type="hidden" name="redirect" value={redirectParam} />}
          {priceId && <input type="hidden" name="priceId" value={priceId} />}
          {/* Hidden fields for invite data - only render if values exist and mode is signup */}
          {isSignUp && inviteToken && (
            <input type="hidden" name="inviteToken" value={inviteToken} />
          )}
          {isSignUp && teamId && (
            <input type="hidden" name="teamId" value={teamId} />
          )}
          {isSignUp && role && (
            <input type="hidden" name="role" value={role} />
          )}

          {/* Email Input */}
          <div>
            <Label htmlFor="email">Email address</Label>
            <div className="mt-2">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={state?.fields?.email ?? ''} // Repopulate email if action returns it
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
             {state?.fieldErrors?.email && (
               <p className="mt-2 text-xs text-red-600">
                 {state.fieldErrors.email}
               </p>
             )}
          </div>

          {/* Full Name Input - Only for Sign Up */}
          {isSignUp && (
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <div className="mt-2">
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  defaultValue={state?.fields?.fullName ?? ''}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
              {state?.fieldErrors?.fullName && (
                <p className="mt-2 text-xs text-red-600">
                  {state.fieldErrors.fullName}
                </p>
              )}
            </div>
          )}

          {/* Password Input */}
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="mt-2">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={isSignUp ? 8 : undefined}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
             {state?.fieldErrors?.password && (
               <p className="mt-2 text-xs text-red-600">
                 {state.fieldErrors.password}
               </p>
             )}
            {/* Optional: Add confirm password field for signup */} 
          </div>

          {/* General Form Error / Success Message */}
          {state?.error && !state.fieldErrors && (
            <p className="text-sm text-red-600" aria-live="polite">
              {state.error}
            </p>
          )}
          {state?.message && (
             <p className="text-sm text-green-600" aria-live="polite">
               {state.message} {/* Assuming success is in `message` */}
             </p>
           )}

          {/* Submit Button */}
          <div>
             <Button
              type="submit"
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              disabled={pending}
              aria-disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : isSignUp ? (
                'Create account'
              ) : (
                'Sign in'
              )}
            </Button>
          </div>
        </form>

        {/* Link to switch mode */}
        <p className="mt-10 text-center text-sm text-gray-500">
          {isSignUp ? 'Already a member?' : 'Not a member?'}{' '}
          <Link
            href={`${isSignUp ? '/sign-in' : '/sign-up'}${redirectParam ? `?redirect=${redirectParam}` : ''}${priceId ? `&priceId=${priceId}` : ''}`}
            className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
          >
            {isSignUp ? 'Sign in' : 'Sign up now'}
          </Link>
        </p>
      </div>
    </div>
  );
}
