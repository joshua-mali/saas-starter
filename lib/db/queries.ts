import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { teams } from './schema';

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    stripeCustomerId?: string | null;
    planName: string | null;
    subscriptionStatus: string;
    teacherLimit: number;
  }
) {
  await db
    .update(teams)
    .set({
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
      stripeProductId: subscriptionData.stripeProductId,
      planName: subscriptionData.planName,
      subscriptionStatus: subscriptionData.subscriptionStatus,
      teacherLimit: subscriptionData.teacherLimit,
      ...(subscriptionData.stripeCustomerId !== undefined && { stripeCustomerId: subscriptionData.stripeCustomerId }),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getActivityLogs() {
  console.warn("TODO: Refactor getActivityLogs function in lib/db/queries.ts")
  return []; // Return empty array for now
}
