import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  // Show landing page for non-authenticated users
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="relative z-10 border-b border-gray-200/20 bg-[var(--color-dark-grey)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Image 
              src="/MALI Symbol (Burnt Orange).svg" 
              alt="MALI-Ed Logo" 
              width={24} 
              height={24} 
              className="h-6 w-6"
            />
            <span className="ml-2 text-xl font-semibold text-white">MALI-Ed</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/pricing"
              className="text-sm font-medium text-[var(--color-brand)] hover:text-white"
            >
              Pricing
            </Link>
            <Button
              asChild
              variant="outline"
              className="px-4 py-2 text-sm border-[var(--color-ivory)] bg-[var(--color-ivory)] text-[var(--color-black)] hover:bg-[var(--color-ivory)]/90"
            >
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button
              asChild
              className="bg-[var(--color-brand)] hover:bg-[var(--color-brand)] text-white text-sm px-4 py-2"
            >
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Background Image */}
      <div 
        className="relative min-h-screen bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/old-school-class.png')",
        }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/50"></div>
        
        {/* Main Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center py-20 min-h-screen flex items-center justify-center">
            <div className="max-w-4xl mx-auto">
              <Image
                src="/MALI Ed Logo (White).svg"
                alt="MALI Ed"
                width={400}
                height={120}
                className="h-24 w-auto mx-auto mb-8"
              />
              <h1 className="text-4xl font-bold text-white sm:text-6xl mb-6 leading-tight">
                Your Learning Management System is outdated.
                <br />
                <span className="text-3xl sm:text-4xl text-[var(--color-brand)]">Streamline your teaching workflow</span>
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Plan curriculum, grade students, track progress, and generate reports - all in one comprehensive platform designed for modern educators.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  asChild
                  size="lg"
                  className="bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 text-white px-8 py-3 text-lg"
                >
                  <Link href="/sign-up">Get Started Free</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="px-8 py-3 text-lg border-[var(--color-ivory)] bg-[var(--color-ivory)] text-[var(--color-black)] hover:bg-[var(--color-ivory)]/90"
                >
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-[var(--color-ivory)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-[var(--color-dark-grey)] mb-12">
            Everything You Need to Teach Effectively
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-[var(--color-ivory)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--color-brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-dark-grey)] mb-2">Curriculum Planning</h3>
              <p className="text-[var(--color-charcoal)]">Organize and plan your curriculum with drag-and-drop simplicity.</p>
            </div>
            <div className="text-center">
              <div className="bg-[var(--color-ivory)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--color-brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-dark-grey)] mb-2">Smart Grading</h3>
              <p className="text-[var(--color-charcoal)]">Grade students efficiently with customizable scales and detailed notes.</p>
            </div>
            <div className="text-center">
              <div className="bg-[var(--color-ivory)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--color-brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-dark-grey)] mb-2">Student Tracking</h3>
              <p className="text-[var(--color-charcoal)]">Monitor individual student progress and identify areas for improvement.</p>
            </div>
            <div className="text-center">
              <div className="bg-[var(--color-ivory)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--color-brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-dark-grey)] mb-2">Detailed Reports</h3>
              <p className="text-[var(--color-charcoal)]">Generate comprehensive reports to track class and student performance.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--color-charcoal)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-[var(--color-charcoal)]">
          <p>&copy; 2025 MALI-Ed. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
} 