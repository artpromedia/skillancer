'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Badge,
  cn,
} from '@skillancer/ui';
import { Grid3X3, List, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { useRef, useCallback, useEffect } from 'react';

import { useJobSearch } from '@/hooks/use-job-search';
import { useJobStore } from '@/stores/job-store';

import { JobCard } from './job-card';
import { JobCardSkeleton } from './job-card-skeleton';

import type { JobSearchResult, JobSearchFilters } from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

interface JobListProps {
  initialData: JobSearchResult;
  initialFilters: JobSearchFilters;
}

// ============================================================================
// Sort Options
// ============================================================================

const sortOptions = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'newest', label: 'Newest First' },
  { value: 'budget_high', label: 'Budget: High to Low' },
  { value: 'budget_low', label: 'Budget: Low to High' },
  { value: 'bids_count', label: 'Fewest Proposals' },
];

// ============================================================================
// Component
// ============================================================================

export function JobList({ initialData, initialFilters }: JobListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Store state
  const viewMode = useJobStore((state) => state.viewMode);
  const setViewMode = useJobStore((state) => state.setViewMode);
  const toggleFilters = useJobStore((state) => state.toggleFilters);
  const filtersOpen = useJobStore((state) => state.filtersOpen);

  // Job search hook
  const {
    jobs,
    total,
    hasMore,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error,
    loadMore,
    sortBy,
    setSortBy,
    activeFilterCount,
    clearFilters,
    filters,
    removeFilter,
  } = useJobSearch({
    initialData,
    initialFilters,
  });

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isFetchingNextPage) {
        loadMore();
      }
    },
    [hasMore, isFetchingNextPage, loadMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  // Get active filter chips
  const filterChips = Object.entries(filters)
    .filter(([key, value]) => {
      if (key === 'sortBy') return false;
      return value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
    })
    .map(([key, value]) => ({
      key: key as keyof JobSearchFilters,
      label: formatFilterLabel(key, value),
    }));

  // Loading state
  if (isLoading && jobs.length === 0) {
    return <JobListSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        actionLabel="Try Again"
        description={error.message || 'Failed to load jobs. Please try again.'}
        icon={<SlidersHorizontal className="h-12 w-12" />}
        title="Something went wrong"
        onAction={() => window.location.reload()}
      />
    );
  }

  // Empty state
  if (!isLoading && jobs.length === 0) {
    return (
      <EmptyState
        actionLabel={activeFilterCount > 0 ? 'Clear Filters' : undefined}
        description={
          activeFilterCount > 0
            ? 'Try adjusting your filters to find more opportunities.'
            : 'New jobs are posted every day. Check back soon!'
        }
        title="No jobs found"
        onAction={activeFilterCount > 0 ? clearFilters : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {/* Results count */}
          <span className="text-muted-foreground text-sm">{total.toLocaleString()} jobs found</span>

          {/* Mobile filter toggle */}
          <Button className="gap-2 lg:hidden" size="sm" variant="outline" onClick={toggleFilters}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="h-5 min-w-5 px-1" variant="secondary">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" size="sm" variant="outline">
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {sortOptions.find((o) => o.value === sortBy)?.label || 'Sort'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className={cn(sortBy === option.value && 'bg-accent')}
                  onClick={() => setSortBy(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <div className="hidden items-center rounded-md border sm:flex">
            <Button
              aria-label="List view"
              className="rounded-r-none px-2"
              size="sm"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              aria-label="Grid view"
              className="rounded-l-none px-2"
              size="sm"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterChips.map(({ key, label }) => (
            <Badge
              key={key}
              className="hover:bg-secondary/80 cursor-pointer gap-1 py-1 pl-2 pr-1"
              variant="secondary"
              onClick={() => removeFilter(key)}
            >
              {label}
              <span className="hover:bg-muted-foreground/20 ml-1 rounded-full p-0.5">×</span>
            </Badge>
          ))}
          <Button
            className="text-muted-foreground h-6 text-xs"
            size="sm"
            variant="ghost"
            onClick={clearFilters}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Job Cards */}
      <div className={cn(viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4')}>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} viewMode={viewMode} />
        ))}

        {/* Loading more skeletons */}
        {isFetchingNextPage && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <JobCardSkeleton key={`loading-${i}`} viewMode={viewMode} />
            ))}
          </>
        )}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-10" />

      {/* End of results */}
      {!hasMore && jobs.length > 0 && (
        <div className="text-muted-foreground py-8 text-center">
          <p className="text-sm">You've seen all {total} jobs</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatFilterLabel(key: string, value: unknown): string {
  switch (key) {
    case 'query':
      return `"${value}"`;
    case 'skills':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'budgetType':
      return value === 'FIXED' ? 'Fixed Price' : 'Hourly';
    case 'experienceLevel':
      return String(value).charAt(0) + String(value).slice(1).toLowerCase();
    case 'category':
    case 'subcategory':
      return String(value).replace(/-/g, ' ');
    case 'duration':
      return String(value).replace(/_/g, ' ');
    case 'postedWithin':
      return `Posted ${value}`;
    case 'clientHistory':
      return value === 'verified' ? 'Payment Verified' : 'Top Clients';
    case 'budgetMin':
      return `Min $${value}`;
    case 'budgetMax':
      return `Max $${value}`;
    default:
      return String(value);
  }
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function JobListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-5 w-32 animate-pulse rounded" />
        <div className="flex gap-2">
          <div className="bg-muted h-8 w-24 animate-pulse rounded" />
          <div className="bg-muted h-8 w-20 animate-pulse rounded" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <JobCardSkeleton key={i} viewMode="list" />
        ))}
      </div>
    </div>
  );
}
