import { CircleIcon } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import ClassSelector from './dashboard/class-selector';
import { UserMenu } from './user-menu';

function Header() {
  return (
    <header className="border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center">
            <CircleIcon className="h-6 w-6 text-orange-500" />
            <span className="ml-2 text-xl font-semibold text-gray-900">MALI-Ed</span>
          </Link>
          <Suspense fallback={<div className="h-9 w-[200px] rounded-md bg-gray-200 animate-pulse" />}>
            <ClassSelector />
          </Suspense>
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
