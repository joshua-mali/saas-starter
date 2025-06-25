import { getTeacherClasses, getTeamClasses, getUserTeam } from '@/app/actions/get-classes';
import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ConditionalClassSelector } from './dashboard/conditional-class-selector';
import { UserMenu } from './user-menu';

async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userTaughtClasses: Awaited<ReturnType<typeof getTeacherClasses>> = [];
  let allTeamClasses: Awaited<ReturnType<typeof getTeamClasses>> = [];

  if (user) {
    const userTeamId = await getUserTeam(user.id);
    if (userTeamId) {
      [userTaughtClasses, allTeamClasses] = await Promise.all([
          getTeacherClasses(user.id),
          getTeamClasses(userTeamId)
      ]);
    } else {
      console.warn("[Header Layout] User is not part of any team, cannot fetch classes.");
    }
  } else {
    console.warn("[Header Layout] No user found, cannot fetch classes.");
  }

  return (
    <header className="border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center">
            <Image 
              src="/MALI Symbol (Burnt Orange).svg" 
              alt="MALI-Ed Logo" 
              width={24} 
              height={24} 
              className="h-6 w-6"
            />
            <span className="ml-2 text-xl font-semibold text-gray-900">MALI-Ed</span>
          </Link>
          {(user && allTeamClasses.length > 0) && (
            <Suspense fallback={<div className="h-9 w-[200px] rounded-md bg-gray-200 animate-pulse" />}>
              <ConditionalClassSelector 
                userTaughtClasses={userTaughtClasses}
                allTeamClasses={allTeamClasses}
              />
            </Suspense>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen">
      <Header />
      {children}
    </section>
  );
}
