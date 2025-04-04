'use client';

import { inviteTeamMember } from '@/app/(login)/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Loader2, PlusCircle } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';

type ActionState = {
  error?: string;
  success?: string;
};

interface InviteTeamMemberProps {
  teamId: number;
}

export function InviteTeamMember({ teamId }: InviteTeamMemberProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteTeamMember, { error: '', success: '' });

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setUserRole(null);
      try {
        const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setUser(fetchedUser);

        if (fetchedUser && teamId) {
          const { data: memberData, error: memberError } = await supabase
            .from('team_members')
            .select('role')
            .eq('user_id', fetchedUser.id)
            .eq('team_id', teamId)
            .single();

          if (memberError) {
            console.error(`Error fetching role for user ${fetchedUser.id} in team ${teamId}:`, memberError);
            setUserRole(null);
          } else if (memberData) {
            console.log("Fetched user role:", memberData.role);
            setUserRole(memberData.role);
          } else {
            console.warn(`User ${fetchedUser.id} not found as a member of team ${teamId}`);
            setUserRole(null);
          }
        } else {
          setUserRole(null);
        }
      } catch (error) {
        console.error("Error fetching user data or role:", error);
        setUser(null);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase, teamId]);

  const isOwner = userRole === 'owner';

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter email"
              required
              disabled={!isOwner || isInvitePending}
            />
          </div>
          <div>
            <Label>Role</Label>
            <RadioGroup
              defaultValue="member"
              name="role"
              className="flex space-x-4"
              disabled={!isOwner || isInvitePending}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="member" id="member" />
                <Label htmlFor="member">Member</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner">Owner</Label>
              </div>
            </RadioGroup>
          </div>
          {inviteState?.error && (
            <p className="text-red-500">{inviteState.error}</p>
          )}
          {inviteState?.success && (
            <p className="text-green-500">{inviteState.success}</p>
          )}
          <Button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={isInvitePending || !isOwner}
          >
            {isInvitePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Invite Member
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {!isOwner && !loading && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            You must be a team owner to invite new members.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
