/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Badge, Button } from '@skillancer/ui';
import { ArrowLeft, Scale, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProposalsClient } from './proposals-client';

import type { Metadata } from 'next';

import { getClientProposalStats } from '@/lib/api/bids';
import { getJobById, getJobStats, type Job } from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

interface JobSummary {
  id: string;
  title: string;
  status: Job['status'];
  budget: {
    type: 'FIXED' | 'HOURLY';
    minAmount?: number;
    maxAmount?: number;
    amount?: number;
  };
  postedAt: string;
  proposalCount: number;
  shortlistedCount: number;
  interviewedCount: number;
}

interface PageProps {
  params: Promise<{ jobId: string }>;
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getJobSummary(jobId: string): Promise<JobSummary | null> {
  try {
    const [job, stats, proposalStats] = await Promise.all([
      getJobById(jobId),
      getJobStats(jobId).catch(() => ({
        proposalCount: 0,
        viewCount: 0,
        averageBid: 0,
        invitesSent: 0,
        interviewsActive: 0,
      })),
      getClientProposalStats(jobId).catch(
        () =>
          ({ shortlistedCount: 0, totalProposals: 0 }) as {
            shortlistedCount: number;
            totalProposals: number;
          }
      ),
    ]);

    return {
      id: job.id,
      title: job.title,
      status: job.status,
      budget: {
        type: job.budgetType === 'HOURLY' ? 'HOURLY' : 'FIXED',
        minAmount: job.budgetMin,
        maxAmount: job.budgetMax,
      },
      postedAt: job.createdAt,
      proposalCount: stats.proposalCount || job.proposalCount,
      shortlistedCount: proposalStats.shortlistedCount,
      interviewedCount: stats.interviewsActive,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { jobId } = await params;
  const job = await getJobSummary(jobId);

  if (!job) {
    return { title: 'Job Not Found' };
  }

  return {
    title: `Proposals for "${job.title}" | Skillancer`,
    description: `Review ${job.proposalCount} proposals for your job posting`,
  };
}

// ============================================================================
// Page
// ============================================================================

export default async function ClientProposalsPage({ params }: Readonly<PageProps>) {
  const { jobId } = await params;
  const job = await getJobSummary(jobId);

  if (!job) {
    notFound();
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2 text-sm"
            href="/dashboard/jobs"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Jobs
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h1 className="text-2xl font-bold">Proposals</h1>
                <Badge variant="secondary">{job.proposalCount}</Badge>
              </div>
              <p className="text-muted-foreground">{job.title}</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">Budget</p>
                <p className="font-semibold">
                  {job.budget.type === 'FIXED'
                    ? `${formatCurrency(job.budget.minAmount ?? 0)} - ${formatCurrency(job.budget.maxAmount ?? 0)}`
                    : `${formatCurrency(job.budget.amount ?? 0)}/hr`}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/dashboard/jobs/${jobId}`}>Edit Job</Link>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-400" />
                <span className="text-2xl font-bold">{job.proposalCount}</span>
              </div>
              <p className="text-muted-foreground text-sm">Total Proposals</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="text-2xl font-bold">{job.shortlistedCount}</span>
              </div>
              <p className="text-muted-foreground text-sm">Shortlisted</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-400" />
                <span className="text-2xl font-bold">{job.interviewedCount}</span>
              </div>
              <p className="text-muted-foreground text-sm">Interviewed</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-slate-400" />
                <span className="text-2xl font-bold">0</span>
              </div>
              <p className="text-muted-foreground text-sm">Comparing</p>
            </div>
          </div>
        </div>

        {/* Proposals content */}
        <ProposalsClient jobId={jobId} />
      </div>
    </div>
  );
}
