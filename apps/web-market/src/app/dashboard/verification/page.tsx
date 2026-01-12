import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { VerificationCenter } from './components/verification-center';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verification Center | Skillancer',
  description: 'Verify your identity to build trust and unlock more opportunities.',
};

export default async function VerificationPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/verification');
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Verification Center</h1>
        <p className="text-muted-foreground mt-2">
          Build trust with clients by verifying your identity and credentials.
        </p>
      </div>
      <VerificationCenter />
    </div>
  );
}
