import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getJobBySlug, getRelatedJobs } from '@/lib/api/jobs';

import { JobDetailContent } from './components/job-detail-content';
import { JobDetailSkeleton } from './components/job-detail-skeleton';
import { SimilarJobs } from './components/similar-jobs';

import type { Metadata } from 'next';

// ============================================================================
// Types
// ============================================================================

interface JobDetailPageProps {
  params: Promise<{ slug: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata({ params }: JobDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const job = await getJobBySlug(slug);

    const description = job.description.slice(0, 160).replace(/\n/g, ' ');

    return {
      title: job.title,
      description,
      openGraph: {
        title: `${job.title} | Skillancer Market`,
        description,
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: job.title,
        description,
      },
    };
  } catch {
    return {
      title: 'Job Not Found',
      description: 'The job you are looking for could not be found.',
    };
  }
}

// ============================================================================
// JSON-LD Structured Data
// ============================================================================

function generateJobPostingSchema(job: Awaited<ReturnType<typeof getJobBySlug>>) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.createdAt,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.client.name,
    },
    employmentType: job.budgetType === 'HOURLY' ? 'CONTRACTOR' : 'FREELANCE',
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'Worldwide',
    },
  };

  // Add salary info if available
  if (job.budgetMin || job.budgetMax) {
    Object.assign(schema, {
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: {
          '@type': 'QuantitativeValue',
          minValue: job.budgetMin,
          maxValue: job.budgetMax,
          unitText: job.budgetType === 'HOURLY' ? 'HOUR' : 'PROJECT',
        },
      },
    });
  }

  // Add skills
  if (job.skills.length > 0) {
    Object.assign(schema, {
      skills: job.skills.map((s) => s.name).join(', '),
    });
  }

  return schema;
}

// ============================================================================
// Page Component
// ============================================================================

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { slug } = await params;

  let job;
  try {
    job = await getJobBySlug(slug);
  } catch {
    notFound();
  }

  // Fetch related jobs
  const relatedJobs = await getRelatedJobs(job.id, 4).catch(() => []);

  // Generate structured data
  const jsonLd = generateJobPostingSchema(job);

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />

      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <main className="lg:col-span-2">
            <Suspense fallback={<JobDetailSkeleton />}>
              <JobDetailContent job={job} />
            </Suspense>
          </main>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Similar Jobs */}
            {relatedJobs.length > 0 && (
              <Suspense fallback={<SimilarJobsSkeleton />}>
                <SimilarJobs jobs={relatedJobs} />
              </Suspense>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function SimilarJobsSkeleton() {
  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <div className="bg-muted h-6 w-32 animate-pulse rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="bg-muted h-5 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
