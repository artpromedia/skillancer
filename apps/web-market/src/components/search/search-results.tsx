'use client';

import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  Skeleton,
  EmptyState,
} from '@skillancer/ui';
import {
  Grid3X3,
  List,
  SlidersHorizontal,
  ArrowUpDown,
  AlertCircle,
  Search,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

import type { Job, JobSearchFilters } from '@/lib/api/jobs';

import { JobCard } from '@/app/jobs/components/job-card';
import { JobCardSkeleton } from '@/app/jobs/components/job-card-skeleton';

// ============================================================================
// Types
// ============================================================================

type SortByOption = 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'bids_count';
type ViewMode = 'list' | 'grid';

interface SearchResultsProps {
  jobs: Job[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;
  hasMore: boolean;
  onLoadMore: () => void;
  sortBy: SortByOption;
  onSortByChange: (sortBy: SortByOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  filters: JobSearchFilters;
  onToggleFilters?: () => void;
  showFiltersToggle?: boolean;
  noResultsSuggestions?: {
    alternativeQueries: string[];
    relatedCategories: { id: string; name: string; jobCount: number }[];
    popularSkills: { id: string; name: string; jobCount: number }[];
    broaderSearchTips: string[];
  };
  onSuggestionClick?: (query: string) => void;
  className?: string;
}

// ============================================================================
// Sort Options
// ============================================================================

const sortOptions: { value: SortByOption; label: string }[] = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'newest', label: 'Newest First' },
  { value: 'budget_high', label: 'Highest Budget' },
  { value: 'budget_low', label: 'Lowest Budget' },
  { value: 'bids_count', label: 'Fewest Proposals' },
];

// ============================================================================
// Results Header Component
// ============================================================================

interface ResultsHeaderProps {
  total: number;
  isLoading: boolean;
  sortBy: SortByOption;
  onSortByChange: (sortBy: SortByOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleFilters?: () => void;
  showFiltersToggle?: boolean;
}

function ResultsHeader({
  total,
  isLoading,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  onToggleFilters,
  showFiltersToggle,
}: Readonly<ResultsHeaderProps>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Results count */}
      <div className="flex items-center gap-2">
        {isLoading ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <span className="text-muted-foreground text-sm">
            <span className="text-foreground font-semibold">{total.toLocaleString()}</span> job
            {total !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Mobile filters toggle */}
        {showFiltersToggle && (
          <Button className="lg:hidden" size="sm" variant="outline" onClick={onToggleFilters}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
          </Button>
        )}

        {/* Sort dropdown */}
        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortByOption)}>
          <SelectTrigger className="h-9 w-[180px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode toggle */}
        <div className="bg-muted hidden rounded-md p-1 sm:flex">
          <Button
            aria-label="List view"
            className="h-7 w-7"
            size="icon"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Grid view"
            className="h-7 w-7"
            size="icon"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            onClick={() => onViewModeChange('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// No Results Component
// ============================================================================

interface NoResultsProps {
  query?: string;
  suggestions?: {
    alternativeQueries: string[];
    relatedCategories: { id: string; name: string; jobCount: number }[];
    popularSkills: { id: string; name: string; jobCount: number }[];
    broaderSearchTips: string[];
  };
  onSuggestionClick?: (query: string) => void;
}

function NoResults({ query, suggestions, onSuggestionClick }: Readonly<NoResultsProps>) {
  const hasAlternatives =
    suggestions?.alternativeQueries && suggestions.alternativeQueries.length > 0;
  const hasCategories = suggestions?.relatedCategories && suggestions.relatedCategories.length > 0;
  const hasSkills = suggestions?.popularSkills && suggestions.popularSkills.length > 0;
  const hasTips = suggestions?.broaderSearchTips && suggestions.broaderSearchTips.length > 0;

  return (
    <div className="py-12">
      <EmptyState
        description={
          query
            ? `We couldn't find any jobs matching "${query}". Try adjusting your search or filters.`
            : 'Try adjusting your filters to find more jobs.'
        }
        icon={<Search className="h-12 w-12" />}
        title="No jobs found"
      />

      {/* Suggestions */}
      <div className="mx-auto mt-8 max-w-2xl space-y-6">
        {/* Alternative queries */}
        {hasAlternatives && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Try these searches instead:</h4>
            <div className="flex flex-wrap gap-2">
              {suggestions.alternativeQueries.map((q) => (
                <Button key={q} size="sm" variant="outline" onClick={() => onSuggestionClick?.(q)}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Related categories */}
        {hasCategories && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Browse related categories:</h4>
            <div className="flex flex-wrap gap-2">
              {suggestions.relatedCategories.map((cat) => (
                <Link key={cat.id} className="group" href={`/jobs?category=${cat.id}`}>
                  <Badge className="group-hover:bg-primary/10" variant="secondary">
                    {cat.name}
                    <span className="text-muted-foreground ml-1 text-xs">({cat.jobCount})</span>
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Popular skills */}
        {hasSkills && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Popular skills with jobs:</h4>
            <div className="flex flex-wrap gap-2">
              {suggestions.popularSkills.map((skill) => (
                <Link
                  key={skill.id}
                  className="group"
                  href={`/jobs?skills=${encodeURIComponent(skill.name)}`}
                >
                  <Badge className="group-hover:border-primary" variant="outline">
                    {skill.name}
                    <span className="text-muted-foreground ml-1 text-xs">({skill.jobCount})</span>
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {hasTips && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              Tips for better results:
            </h4>
            <ul className="text-muted-foreground space-y-1 text-sm">
              {suggestions.broaderSearchTips.map((tip) => (
                <li key={tip} className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
}

function ErrorState({ error, onRetry }: Readonly<ErrorStateProps>) {
  return (
    <div className="py-12">
      <EmptyState
        actionLabel={onRetry ? 'Try Again' : undefined}
        description={error.message || 'Failed to load jobs. Please try again.'}
        icon={<AlertCircle className="h-12 w-12 text-red-500" />}
        title="Something went wrong"
        onAction={onRetry}
      />
    </div>
  );
}

// ============================================================================
// Loading Grid Component
// ============================================================================

interface LoadingGridProps {
  count?: number;
  viewMode: ViewMode;
}

function LoadingGrid({ count = 6, viewMode }: Readonly<LoadingGridProps>) {
  return (
    <div
      className={cn(viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-4')}
    >
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} viewMode={viewMode} />
      ))}
    </div>
  );
}

// ============================================================================
// Main SearchResults Component
// ============================================================================

export function SearchResults({
  jobs,
  total,
  isLoading,
  isFetching,
  isFetchingNextPage,
  error,
  hasMore,
  onLoadMore,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  filters,
  onToggleFilters,
  showFiltersToggle = true,
  noResultsSuggestions,
  onSuggestionClick,
  className,
}: Readonly<SearchResultsProps>) {
  // Memoize job rendering for performance
  const jobCards = useMemo(
    () => jobs.map((job) => <JobCard key={job.id} showMatchScore job={job} viewMode={viewMode} />),
    [jobs, viewMode]
  );

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage) {
      onLoadMore();
    }
  }, [isFetchingNextPage, onLoadMore]);

  // Error state
  if (error && !jobs.length) {
    return (
      <div className={className}>
        <ErrorState error={error} onRetry={onLoadMore} />
      </div>
    );
  }

  // Initial loading state
  if (isLoading && !jobs.length) {
    return (
      <div className={cn('space-y-6', className)}>
        <ResultsHeader
          isLoading
          showFiltersToggle={showFiltersToggle}
          sortBy={sortBy}
          total={0}
          viewMode={viewMode}
          onSortByChange={onSortByChange}
          onToggleFilters={onToggleFilters}
          onViewModeChange={onViewModeChange}
        />
        <LoadingGrid viewMode={viewMode} />
      </div>
    );
  }

  // No results
  if (!isLoading && jobs.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <ResultsHeader
          isLoading={false}
          showFiltersToggle={showFiltersToggle}
          sortBy={sortBy}
          total={0}
          viewMode={viewMode}
          onSortByChange={onSortByChange}
          onToggleFilters={onToggleFilters}
          onViewModeChange={onViewModeChange}
        />
        <NoResults
          query={filters.query}
          suggestions={noResultsSuggestions}
          onSuggestionClick={onSuggestionClick}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with count and controls */}
      <ResultsHeader
        isLoading={isFetching && !isFetchingNextPage}
        showFiltersToggle={showFiltersToggle}
        sortBy={sortBy}
        total={total}
        viewMode={viewMode}
        onSortByChange={onSortByChange}
        onToggleFilters={onToggleFilters}
        onViewModeChange={onViewModeChange}
      />

      {/* Job cards */}
      <div
        className={cn(
          viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-4'
        )}
      >
        {jobCards}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            className="min-w-[200px]"
            disabled={isFetchingNextPage}
            variant="outline"
            onClick={handleLoadMore}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Jobs'
            )}
          </Button>
        </div>
      )}

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more jobs...
          </div>
        </div>
      )}

      {/* End of results */}
      {!hasMore && jobs.length > 0 && (
        <div className="text-muted-foreground py-8 text-center text-sm">
          You&apos;ve seen all {total.toLocaleString()} jobs
        </div>
      )}
    </div>
  );
}
