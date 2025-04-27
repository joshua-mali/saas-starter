import { db } from '@/lib/db/drizzle';
import { getTeamByStripeCustomerId, updateTeamSubscription } from '@/lib/db/queries';
import { teamMembers } from '@/lib/db/schema';
import { stripe } from '@/lib/payments/stripe';
import { PLAN_MEMBER_LIMITS } from '@/lib/plans';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  console.log(`Received Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Handling checkout.session.completed for session:', session.id);

        if (session.mode === 'subscription' && session.subscription && session.customer && session.client_reference_id) {
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;
          const userId = session.client_reference_id;

          console.log(`Checkout successful for user ${userId}, subscription ${subscriptionId}, customer ${customerId}`);

          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price.product']
          });

          const item = subscription.items.data[0];
          const price = item?.price;
          const product = price?.product as Stripe.Product;

          if (!product || !product.name) {
            console.error(`Product details not found or invalid for subscription ${subscriptionId}`);
            break;
          }

          const teacherLimit = parseInt(product.metadata?.teacher_limit || '1');
          if (isNaN(teacherLimit)) {
              console.error(`Invalid teacher_limit metadata: ${product.metadata?.teacher_limit}. Falling back to 1.`);
          }
          const finalTeacherLimit = isNaN(teacherLimit) ? 1 : teacherLimit;

          const [membership] = await db
            .select({ teamId: teamMembers.teamId })
            .from(teamMembers)
            .where(eq(teamMembers.userId, userId))
            .limit(1);

          if (!membership?.teamId) {
            console.error(`Team not found for user ${userId} during checkout completion.`);
            break;
          }

          await updateTeamSubscription(membership.teamId, {
            stripeSubscriptionId: subscription.id,
            stripeProductId: product.id,
            stripeCustomerId: customerId,
            planName: product.name,
            subscriptionStatus: subscription.status,
            teacherLimit: finalTeacherLimit,
          });
          console.log(`Team ${membership.teamId} updated successfully after checkout.`);

        } else {
           console.log('Skipping checkout session completion (not subscription or missing data).')
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Handling customer.subscription.updated for subscription:', subscription.id);

        const customerId = subscription.customer as string;
        const team = await getTeamByStripeCustomerId(customerId);

        if (!team) {
          console.error('Team not found for Stripe customer:', customerId);
          break;
        }

        const fullSubscription = await stripe.subscriptions.retrieve(subscription.id, {
            expand: ['items.data.price.product']
        });

        const item = fullSubscription.items.data[0];
        const price = item?.price;
        const product = price?.product as Stripe.Product;

        if (!product || !product.name) {
            console.error(`Product details not found or invalid for subscription ${subscription.id} during update.`);
            await updateTeamSubscription(team.id, {
                stripeSubscriptionId: subscription.id,
                stripeProductId: null,
                planName: null,
                subscriptionStatus: subscription.status,
                teacherLimit: team.teacherLimit,
              });
            break;
        }

        const teacherLimit = parseInt(product.metadata?.teacher_limit || '1');
         if (isNaN(teacherLimit)) {
              console.error(`Invalid teacher_limit metadata during update: ${product.metadata?.teacher_limit}. Falling back to 1.`);
          }
        const finalTeacherLimit = isNaN(teacherLimit) ? 1 : teacherLimit;

        await updateTeamSubscription(team.id, {
          stripeSubscriptionId: subscription.id,
          stripeProductId: product.id,
          planName: product.name,
          subscriptionStatus: subscription.status,
          teacherLimit: finalTeacherLimit,
        });
         console.log(`Team ${team.id} updated successfully after subscription update.`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Handling customer.subscription.deleted for subscription:', subscription.id);

        const customerId = subscription.customer as string;
        const team = await getTeamByStripeCustomerId(customerId);

        if (!team) {
          console.error('Team not found for Stripe customer during delete:', customerId);
          break;
        }

        await updateTeamSubscription(team.id, {
          stripeSubscriptionId: null,
          stripeProductId: null,
          planName: 'Free',
          subscriptionStatus: 'canceled',
          teacherLimit: PLAN_MEMBER_LIMITS['Free'] ?? 1,
        });
         console.log(`Team ${team.id} downgraded to Free plan after subscription deletion.`);
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error: any) {
     console.error(`Error handling event ${event.type}:`, error);
  }

  return NextResponse.json({ received: true });
}
