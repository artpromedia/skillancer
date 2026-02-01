'use client';

/**
 * Client Jobs Dashboard Page
 *
 * Lists all jobs posted by the current client with management options.
 */

import { Badge, Button, Card, CardContent, Skeleton } from '@skillancer/ui';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Pause,
  Play,
  X,
  Users,
  Clock,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';

import type { Job } from '@/lib/api/jobs';

import { useClientJobs, useClientJobStats } from '@/hooks/use-client-jobs';
import { useJobMutations } from '@/hooks/use-job-mutations';

// ============================================================================
// Types
// ============================================================================

type JobStatusFilter = 'ALL' | Job['status'];

interface StatsCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loading?: boolean;
  value: number;
}

interface JobStatusBadgeProps {
  status: Job['status'];
}

interface JobCardProps {
  isLoading: boolean;
  job: Job;
  onClose: (jobId: string) => void;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
}

interface EmptyStateProps {
  status: JobStatusFilter;
}

// ============================================================================
// Components
// ============================================================================

function StatsCard({ icon: Icon, label, loading, value }: Readonly<StatsCardProps>) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
          <Icon className="text-primary h-6 w-6" />
        </div>
        <div>
          {loading ? (
            <>
              <Skeleton className="mb-1 h-6 w-12" />
              <Skeleton className="h-4 w-20" />
            </>
          ) : (
            <>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-muted-foreground text-sm">{label}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function JobStatusBadge({ status }: Readonly<JobStatusBadgeProps>) {
  const variants: Record<
    Job['status'],
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    CLOSED: { label: 'Closed', variant: 'secondary' },
    COMPLETED: { label: 'Completed', variant: 'default' },
    DRAFT: { label: 'Draft', variant: 'secondary' },
    OPEN: { label: 'Open', variant: 'default' },
    PAUSED: { label: 'Paused', variant: 'outline' },
    PUBLISHED: { label: 'Active', variant: 'default' },
  };

  const { label, variant } = variants[status] ?? { label: status, variant: 'secondary' };

  return <Badge variant={variant}>{label}</Badge>;
}

