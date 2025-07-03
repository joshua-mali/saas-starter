import { checkoutAction } from '@/lib/payments/actions';
import { stripe } from '@/lib/payments/stripe';
import { PLAN_MEMBER_LIMITS } from '@/lib/plans';
import { Check } from 'lucide-react';
import Stripe from 'stripe';
import { SubmitButton } from './submit-button';

// Prices are fresh for one hour max
export const revalidate = 3600;

interface PriceWithExpandedProduct {
  id: string;
  product: Stripe.Product | Stripe.DeletedProduct | string;
  unit_amount: number | null;
  recurring: Stripe.Price.Recurring | null;
}

// Interface defining the structure *after* mapping and before filtering nulls
interface MappedProductPrice {
  id: string;
  name: string | null;
  description: string | null;
  price: {
    id: string;
    unitAmount: number | null;
    interval: Stripe.Price.Recurring.Interval | null;
    trialPeriodDays: number | null;
  } | null;
}

// Final interface used after filtering nulls
interface ProductWithPrice {
  id: string;
  name: string; // Expect name to be non-null here
  description: string | null; // Description can still be null
  price: {
    id: string;
    unitAmount: number | null;
    interval: Stripe.Price.Recurring.Interval | null;
    trialPeriodDays: number | null;
  };
}

export default async function PricingPage() {
  const pricesResponse = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring',
  });

  const productsWithPrices: ProductWithPrice[] = pricesResponse.data
    .map((price: PriceWithExpandedProduct): MappedProductPrice | null => {
      if (typeof price.product === 'string' || !price.product || ('deleted' in price.product && price.product.deleted) || !price.product.active) {
        return null;
      }
      const product = price.product as Stripe.Product;

      // If product name is null, treat it as invalid for display
      if (!product.name) {
          console.warn(`Product with ID ${product.id} has a null name. Skipping.`);
          return null;
      }

      return {
        id: product.id,
        name: product.name, // Now guaranteed non-null
        description: product.description, // Can be null
        price: {
          id: price.id,
          unitAmount: price.unit_amount,
          interval: price.recurring?.interval ?? null,
          trialPeriodDays: price.recurring?.trial_period_days ?? null,
        },
      };
    })
    // Filter out nulls based on the MappedProductPrice structure
    .filter((p): p is MappedProductPrice & { name: string; price: NonNullable<MappedProductPrice['price']> } => p !== null && p.price !== null)
    .reduce((acc, current) => {
      // No need to check for null current here due to filter
      if (!acc.find(item => item.id === current.id)) {
         acc.push(current);
      }
       return acc;
    }, [] as ProductWithPrice[]); // Initial accumulator type is the final desired type

  productsWithPrices.sort((a, b) => (a.price.unitAmount ?? 0) - (b.price.unitAmount ?? 0));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
       <h1 className="text-3xl font-bold text-center mb-8">Choose Your Plan</h1>
       {productsWithPrices.length === 0 && (
         <p className="text-center text-gray-600">No pricing plans available at the moment. Please check back later.</p>
       )}
      <div className={`grid md:grid-cols-${Math.min(productsWithPrices.length, 2)} gap-8 max-w-4xl mx-auto`}>
        {productsWithPrices.map(product => (
          <PricingCard
            key={product.id}
            name={product.name} // name is now guaranteed string
            description={product.description}
            features={getFeaturesForPlan(product.name)}
            price={product.price.unitAmount ?? 0}
            interval={product.price.interval ?? 'month'}
            trialDays={product.price.trialPeriodDays ?? 0}
            priceId={product.price.id}
          />
        ))}
      </div>
    </main>
  );
}

function getFeaturesForPlan(planName: string | null): string[] {
  // Ensure planName is treated as potentially null when accessing PLAN_MEMBER_LIMITS
  const safePlanName = planName ?? '';
  const memberLimit = PLAN_MEMBER_LIMITS[safePlanName] ?? 1;

  const baseFeatures = [
     `${memberLimit} Team Members`,
     'Core Grading Features',
     'Basic Reporting',
     'Email Support',
  ];

  if (planName === 'Teacher Pro') {
    return [
      ...baseFeatures,
      'Advanced Reporting',
      'Priority Email Support',
      'Early Access to New Features',
    ];
  }
  if (planName === 'Teacher Premium') {
     return [
       ...baseFeatures,
       'Advanced Reporting',
       'Dedicated Slack Support',
       'Early Access to New Features',
       'API Access (Coming Soon)',
     ];
  }
  return baseFeatures;
}

function PricingCard({
  name,
  description,
  price,
  interval,
  trialDays,
  features,
  priceId,
}: {
  name: string;
  description: string | null; // Allow null description
  price: number;
  interval: string | null;
  trialDays: number;
  features: string[];
  priceId?: string;
}) {
  return (
    <div className="border rounded-lg p-6 shadow-sm flex flex-col">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">{name}</h2>
       <p className="text-gray-600 mb-4 min-h-[40px]">{description ?? ' '}</p> {/* Handle null description */}
      {trialDays > 0 && (
         <p className="text-sm text-orange-600 mb-4 font-medium">
            {trialDays} day free trial
         </p>
      )}
      <p className="text-4xl font-bold text-gray-900 mb-6">
        ${(price / 100).toFixed(2)}
        <span className="text-xl font-normal text-gray-600"> / {interval ?? 'one-time'}</span>
      </p>
      <ul className="space-y-3 mb-8 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      {priceId ? (
        <form action={checkoutAction}>
          <input type="hidden" name="priceId" value={priceId} />
          <SubmitButton />
        </form>
      ) : (
         <p className="text-center text-red-500 font-medium mt-auto">Plan not available</p>
      )}
    </div>
  );
}
