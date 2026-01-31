'use client';

import { Badge, Button, Card, cn, Skeleton } from '@skillancer/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase } from 'lucide-react';
import Link from 'next/link';

import { getRelatedJobs, type Job } from '@/lib/api/jobs';

interface SimilarJobsProps {
  jobId: string;
  limit?: number;
  className?: string;
}

function SimilarJobCard({ job }: Readonly<{ job: Job }>) {
  return (
    <Card className="hover:border-primary/50 p-4 transition-colors">
      <Link className="space-y-2" href={`/jobs/${job.slug}`}>
        <h4 className="line-clamp-2 font-medium">{job.title}</h4>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>
            {job.budgetType === 'FIXED'
              ? `$${job.budgetMin?.toLocaleString() ?? 0}${job.budgetMax ? ` - $${job.budgetMax.toLocaleString()}` : ''}`
              : `$${job.budgetMin ?? 0}/hr`}
          </span>
          <span>•</span>
          <span>{job.proposalCount} proposals</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {job.skills.slice(0, 3).map((skill) => (
            <Badge key={skill.id} className="text-xs" variant="secondary">
              {skill.name}
            </Badge>
          ))}
        </div>
      </Link>
    </Card>
  );
}

function SimilarJobsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function SimilarJobs({ jobId, limit = 5, className }: Readonly<SimilarJobsProps>) {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', 'similar', jobId],
    queryFn: () => getRelatedJobs(jobId, limit),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <h3 className="flex items-center gap-2 font-semibold">
          <Briefcase className="h-4 w-4" />
          Similar Jobs
        </h3>
        <SimilarJobsSkeleton count={limit} />
      </div>
    );
  }

  if (!jobs?.length) return null;

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="flex items-center gap-2 font-semibold">
        <Briefcase className="h-4 w-4" />
        Similar Jobs
      </h3>
      <div className="space-y-3">
        {jobs.map((job) => (
          <SimilarJobCard key={job.id} job={job} />
        ))}
      </div>
      <Button asChild className="w-full" size="sm" variant="ghost">
        <Link href={`/jobs?similar=${jobId}`}>
          View more similar jobs
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
