import SupabaseListener from '@/components/supabase-listener';
import { createClient } from '@/lib/supabase/server';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { Toaster as SonnerToaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'MALI-Ed',
  description: 'MALI-Ed is a platform for creating and sharing educational content.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const manrope = Manrope({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <html
      lang="en"
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-gray-50">
        <SupabaseListener serverAccessToken={session?.access_token} />
        {children}
        {/* <Toaster /> */}
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
