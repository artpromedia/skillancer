import { Skeleton } from '@skillancer/ui';

export function JobDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Card Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-3/4" />
          </div>
          <Skeleton className="h-14 w-32" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>

        <div className="mt-6 flex gap-3 border-t pt-6">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-11" />
          <Skeleton className="h-11 w-11" />
        </div>
      </div>

      {/* Description Card Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>

      {/* Skills Card Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Client Card Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
