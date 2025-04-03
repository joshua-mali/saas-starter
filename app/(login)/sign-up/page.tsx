'use client'; // Make this a client component to use hooks

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Login } from '../login';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const [inviteData, setInviteData] = useState({
    inviteToken: '',
    teamId: '',
    role: '',
  });

  // Read params only once on component mount
  useEffect(() => {
    setInviteData({
        inviteToken: searchParams.get('inviteToken') || '',
        teamId: searchParams.get('teamId') || '',
        role: searchParams.get('role') || '',
    });
  }, [searchParams]);

  return (
    <Suspense fallback={<div>Loading...</div>}> {/* Suspense usually needs a fallback */}
      <Login
        mode="signup"
        // Pass invite data if present
        inviteToken={inviteData.inviteToken}
        teamId={inviteData.teamId}
        role={inviteData.role}
      />
    </Suspense>
  );
}
