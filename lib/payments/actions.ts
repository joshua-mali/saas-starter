'use server';

import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';

export const checkoutAction = async (formData: FormData) => {
  const priceId = formData.get('priceId') as string;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/sign-in?redirect=checkout&priceId=${priceId}`);
  }

  const [teamData] = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  await createCheckoutSession({ team: teamData?.team || null, priceId, user });
};

export const customerPortalAction = async () => {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-in');
  }

  const [teamData] = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (!teamData?.team) {
    console.error(`User ${user.id} tried to access customer portal without a team.`);
    redirect('/dashboard');
  }

  const portalSession = await createCustomerPortalSession(teamData.team);
  redirect(portalSession.url);
};
