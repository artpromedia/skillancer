import { VerificationCenter } from './components/verification-center';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verification Center | Skillancer',
  description: 'Verify your identity to build trust and unlock more opportunities.',
};

export default function VerificationPage() {
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
