'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { signUp } from '../actions';

// 1. Define your form schema.
const formSchema = z.object({
  fullName: z.string().min(1, { message: 'Full name is required.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  // Read invite params (still useful to pass to action)
  const inviteToken = searchParams.get('inviteToken') || undefined;
  const teamId = searchParams.get('teamId') || undefined;
  const role = searchParams.get('role') || undefined;

  // 2. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  // 3. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    // Append invite data if present
    const formData = new FormData();
    formData.append('fullName', values.fullName);
    formData.append('email', values.email);
    formData.append('password', values.password);
    if (inviteToken) formData.append('inviteToken', inviteToken);
    if (teamId) formData.append('teamId', teamId);
    if (role) formData.append('role', role);

    // Pass a minimal initial state with undefined instead of null
    const initialState = { error: undefined, fieldErrors: undefined };
    const result = await signUp(initialState, formData);

    setIsLoading(false);

    if (result?.error) {
      toast.error('Sign Up Failed', {
        description: result.error,
      });
    } else {
      toast.info('Sign Up Pending', {
        description: 'Check your email to verify your account.',
      });
      // Potentially redirect manually if action doesn't
      // router.push('/auth/confirm-email');
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="mx-auto max-w-sm w-full">
        {/* MALI Ed Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/MALI Ed Logo (Black).svg"
            alt="MALI Ed"
            width={200}
            height={60}
            className="h-12 w-auto"
          />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sign Up</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Use shadcn Form component */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="m@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input placeholder="••••••" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create an account'}
                </Button>
              </form>
            </Form>
            <div className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <Link href="/sign-in" className="underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
