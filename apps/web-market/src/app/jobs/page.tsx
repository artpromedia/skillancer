import { Suspense } from 'react';

import { searchJobs, getJobCategories, type JobSearchFilters } from '@/lib/api/jobs';

import { JobFilters } from './components/job-filters';
import { JobList } from './components/job-list';
import { JobListSkeleton } from './components/job-list-skeleton';

import type { Metadata } from 'next';


// ============================================================================
// Types
// ============================================================================

interface JobsPageProps {
  searchParams: Promise<{
    q?: string;
    skills?: string | string[];
    budgetMin?: string;
    budgetMax?: string;
    budgetType?: string;
    experienceLevel?: string;
    category?: string;
    subcategory?: string;
    duration?: string;
    postedWithin?: string;
    clientHistory?: string;
    sortBy?: string;
    page?: string;
  }>;
}

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata({ searchParams }: JobsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q;
  const category = params.category;

  let title = 'Find Freelance Jobs';
  let description =
    'Browse thousands of freelance jobs. Find work that matches your skills with SmartMatch.';

  if (query) {
    title = `${query} Jobs`;
    description = `Find freelance ${query} jobs. Browse opportunities matching your search.`;
  } else if (category) {
    title = `${category} Jobs`;
    description = `Browse freelance ${category} jobs. Find opportunities in this category.`;
  }

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Skillancer Market`,
      description,
    },
  };
}

// ============================================================================
// Page Component
// ============================================================================

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = await searchParams;

  // Parse search params into filters
  const filters: JobSearchFilters = {
    query: params.q,
    skills: params.skills
      ? Array.isArray(params.skills)
        ? params.skills
        : [params.skills]
      : undefined,
    budgetMin: params.budgetMin ? Number(params.budgetMin) : undefined,
    budgetMax: params.budgetMax ? Number(params.budgetMax) : undefined,
    budgetType: params.budgetType as JobSearchFilters['budgetType'],
    experienceLevel: params.experienceLevel as JobSearchFilters['experienceLevel'],
    category: params.category,
    subcategory: params.subcategory,
    duration: params.duration,
    postedWithin: params.postedWithin as JobSearchFilters['postedWithin'],
    clientHistory: params.clientHistory as JobSearchFilters['clientHistory'],
    sortBy: (params.sortBy as JobSearchFilters['sortBy']) || 'relevance',
  };

  const page = params.page ? Number(params.page) : 1;

  // Fetch initial data in parallel
  const [initialJobsResult, categories] = await Promise.all([
    searchJobs(filters, { page, limit: 20 }).catch(() => ({
      jobs: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasMore: false,
    })),
    getJobCategories().catch(() => []),
  ]);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {params.q ? `Jobs matching "${params.q}"` : 'Find Freelance Jobs'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {initialJobsResult.total > 0
            ? `${initialJobsResult.total.toLocaleString()} jobs available`
            : 'Discover opportunities that match your skills'}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-72 lg:flex-shrink-0">
          <Suspense fallback={<FiltersSkeleton />}>
            <JobFilters categories={categories} initialFilters={filters} />
          </Suspense>
        </aside>

        {/* Job Listings */}
        <main className="min-w-0 flex-1">
          <Suspense fallback={<JobListSkeleton />}>
            <JobList initialData={initialJobsResult} initialFilters={filters} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Components
// ============================================================================

function FiltersSkeleton() {
  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <div className="bg-muted h-6 w-24 animate-pulse rounded" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-10 animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}
