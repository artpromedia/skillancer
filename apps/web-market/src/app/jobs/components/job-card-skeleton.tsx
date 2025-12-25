import { Skeleton, cn } from '@skillancer/ui';

interface JobCardSkeletonProps {
  viewMode?: 'list' | 'grid';
}

export function JobCardSkeleton({ viewMode = 'list' }: JobCardSkeletonProps) {
  const isGrid = viewMode === 'grid';

  return (
    <div className={cn('bg-card rounded-lg border p-4', isGrid ? 'h-full min-h-[280px]' : '')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Description */}
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Skills */}
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="w-18 h-6 rounded-full" />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}
