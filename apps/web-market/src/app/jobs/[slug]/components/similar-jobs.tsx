import { Card, CardContent, CardHeader, Button, Badge, formatRelativeTime } from '@skillancer/ui';
import { ArrowRight, Clock, DollarSign } from 'lucide-react';
import Link from 'next/link';

import type { Job } from '@/lib/api/jobs';

interface SimilarJobsProps {
  jobs: Job[];
}

export function SimilarJobs({ jobs }: SimilarJobsProps) {
  if (jobs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Similar Jobs</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.map((job) => (
          <Link key={job.id} className="group block" href={`/jobs/${job.slug}`}>
            <div className="hover:border-primary/50 hover:bg-muted/50 rounded-lg border p-3 transition-colors">
              <h3 className="group-hover:text-primary line-clamp-2 text-sm font-medium transition-colors">
                {job.title}
              </h3>

              <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(job.createdAt)}
                </span>

                {job.budgetType && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatBudgetShort(job)}
                  </span>
                )}
              </div>

              {job.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {job.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill.id} className="px-1.5 py-0 text-xs" variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
                  {job.skills.length > 3 && (
                    <Badge className="px-1.5 py-0 text-xs" variant="secondary">
                      +{job.skills.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </Link>
        ))}

        <Button asChild className="w-full gap-2" variant="ghost">
          <Link href="/jobs">
            View all jobs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function formatBudgetShort(job: Job): string {
  const { budgetType, budgetMin, budgetMax } = job;

  if (!budgetMin && !budgetMax) return 'TBD';

  const format = (n: number) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n}`;
  };

  if (budgetType === 'HOURLY') {
    return budgetMax ? `${format(budgetMax)}/hr` : budgetMin ? `${format(budgetMin)}/hr` : 'TBD';
  }

  return budgetMax ? format(budgetMax) : budgetMin ? format(budgetMin) : 'TBD';
}
