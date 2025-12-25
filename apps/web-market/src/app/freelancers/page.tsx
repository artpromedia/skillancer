import { Suspense } from 'react';

import { FreelancerSearch } from './components/freelancer-search';
import { FreelancerSearchSkeleton } from './components/freelancer-search-skeleton';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Find Freelancers | Skillancer Marketplace',
  description:
    'Discover top verified freelancers for your project. Filter by skills, rates, verification level, and availability. Hire with confidence on Skillancer.',
  openGraph: {
    title: 'Find Freelancers | Skillancer Marketplace',
    description: 'Discover top verified freelancers for your project.',
  },
};

// ============================================================================
// Page Component
// ============================================================================

interface PageProps {
  searchParams: Promise<{
    q?: string;
    skills?: string | string[];
    minRate?: string;
    maxRate?: string;
    verification?: string;
    availability?: string;
    country?: string;
    sortBy?: string;
    page?: string;
  }>;
}

export default async function FreelancersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="bg-background min-h-screen">
      {/* Hero section */}
      <section className="from-primary/5 to-background border-b bg-gradient-to-b">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find Top Freelancers</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-lg">
            Discover verified talent with the skills you need. All freelancers are vetted through
            our trust system.
          </p>
        </div>
      </section>

      {/* Search and results */}
      <Suspense fallback={<FreelancerSearchSkeleton />}>
        <FreelancerSearch initialParams={params} />
      </Suspense>
    </main>
  );
}
