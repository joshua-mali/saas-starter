export const PLAN_MEMBER_LIMITS: Record<string, number> = {
  'Free': 1,
  'Small': 10,
  'Medium': 15,
  'Unlimited': 50,
  // Add other plan names and their limits here
};

export function getMemberLimit(planName: string | null | undefined): number {
  const defaultLimit = PLAN_MEMBER_LIMITS['Free'] ?? 1; // Use Free tier limit as default
  if (!planName) return defaultLimit;
  return PLAN_MEMBER_LIMITS[planName] ?? defaultLimit; // Return default if plan name not found
} 