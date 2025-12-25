'use client';

import { Card, CardContent } from '@skillancer/ui';

export function FreelancerSearchSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters sidebar skeleton */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="animate-pulse">
            <CardContent className="space-y-4 p-4">
              <div className="bg-muted h-6 w-20 rounded" />

              {/* Filter sections */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="bg-muted h-4 w-24 rounded" />
                  <div className="bg-muted h-10 rounded" />
                </div>
              ))}

              <div className="bg-muted h-10 rounded" />
            </CardContent>
          </Card>
        </aside>

        {/* Main content skeleton */}
        <div className="min-w-0 flex-1">
          {/* Search bar skeleton */}
          <div className="flex gap-2">
            <div className="bg-muted h-10 flex-1 rounded-lg" />
            <div className="bg-muted h-10 w-20 rounded-lg" />
          </div>

          {/* Results header skeleton */}
          <div className="mt-6 flex items-center justify-between">
            <div className="bg-muted h-5 w-32 rounded" />
            <div className="flex items-center gap-2">
              <div className="bg-muted h-10 w-40 rounded" />
              <div className="bg-muted h-10 w-20 rounded" />
            </div>
          </div>

          {/* Results grid skeleton */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="bg-muted h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="bg-muted h-4 w-3/4 rounded" />
                      <div className="bg-muted h-3 w-1/2 rounded" />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="bg-muted mt-2 h-3 w-24 rounded" />

                  {/* Stats */}
                  <div className="mt-3 flex gap-4">
                    <div className="bg-muted h-4 w-16 rounded" />
                    <div className="bg-muted h-4 w-20 rounded" />
                  </div>

                  {/* Rate */}
                  <div className="bg-muted mt-2 h-6 w-20 rounded" />

                  {/* Skills */}
                  <div className="mt-3 flex gap-1">
                    <div className="bg-muted h-5 w-16 rounded-full" />
                    <div className="bg-muted h-5 w-14 rounded-full" />
                    <div className="bg-muted h-5 w-10 rounded-full" />
                  </div>

                  {/* Button */}
                  <div className="bg-muted mt-4 h-9 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
