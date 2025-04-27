import { stripe } from '../payments/stripe';

async function createStripeProducts() {
  console.log('Creating Stripe products and prices...');

  const baseProduct = await stripe.products.create({
    name: 'Base',
    description: 'Base subscription plan',
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800, // $8 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  const plusProduct = await stripe.products.create({
    name: 'Plus',
    description: 'Plus subscription plan',
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200, // $12 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  console.log('Stripe products and prices created successfully.');
}

async function seedDatabase() {
  console.log('Seeding database...');

  // 1. Create Stripe Products (keep this)
  await createStripeProducts();
  console.log('Stripe products created or verified.');

  // --- REMOVE USER AND TEAM CREATION BLOCK ---
  // This section attempted to insert directly into auth.users, which is incorrect.
  // User/team creation for seeding should ideally use Supabase client functions or API calls.
  // Example using Supabase client (if needed later):
  // const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  // if (authError) throw authError;
  // const userId = authData.user?.id;
  // ... create team and link member ...

  console.log('Database seeding complete.');
}

seedDatabase().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