function JobCard({ isLoading, job, onClose, onPause, onResume }: Readonly<JobCardProps>) {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const budgetDisplay = useMemo(() => {
    if (job.budgetMin && job.budgetMax) {
      return `${formatCurrency(job.budgetMin)} - ${formatCurrency(job.budgetMax)}`;
    }
    if (job.budgetMin) {
      return formatCurrency(job.budgetMin);
    }
    return 'Budget TBD';
  }, [job.budgetMin, job.budgetMax]);

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Title and status */}
            <div className="mb-2 flex items-center gap-3">
              <Link
                className="hover:text-primary truncate text-lg font-semibold"
                href={`/dashboard/jobs/${job.id}/proposals`}
              >
                {job.title}
              </Link>
              <JobStatusBadge status={job.status} />
            </div>

            {/* Description preview */}
            <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">{job.description}</p>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span>{budgetDisplay}</span>
                <Badge className="ml-1" variant="outline">
                  {job.budgetType}
                </Badge>
              </div>

              <div className="text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{job.proposalCount} proposals</span>
              </div>

              <div className="text-muted-foreground flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{job.viewCount} views</span>
              </div>

              <div className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Posted {formatDate(job.createdAt)}</span>
              </div>
            </div>

            {/* Skills */}
            {job.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {job.skills.slice(0, 5).map((skill) => (
                  <Badge key={skill.id} className="text-xs" variant="secondary">
                    {skill.name}
                  </Badge>
                ))}
                {job.skills.length > 5 && (
                  <Badge className="text-xs" variant="secondary">
                    +{job.skills.length - 5} more
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="relative">
            <Button
              disabled={isLoading}
              size="icon"
              variant="ghost"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showActions && (
              <div className="bg-popover absolute right-0 top-full z-10 mt-1 w-48 rounded-md border shadow-md">
                <div className="p-1">
                  <button
                    className="hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-sm"
                    onClick={() => {
                      router.push(`/dashboard/jobs/${job.id}/proposals`);
                      setShowActions(false);
                    }}
                  >
                    <Users className="h-4 w-4" />
                    View Proposals
                  </button>

                  <button
                    className="hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-sm"
                    onClick={() => {
                      router.push(`/jobs/${job.slug}`);
                      setShowActions(false);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    View Job Listing
                  </button>

                  {job.status === 'DRAFT' && (
                    <button
                      className="hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-sm"
                      onClick={() => {
                        router.push(`/dashboard/jobs/${job.id}/edit`);
                        setShowActions(false);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Draft
                    </button>
                  )}

                  {(job.status === 'OPEN' || job.status === 'PUBLISHED') && (
                    <button
                      className="hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-sm"
                      onClick={() => {
                        onPause(job.id);
                        setShowActions(false);
                      }}
                    >
                      <Pause className="h-4 w-4" />
                      Pause Job
                    </button>
                  )}

                  {job.status === 'PAUSED' && (
                    <button
                      className="hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-sm"
                      onClick={() => {
                        onResume(job.id);
                        setShowActions(false);
                      }}
                    >
                      <Play className="h-4 w-4" />
                      Resume Job
                    </button>
                  )}

                  {job.status !== 'CLOSED' && job.status !== 'COMPLETED' && (
                    <button
                      className="hover:bg-destructive/10 text-destructive flex w-full items-center gap-2 rounded px-3 py-2 text-sm"
                      onClick={() => {
                        onClose(job.id);
                        setShowActions(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                      Close Job
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobsListSkeleton() {
  const skeletonIds = ['jobs-skeleton-1', 'jobs-skeleton-2', 'jobs-skeleton-3'] as const;
  return (
    <div className="space-y-4">
      {skeletonIds.map((id) => (
        <Card key={id}>
          <CardContent className="p-6">
            <Skeleton className="mb-2 h-6 w-3/4" />
            <Skeleton className="mb-4 h-4 w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ status }: Readonly<EmptyStateProps>) {
  const messages: Record<JobStatusFilter, { description: string; title: string }> = {
    ALL: {
      description:
        'Create your first job posting to start receiving proposals from talented freelancers.',
      title: 'No jobs posted yet',
    },
    CLOSED: {
      description: 'Jobs you close will appear here.',
      title: 'No closed jobs',
    },
    COMPLETED: {
      description: 'Jobs marked as completed will appear here.',
      title: 'No completed jobs',
    },
    DRAFT: {
      description: 'Start a new job posting and save it as a draft to continue later.',
      title: 'No draft jobs',
    },
    OPEN: {
      description: "You don't have any active job postings right now.",
      title: 'No open jobs',
    },
    PAUSED: {
      description: "You don't have any paused job postings.",
      title: 'No paused jobs',
    },
    PUBLISHED: {
      description: 'Publish a draft job to make it visible to freelancers.',
      title: 'No published jobs',
    },
  };

  const { description, title } = messages[status];

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <AlertCircle className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mb-4 max-w-md">{description}</p>
        <Button asChild>
          <Link href="/post-job">
            <Plus className="mr-2 h-4 w-4" />
            Post a Job
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ClientJobsPage() {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get('status') as JobStatusFilter) ?? 'ALL';

  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>(initialStatus);
  const [searchQuery, setSearchQuery] = useState('');

  const { stats, isLoading: statsLoading } = useClientJobStats();

  const filters = useMemo(() => {
    return statusFilter === 'ALL' ? {} : { status: statusFilter };
  }, [statusFilter]);

  const { jobs, isLoading, isFetching, hasMore, loadMore, error } = useClientJobs({
    filters,
  });

  const { pauseJob, resumeJob, closeJob, isPausing, isResuming, isClosing } = useJobMutations({
    onError: (error) => {
      console.error('Job action failed:', error);
      // Would show toast notification here
    },
  });

  const filteredJobs = useMemo(() => {
    if (!searchQuery) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query) ||
        job.skills.some((s) => s.name.toLowerCase().includes(query))
    );
  }, [jobs, searchQuery]);

  const handlePause = useCallback(
    (jobId: string) => {
      pauseJob(jobId);
    },
    [pauseJob]
  );

  const handleResume = useCallback(
    (jobId: string) => {
      resumeJob(jobId);
    },
    [resumeJob]
  );

  const handleClose = useCallback(
    (jobId: string) => {
      if (
        confirm('Are you sure you want to close this job? This will stop accepting new proposals.')
      ) {
        closeJob({ jobId });
      }
    },
    [closeJob]
  );

  const isActionLoading = isPausing || isResuming || isClosing;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Jobs</h1>
          <p className="text-muted-foreground">Manage your job postings and view proposals</p>
        </div>
        <Button asChild>
          <Link href="/post-job">
            <Plus className="mr-2 h-4 w-4" />
            Post a Job
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <StatsCard
          icon={Eye}
          label="Active Jobs"
          loading={statsLoading}
          value={stats?.activeJobs ?? 0}
        />
        <StatsCard
          icon={Edit}
          label="Draft Jobs"
          loading={statsLoading}
          value={stats?.draftJobs ?? 0}
        />
        <StatsCard
          icon={Users}
          label="Total Proposals"
          loading={statsLoading}
          value={stats?.totalProposals ?? 0}
        />
        <StatsCard
          icon={DollarSign}
          label="Hired"
          loading={statsLoading}
          value={stats?.totalHired ?? 0}
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-1"
            placeholder="Search jobs..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="text-muted-foreground h-4 w-4" />
          <select
            className="border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobStatusFilter)}
          >
            <option value="ALL">All Status</option>
            <option value="OPEN">Open</option>
            <option value="DRAFT">Draft</option>
            <option value="PAUSED">Paused</option>
            <option value="CLOSED">Closed</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Jobs list */}
      {(() => {
        if (isLoading) {
          return <JobsListSkeleton />;
        }
        if (error) {
          return (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="text-destructive mx-auto mb-4 h-8 w-8" />
                <p className="text-destructive mb-2 font-medium">Failed to load jobs</p>
                <p className="text-muted-foreground text-sm">{error.message}</p>
              </CardContent>
            </Card>
          );
        }
        if (filteredJobs.length === 0) {
          return <EmptyState status={statusFilter} />;
        }
        return (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                isLoading={isActionLoading}
                job={job}
                onClose={handleClose}
                onPause={handlePause}
                onResume={handleResume}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button disabled={isFetching} variant="outline" onClick={loadMore}>
                  {isFetching ? 'Loading...' : 'Load More Jobs'}
                </Button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
