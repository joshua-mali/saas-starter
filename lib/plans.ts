export const PLAN_MEMBER_LIMITS: Record<string, number> = {
  'Free Plan': 3,
  'Pro Plan': 10,
  // Add other plan names and their limits here
};

export function getMemberLimit(planName: string | null | undefined): number {
  if (!planName) return PLAN_MEMBER_LIMITS['Free Plan'] ?? 1; // Default to free/lowest if no plan name
  return PLAN_MEMBER_LIMITS[planName] ?? Infinity; // Default to Infinity if plan name not found (or handle error)
} 