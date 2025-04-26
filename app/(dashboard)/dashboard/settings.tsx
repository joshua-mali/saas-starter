'use client';

import { deleteAccount, updatePassword } from '@/app/(login)/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GradeScale, Term } from '@/lib/db/schema';
import { Loader2, Lock, Trash2 } from 'lucide-react';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { saveTermDates, updateGradeScales } from './settings/actions';

type SettingsProps = {
  initialTerms: Term[];
  calendarYear: number;
  gradeScales: GradeScale[];
};

type ActionState = {
  error?: string;
  success?: string;
};

const formatDateForInput = (date: Date | null | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

function TermSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? 'Saving Dates...' : 'Save Term Dates'}
    </Button>
  );
}

function GradeScaleSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? 'Saving Scales...' : 'Save Grading Scale'}
    </Button>
  );
}

export function Settings({ initialTerms, calendarYear, gradeScales }: SettingsProps) {
  const [termState, termAction] = useActionState(saveTermDates, { error: null, success: false });
  const termFormRef = useRef<HTMLFormElement>(null);
  const initialTermMap = new Map(initialTerms.map(t => [t.termNumber, t]));

  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    ActionState,
    FormData
  >(updatePassword, { error: '', success: '' });

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    ActionState,
    FormData
  >(deleteAccount, { error: '', success: '' });

  const [scaleState, scaleAction] = useActionState(updateGradeScales, { error: null, success: false });
  const scaleFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (termState.error) {
      toast.error(termState.error);
    } else if (termState.success) {
      toast.success('Term dates saved successfully!');
    }
  }, [termState]);

  useEffect(() => {
    if (passwordState.error) {
      toast.error(passwordState.error);
    } else if (passwordState.success) {
      toast.success(passwordState.success);
    }
  }, [passwordState]);

  useEffect(() => {
    if (deleteState.error) {
      toast.error(deleteState.error);
    }
  }, [deleteState]);

  useEffect(() => {
    if (scaleState.error) {
      toast.error(scaleState.error);
    } else if (scaleState.success) {
      toast.success('Grading scale updated successfully!');
    }
  }, [scaleState]);

  const handlePasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      passwordAction(new FormData(event.currentTarget));
    });
  };

  const handleDeleteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      deleteAction(new FormData(event.currentTarget));
    });
  };

  return (
    <Tabs defaultValue="terms" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="terms">Term Dates</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="grading">Grading Scale</TabsTrigger>
      </TabsList>

      <TabsContent value="terms">
        <Card>
          <CardHeader>
            <CardTitle>Term Dates for {calendarYear}</CardTitle>
            <CardDescription>
              Enter the start and end dates for each term in {calendarYear}.
            </CardDescription>
          </CardHeader>
          <form ref={termFormRef} action={termAction}>
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
              <TermSubmitButton />
            </CardFooter>
          </form>
        </Card>
      </TabsContent>

      <TabsContent value="security" className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                />
              </div>
              {passwordState.error && (
                <p className="text-red-500 text-sm">{passwordState.error}</p>
              )}
              {passwordState.success && (
                <p className="text-green-500 text-sm">{passwordState.success}</p>
              )}
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isPasswordPending}
              >
                {isPasswordPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" /> Update Password</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delete Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Account deletion is non-reversable. Please proceed with caution.
            </p>
            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <div>
                <Label htmlFor="delete-password">Confirm Password</Label>
                <Input
                  id="delete-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                />
              </div>
              {deleteState.error && (
                <p className="text-red-500 text-sm">{deleteState.error}</p>
              )}
              <Button
                type="submit"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeletePending}
              >
                {isDeletePending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 className="mr-2 h-4 w-4" /> Delete Account</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="grading">
        <Card>
          <CardHeader>
            <CardTitle>Grading Scale Names</CardTitle>
            <CardDescription>
              Define the names and descriptions for each grading level. Numeric values are fixed.
            </CardDescription>
          </CardHeader>
          <form ref={scaleFormRef} action={scaleAction}>
            <CardContent className="space-y-4">
              {gradeScales.map((scale) => (
                <div key={scale.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="space-y-1 md:col-span-1">
                    <Label>Numeric Value</Label>
                    <p className="font-mono text-lg px-3 py-2">{scale.numericValue}</p>
                    <input type="hidden" name={`id_${scale.id}`} value={scale.id} />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label htmlFor={`name_${scale.id}`}>Display Name</Label>
                    <Input
                      id={`name_${scale.id}`}
                      name={`name_${scale.id}`}
                      defaultValue={scale.name ?? ''}
                      required
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label htmlFor={`description_${scale.id}`}>Description (Optional)</Label>
                    <Input
                      id={`description_${scale.id}`}
                      name={`description_${scale.id}`}
                      defaultValue={scale.description ?? ''}
                      maxLength={200}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <GradeScaleSubmitButton />
            </CardFooter>
          </form>
        </Card>
      </TabsContent>

    </Tabs>
  );
}
