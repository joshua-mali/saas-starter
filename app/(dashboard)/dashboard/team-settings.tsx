'use client';

// Subset of imports needed for Team settings only
import { removeTeamMember } from '@/app/(login)/actions';
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
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Team, TeamMember } from '@/lib/db/schema';
import { customerPortalAction } from '@/lib/payments/actions';
import { useActionState, useState } from 'react';
import { InviteTeamMember } from './invite-team';

// --- Types --- (Copied from original Settings)
type DisplayUser = {
  id: string;
  name: string | null;
  email: string | undefined | null;
};

type MemberWithDisplayUser = TeamMember & {
  user: DisplayUser;
};

type TeamSettingsProps = {
  teamData: Team & {
    teamMembers: MemberWithDisplayUser[];
  };
  currentMemberCount: number;
  memberLimit: number;
};

type ActionState = {
  error?: string;
  success?: string;
};

// Helper (Copied from original Settings)
const getUserDisplayName = (user: DisplayUser) => {
  return user.name || user.email || 'Unknown User';
};

// --- New Component --- 
export function TeamSettings({ 
  teamData, 
  currentMemberCount, 
  memberLimit 
}: TeamSettingsProps) {
  // Team Member Removal State (Copied from original Settings)
  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeTeamMember, { error: '', success: '' });

  // State for managing the confirmation dialog
  const [memberToRemove, setMemberToRemove] = useState<MemberWithDisplayUser | null>(null);

  return (
    <div className="space-y-8">
      {/* --- Team Subscription Card --- */}
      <Card>
        <CardHeader>
          <CardTitle>Team Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-4 sm:mb-0">
                <p className="font-medium">
                  Current Plan: {teamData.planName || 'Free'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {teamData.subscriptionStatus === 'active'
                    ? 'Billed monthly'
                    : teamData.subscriptionStatus === 'trialing'
                      ? 'Trial period'
                      : 'No active subscription'}
                </p>
              </div>
              <form action={customerPortalAction}>
                <Button type="submit" variant="outline">
                  Manage Subscription
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* --- Team Members Card --- */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Team Members</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({teamData.teamMembers.length} / {memberLimit} members)
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {teamData.teamMembers.map((member, index) => (
              <li key={member.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarImage
                      src={`/placeholder.svg?height=32&width=32`}
                      alt={getUserDisplayName(member.user)}
                    />
                    <AvatarFallback>
                      {getUserDisplayName(member.user)
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {getUserDisplayName(member.user)}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {member.role}
                    </p>
                  </div>
                </div>
                {teamData.teamMembers.length > 1 && member.role !== 'owner' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isRemovePending}
                        onClick={() => setMemberToRemove(member)}
                      >
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    {memberToRemove && (
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will remove '{getUserDisplayName(memberToRemove.user)}' from the team. They will lose access immediately. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setMemberToRemove(null)}>Cancel</AlertDialogCancel>
                          <form action={removeAction} className="inline">
                            <input type="hidden" name="memberId" value={memberToRemove.id} />
                            <AlertDialogAction 
                              type="submit"
                              disabled={isRemovePending}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {isRemovePending ? 'Removing...' : 'Confirm Remove'}
                            </AlertDialogAction>
                          </form>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    )}
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
          {removeState?.error && (
            <p className="text-red-500 mt-4">{removeState.error}</p>
          )}
        </CardContent>
      </Card>
      
      {/* --- Invite Team Member Card --- */}
      <InviteTeamMember 
        teamId={teamData.id} 
        currentMemberCount={currentMemberCount}
        memberLimit={memberLimit}
      />
    </div>
  );
} 