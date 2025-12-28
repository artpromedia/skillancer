/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Badge, Card, CardContent } from '@skillancer/ui';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Shield,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProposalFormClient } from './proposal-form-client';

import type { Metadata } from 'next';

// ============================================================================
// Types
// ============================================================================

interface JobDetails {
  id: string;
  slug: string;
  title: string;
  description: string;
  budget: {
    type: 'FIXED' | 'HOURLY';
    minAmount?: number;
    maxAmount?: number;
    amount?: number;
  };
  duration: string;
  experienceLevel: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  skills: { id: string; name: string }[];
  category: { id: string; name: string };
  location?: string;
  isRemote: boolean;
  postedAt: string;
  proposalCount: number;
  client: {
    id: string;
    name: string;
    avatarUrl?: string;
    companyName?: string;
    rating: number;
    reviewCount: number;
    totalSpent: number;
    verificationLevel: 'BASIC' | 'VERIFIED' | 'PREMIUM';
    memberSince: string;
    hireRate: number;
  };
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getJobDetails(slug: string): Promise<JobDetails | null> {
  // Mock data - replace with actual API call
  // In production: const res = await fetch(`${API_URL}/jobs/${slug}`);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Mock job data
  return {
    id: 'job-1',
    slug,
    title: 'Senior Full-Stack Developer for E-commerce Platform',
    description: `We're looking for an experienced full-stack developer to help build and scale our e-commerce platform. 

The ideal candidate will have:
- Strong experience with React, Next.js, and Node.js
- Experience with PostgreSQL and Redis
- Understanding of microservices architecture
- Experience with cloud platforms (AWS/GCP)

This is a 3-month project with potential for extension.`,
    budget: {
      type: 'FIXED',
      minAmount: 5000,
      maxAmount: 10000,
    },
    duration: '3-6 months',
    experienceLevel: 'EXPERT',
    skills: [
      { id: 'skill-1', name: 'React' },
      { id: 'skill-2', name: 'Next.js' },
      { id: 'skill-3', name: 'Node.js' },
      { id: 'skill-4', name: 'PostgreSQL' },
      { id: 'skill-5', name: 'TypeScript' },
      { id: 'skill-6', name: 'AWS' },
    ],
    category: { id: 'cat-1', name: 'Web Development' },
    isRemote: true,
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    proposalCount: 12,
    client: {
      id: 'client-1',
      name: 'John Smith',
      companyName: 'TechCorp Inc.',
      rating: 4.8,
      reviewCount: 23,
      totalSpent: 125000,
      verificationLevel: 'VERIFIED',
      memberSince: '2021-03-15',
      hireRate: 72,
    },
  };
}

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const job = await getJobDetails(params.slug);

  if (!job) {
    return { title: 'Job Not Found' };
  }

  return {
    title: `Apply: ${job.title} | Skillancer`,
    description: `Submit your proposal for ${job.title}`,
    robots: { index: false },
  };
}

// ============================================================================
// Components
// ============================================================================

function JobSummaryCard({ job }: Readonly<{ job: JobDetails }>) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="sticky top-4">
      <CardContent className="p-6">
        {/* Header */}
        <div className="mb-4">
          <Badge className="mb-2" variant="secondary">
            {job.category.name}
          </Badge>
          <h2 className="text-lg font-semibold">{job.title}</h2>
        </div>

        {/* Key details */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="text-muted-foreground h-4 w-4" />
            <span>
              {job.budget.type === 'FIXED' ? (
                <>
                  {formatCurrency(job.budget.minAmount ?? 0)} -{' '}
                  {formatCurrency(job.budget.maxAmount ?? 0)}
                </>
              ) : (
                <>{formatCurrency(job.budget.amount ?? 0)}/hr</>
              )}
            </span>
            <Badge variant="outline">{job.budget.type}</Badge>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span>{job.duration}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="text-muted-foreground h-4 w-4" />
            <span>
              {job.experienceLevel.charAt(0) + job.experienceLevel.slice(1).toLowerCase()} Level
            </span>
          </div>

          {(() => {
            if (job.isRemote) {
              return (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="text-muted-foreground h-4 w-4" />
                  <span>Remote</span>
                </div>
              );
            }
            if (job.location) {
              return (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="text-muted-foreground h-4 w-4" />
                  <span>{job.location}</span>
                </div>
              );
            }
            return null;
          })()}

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="text-muted-foreground h-4 w-4" />
            <span>Posted {formatDate(job.postedAt)}</span>
          </div>
        </div>

        {/* Skills */}
        <div className="mb-6">
          <p className="text-muted-foreground mb-2 text-sm font-medium">Required Skills</p>
          <div className="flex flex-wrap gap-2">
            {job.skills.map((skill) => (
              <Badge key={skill.id} variant="secondary">
                {skill.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Client info */}
        <div className="rounded-lg border bg-slate-50 p-4">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
            About the Client
          </p>

          <div className="mb-3 flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full font-semibold">
              {job.client.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1 font-medium">
                {job.client.name}
                {job.client.verificationLevel !== 'BASIC' && (
                  <Shield className="h-4 w-4 text-blue-500" />
                )}
              </div>
              {job.client.companyName && (
                <p className="text-muted-foreground text-sm">{job.client.companyName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rating</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">{job.client.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({job.client.reviewCount})</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Spent</span>
              <span className="font-medium">{formatCurrency(job.client.totalSpent)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hire Rate</span>
              <span className="font-medium">{job.client.hireRate}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Member Since</span>
              <span>{formatDate(job.client.memberSince)}</span>
            </div>
          </div>
        </div>

        {/* Proposal count */}
        <div className="mt-4 rounded-lg bg-amber-50 p-3">
          <p className="text-center text-sm text-amber-800">
            <span className="font-semibold">{job.proposalCount}</span> proposals submitted
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Page
// ============================================================================

export default async function ApplyPage({ params }: Readonly<{ params: { slug: string } }>) {
  const job = await getJobDetails(params.slug);

  if (!job) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Back link */}
        <Link
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2 text-sm"
          href={`/jobs/${params.slug}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to job details
        </Link>

        {/* Main layout */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Sidebar - Job summary */}
          <div className="order-1 lg:order-2 lg:col-span-1">
            <JobSummaryCard job={job} />
          </div>

          {/* Main content - Proposal form */}
          <div className="order-2 lg:order-1 lg:col-span-2">
            <ProposalFormClient
              jobBudget={job.budget}
              jobId={job.id}
              jobSkills={job.skills.map((s) => s.name)}
              jobTitle={job.title}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
