/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import {
  Check,
  ChevronDown,
  Filter,
  Grid3X3,
  List,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import {
  type FreelancerListItem,
  type FreelancerSearchFilters,
  type FreelancerSearchResponse,
  type FreelancerSortBy,
  searchFreelancers,
} from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface FreelancerSearchProps {
  initialParams: {
    q?: string;
    skills?: string | string[];
    minRate?: string;
    maxRate?: string;
    verification?: string;
    availability?: string;
    country?: string;
    sortBy?: string;
    page?: string;
  };
}

// ============================================================================
// Freelancer Card
// ============================================================================

function FreelancerCard({
  freelancer,
  viewMode,
}: {
  freelancer: FreelancerListItem;
  viewMode: 'grid' | 'list';
}) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getVerificationIcon = () => {
    if (freelancer.verificationLevel === 'PREMIUM' || freelancer.verificationLevel === 'ENHANCED') {
      return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
    }
    if (freelancer.verificationLevel === 'BASIC') {
      return <Shield className="h-4 w-4 text-blue-600" />;
    }
    return null;
  };

  if (viewMode === 'list') {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          {/* Avatar */}
          <Link className="shrink-0" href={freelancer.profileUrl}>
            <Avatar className="h-14 w-14">
              <AvatarImage alt={freelancer.displayName} src={freelancer.avatarUrl} />
              <AvatarFallback>{getInitials(freelancer.displayName)}</AvatarFallback>
            </Avatar>
          </Link>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link className="hover:text-primary font-medium" href={freelancer.profileUrl}>
                {freelancer.displayName}
              </Link>
              {getVerificationIcon()}
              {freelancer.isOnline && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
            </div>
            <p className="text-muted-foreground text-sm">{freelancer.title}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {freelancer.primarySkills.slice(0, 4).map((skill) => (
                <Badge key={skill.id} className="text-xs" variant="secondary">
                  {skill.name}
                  {skill.isVerified && <Check className="ml-0.5 h-2.5 w-2.5" />}
                </Badge>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="hidden shrink-0 text-right sm:block">
            <div className="flex items-center justify-end gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{freelancer.avgRating.toFixed(1)}</span>
              <span className="text-muted-foreground text-sm">({freelancer.totalReviews})</span>
            </div>
            <p className="text-muted-foreground text-sm">{freelancer.totalJobs} jobs</p>
            <p className="text-muted-foreground text-sm">{freelancer.jobSuccessRate}% success</p>
          </div>

          {/* Rate and action */}
          <div className="shrink-0 text-right">
            {freelancer.hourlyRate && (
              <p className="text-lg font-semibold">
                ${freelancer.hourlyRate}
                <span className="text-muted-foreground text-sm font-normal">/hr</span>
              </p>
            )}
            <Button asChild className="mt-2" size="sm" variant="outline">
              <Link href={freelancer.profileUrl}>View Profile</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link className="shrink-0" href={freelancer.profileUrl}>
            <Avatar className="h-12 w-12">
              <AvatarImage alt={freelancer.displayName} src={freelancer.avatarUrl} />
              <AvatarFallback>{getInitials(freelancer.displayName)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                className="hover:text-primary truncate font-medium"
                href={freelancer.profileUrl}
              >
                {freelancer.displayName}
              </Link>
              {getVerificationIcon()}
            </div>
            <p className="text-muted-foreground truncate text-sm">{freelancer.title}</p>
          </div>
        </div>

        {/* Location */}
        {freelancer.location && (
          <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3" />
            {freelancer.location}
          </div>
        )}

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{freelancer.avgRating.toFixed(1)}</span>
            <span className="text-muted-foreground">({freelancer.totalReviews})</span>
          </div>
          <span className="text-muted-foreground">{freelancer.jobSuccessRate}% success</span>
        </div>

        {/* Rate */}
        {freelancer.hourlyRate && (
          <p className="mt-2 text-lg font-semibold">
            ${freelancer.hourlyRate}
            <span className="text-muted-foreground text-sm font-normal">/hr</span>
          </p>
        )}

        {/* Skills */}
        <div className="mt-3 flex flex-wrap gap-1">
          {freelancer.primarySkills.slice(0, 3).map((skill) => (
            <Badge key={skill.id} className="text-xs" variant="secondary">
              {skill.name}
            </Badge>
          ))}
          {freelancer.primarySkills.length > 3 && (
            <Badge className="text-xs" variant="outline">
              +{freelancer.primarySkills.length - 3}
            </Badge>
          )}
        </div>

        {/* Action */}
        <Button asChild className="mt-4 w-full" size="sm">
          <Link href={freelancer.profileUrl}>View Profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FreelancerSearch({ initialParams }: FreelancerSearchProps) {
  const router = useRouter();
  const _searchParams = useSearchParams();
  const [_isPending, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialParams.q ?? '');
  const [results, setResults] = useState<FreelancerSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse initial filters
  const [filters, setFilters] = useState<FreelancerSearchFilters>({
    query: initialParams.q,
    skills: Array.isArray(initialParams.skills)
      ? initialParams.skills
      : initialParams.skills
        ? [initialParams.skills]
        : undefined,
    minRate: initialParams.minRate ? parseInt(initialParams.minRate, 10) : undefined,
    maxRate: initialParams.maxRate ? parseInt(initialParams.maxRate, 10) : undefined,
    verificationLevel: initialParams.verification as FreelancerSearchFilters['verificationLevel'],
    availability: initialParams.availability as FreelancerSearchFilters['availability'],
    country: initialParams.country,
  });

  const [sortBy, setSortBy] = useState<FreelancerSortBy>(
    (initialParams.sortBy as FreelancerSortBy) ?? 'relevance'
  );
  const [page, setPage] = useState(initialParams.page ? parseInt(initialParams.page, 10) : 1);

  // Fetch results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const data = await searchFreelancers({
        ...filters,
        sortBy,
        page,
        limit: 20,
      });
      setResults(data);
    } catch (error) {
      console.error('Failed to fetch freelancers:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, page]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  // Update URL
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.skills?.length) filters.skills.forEach((s) => params.append('skills', s));
    if (filters.minRate) params.set('minRate', String(filters.minRate));
    if (filters.maxRate) params.set('maxRate', String(filters.maxRate));
    if (filters.verificationLevel) params.set('verification', filters.verificationLevel);
    if (filters.availability) params.set('availability', filters.availability);
    if (filters.country) params.set('country', filters.country);
    if (sortBy !== 'relevance') params.set('sortBy', sortBy);
    if (page > 1) params.set('page', String(page));

    startTransition(() => {
      router.push(`/freelancers?${params.toString()}`, { scroll: false });
    });
  }, [filters, sortBy, page, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, query: searchQuery }));
    setPage(1);
    updateURL();
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setSortBy('relevance');
    setPage(1);
  };

  const activeFilterCount = [
    filters.skills?.length ?? 0,
    filters.minRate ? 1 : 0,
    filters.maxRate ? 1 : 0,
    filters.verificationLevel ? 1 : 0,
    filters.availability ? 1 : 0,
    filters.country ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters sidebar - Mobile toggle */}
        <div className="lg:hidden">
          <Button
            className="w-full justify-between"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showFilters && 'rotate-180')}
            />
          </Button>
        </div>

        {/* Filters sidebar */}
        <aside className={cn('w-full shrink-0 lg:w-64', !showFilters && 'hidden lg:block')}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Filters</h3>
                {activeFilterCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              <div className="mt-4 space-y-4">
                {/* Verification Level */}
                <div>
                  <label className="text-sm font-medium" htmlFor="verification-filter">
                    Verification
                  </label>
                  <Select
                    value={filters.verificationLevel ?? 'any'}
                    onValueChange={(v) =>
                      setFilters((prev) => ({
                        ...prev,
                        verificationLevel:
                          v === 'any'
                            ? undefined
                            : (v as FreelancerSearchFilters['verificationLevel']),
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1" id="verification-filter">
                      <SelectValue placeholder="Any level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any level</SelectItem>
                      <SelectItem value="BASIC">ID Verified</SelectItem>
                      <SelectItem value="ENHANCED">Enhanced</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Availability */}
                <div>
                  <label className="text-sm font-medium" htmlFor="availability-filter">
                    Availability
                  </label>
                  <Select
                    value={filters.availability ?? 'any'}
                    onValueChange={(v) =>
                      setFilters((prev) => ({
                        ...prev,
                        availability:
                          v === 'any' ? undefined : (v as FreelancerSearchFilters['availability']),
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1" id="availability-filter">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="AVAILABLE">Available Now</SelectItem>
                      <SelectItem value="PARTIALLY_AVAILABLE">Partially Available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hourly Rate */}
                <div>
                  <label className="text-sm font-medium" htmlFor="min-rate-filter">
                    Hourly Rate
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      className="w-full"
                      id="min-rate-filter"
                      placeholder="Min"
                      type="number"
                      value={filters.minRate ?? ''}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          minRate: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        }))
                      }
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      className="w-full"
                      placeholder="Max"
                      type="number"
                      value={filters.maxRate ?? ''}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          maxRate: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        }))
                      }
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={updateURL}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Search bar */}
          <form className="flex gap-2" onSubmit={handleSearch}>
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search by skill, name, or keyword..."
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          {/* Results header */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {results
                ? `${results.total} freelancer${results.total !== 1 ? 's' : ''} found`
                : 'Loading...'}
            </p>

            <div className="flex items-center gap-2">
              <Select
                value={sortBy}
                onValueChange={(v) => {
                  setSortBy(v as FreelancerSortBy);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="hourlyRate">Hourly Rate</SelectItem>
                  <SelectItem value="jobsCompleted">Jobs Completed</SelectItem>
                  <SelectItem value="recentlyActive">Recently Active</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex rounded-lg border">
                <Button
                  size="icon"
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="mt-6">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-muted h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="bg-muted h-4 w-3/4 rounded" />
                          <div className="bg-muted h-3 w-1/2 rounded" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : results && results.freelancers.length > 0 ? (
              <div
                className={cn(
                  'grid gap-4',
                  viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
                )}
              >
                {results.freelancers.map((freelancer) => (
                  <FreelancerCard key={freelancer.id} freelancer={freelancer} viewMode={viewMode} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="text-muted-foreground/30 h-12 w-12" />
                <h3 className="mt-4 font-semibold">No freelancers found</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Try adjusting your search or filters
                </p>
                <Button className="mt-4" variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>

          {/* Pagination */}
          {results && results.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                disabled={page === 1}
                variant="outline"
                onClick={() => {
                  setPage((p) => p - 1);
                  updateURL();
                }}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {page} of {results.totalPages}
              </span>
              <Button
                disabled={page === results.totalPages}
                variant="outline"
                onClick={() => {
                  setPage((p) => p + 1);
                  updateURL();
                }}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
