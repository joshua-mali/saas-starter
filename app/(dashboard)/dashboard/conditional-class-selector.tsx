'use client';

import { usePathname } from 'next/navigation';
import type { SimpleClass } from './class-selector';
import { ClassSelectorClient } from './class-selector-client';

interface ConditionalClassSelectorProps {
  userTaughtClasses: SimpleClass[];
  allTeamClasses: SimpleClass[];
  // Add any other props that ClassSelectorClient needs and were fetched in the Server Component
}

export function ConditionalClassSelector({ 
  userTaughtClasses,
  allTeamClasses
}: ConditionalClassSelectorProps) {
  const pathname = usePathname();
  // Corrected condition: Show only if path starts with /dashboard/ (sub-pages)
  const showClassSelector = pathname.startsWith('/dashboard');

  if (!showClassSelector) {
    return null; // Don't render on / or /dashboard
  }

  // Render the actual selector UI only on nested dashboard pages
  return (
    <ClassSelectorClient 
      userTaughtClasses={userTaughtClasses}
      allTeamClasses={allTeamClasses}
      // Pass other necessary props here
    />
  );
} 