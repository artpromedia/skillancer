/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
'use client';

import { Button, Separator, Badge, cn, Input, Label, ScrollArea } from '@skillancer/ui';
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Check,
  DollarSign,
  Clock,
  Star,
  Shield,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback, useTransition } from 'react';

import { useJobStore } from '@/stores/job-store';

import type { Category, JobSearchFilters } from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

interface JobFiltersProps {
  categories: Category[];
  initialFilters: JobSearchFilters;
  className?: string;
}

// ============================================================================
// Filter Options
// ============================================================================

const experienceLevels = [
  { value: 'ENTRY', label: 'Entry Level', description: 'Looking for entry-level talent' },
  { value: 'INTERMEDIATE', label: 'Intermediate', description: 'Some experience required' },
  { value: 'EXPERT', label: 'Expert', description: 'Significant experience required' },
];

const budgetTypes = [
  { value: 'FIXED', label: 'Fixed Price', icon: DollarSign },
  { value: 'HOURLY', label: 'Hourly Rate', icon: Clock },
];

const postedWithinOptions = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '3d', label: 'Last 3 days' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
];

const durationOptions = [
  { value: 'less_than_week', label: 'Less than a week' },
  { value: '1_to_4_weeks', label: '1 to 4 weeks' },
  { value: '1_to_3_months', label: '1 to 3 months' },
  { value: '3_to_6_months', label: '3 to 6 months' },
  { value: 'more_than_6_months', label: 'More than 6 months' },
];

const clientHistoryOptions = [
  { value: 'verified', label: 'Payment verified', icon: Shield },
  { value: 'top', label: 'Top clients', icon: Star },
];

// ============================================================================
// Component
// ============================================================================

export function JobFilters({ categories, initialFilters, className }: Readonly<JobFiltersProps>) {
  const router = useRouter();
  const _searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Local state for form controls
  const [filters, setFilters] = useState<JobSearchFilters>(initialFilters);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [budgetMin, setBudgetMin] = useState(filters.budgetMin?.toString() ?? '');
  const [budgetMax, setBudgetMax] = useState(filters.budgetMax?.toString() ?? '');

  // Store state - Zustand middleware type inference handled by file-level eslint-disable
  const _filtersOpen = useJobStore((state) => state.filtersOpen);
  const _toggleFilters = useJobStore((state) => state.toggleFilters);

  // Update URL with new filters
  const applyFilters = useCallback(
    (newFilters: JobSearchFilters) => {
      const params = new URLSearchParams();

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, v));
          } else {
            params.set(key, String(value));
          }
        }
      });

      startTransition(() => {
        const queryString = params.toString();
        const url = queryString ? `/jobs?${queryString}` : '/jobs';
        router.push(url, {
          scroll: false,
        });
      });
    },
    [router]
  );

  // Update a single filter
  const setFilter = useCallback(
    <K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) => {
      const newFilters = { ...filters, [key]: value };
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        delete newFilters[key];
      }
      setFilters(newFilters);
      applyFilters(newFilters);
    },
    [filters, applyFilters]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({});
    setBudgetMin('');
    setBudgetMax('');
    applyFilters({});
  }, [applyFilters]);

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(
    ([, value]) =>
      value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)
  ).length;

  // Apply budget filter
  const applyBudgetFilter = useCallback(() => {
    const min = budgetMin ? Number(budgetMin) : undefined;
    const max = budgetMax ? Number(budgetMax) : undefined;
    const newFilters = { ...filters, budgetMin: min, budgetMax: max };
    setFilters(newFilters);
    applyFilters(newFilters);
  }, [budgetMin, budgetMax, filters, applyFilters]);

  return (
    <div className={cn('bg-card rounded-lg border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-semibold">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-xs" variant="secondary">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            className="text-muted-foreground h-8 px-2"
            size="sm"
            variant="ghost"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="space-y-6 p-4">
          {/* Categories */}
          <FilterSection title="Category">
            <div className="space-y-1">
              {categories.slice(0, 10).map((category) => (
                <div key={category.id}>
                  <button
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      filters.category === category.slug
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => {
                      if (category.children?.length) {
                        toggleCategory(category.id);
                      } else {
                        setFilter(
                          'category',
                          filters.category === category.slug ? undefined : category.slug
                        );
                      }
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {(() => {
                        if (!category.children?.length) return <span className="w-3" />;
                        if (expandedCategories.has(category.id))
                          return <ChevronDown className="h-3 w-3" />;
                        return <ChevronRight className="h-3 w-3" />;
                      })()}
                      {category.name}
                    </span>
                    <span className="text-muted-foreground text-xs">{category.jobCount}</span>
                  </button>

                  {/* Subcategories */}
                  {category.children && expandedCategories.has(category.id) && (
                    <div className="ml-5 mt-1 space-y-1">
                      {category.children.map((sub) => (
                        <button
                          key={sub.id}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors',
                            filters.subcategory === sub.slug
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          )}
                          onClick={() =>
                            setFilter(
                              'subcategory',
                              filters.subcategory === sub.slug ? undefined : sub.slug
                            )
                          }
                        >
                          <span>{sub.name}</span>
                          <span className="text-muted-foreground text-xs">{sub.jobCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FilterSection>

          <Separator />

          {/* Experience Level */}
          <FilterSection title="Experience Level">
            <div className="space-y-2">
              {experienceLevels.map((level) => (
                <label
                  key={level.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors',
                    filters.experienceLevel === level.value ? 'bg-primary/10' : 'hover:bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                      filters.experienceLevel === level.value
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                    )}
                  >
                    {filters.experienceLevel === level.value && (
                      <Check className="text-primary-foreground h-2.5 w-2.5" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{level.label}</div>
                    <div className="text-muted-foreground text-xs">{level.description}</div>
                  </div>
                  <input
                    checked={filters.experienceLevel === level.value}
                    className="sr-only"
                    name="experienceLevel"
                    type="radio"
                    value={level.value}
                    onChange={() =>
                      setFilter(
                        'experienceLevel',
                        filters.experienceLevel === level.value
                          ? undefined
                          : (level.value as JobSearchFilters['experienceLevel'])
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </FilterSection>

          <Separator />

          {/* Job Type */}
          <FilterSection title="Job Type">
            <div className="flex gap-2">
              {budgetTypes.map((type) => (
                <Button
                  key={type.value}
                  className="flex-1"
                  size="sm"
                  variant={filters.budgetType === type.value ? 'default' : 'outline'}
                  onClick={() =>
                    setFilter(
                      'budgetType',
                      filters.budgetType === type.value
                        ? undefined
                        : (type.value as JobSearchFilters['budgetType'])
                    )
                  }
                >
                  <type.icon className="mr-1 h-3 w-3" />
                  {type.label}
                </Button>
              ))}
            </div>
          </FilterSection>

          <Separator />

          {/* Budget Range */}
          <FilterSection title="Budget Range">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="sr-only" htmlFor="budgetMin">
                    Minimum
                  </Label>
                  <Input
                    className="h-9"
                    id="budgetMin"
                    placeholder="Min"
                    type="number"
                    value={budgetMin}
                    onBlur={applyBudgetFilter}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyBudgetFilter()}
                  />
                </div>
                <span className="text-muted-foreground">—</span>
                <div className="flex-1">
                  <Label className="sr-only" htmlFor="budgetMax">
                    Maximum
                  </Label>
                  <Input
                    className="h-9"
                    id="budgetMax"
                    placeholder="Max"
                    type="number"
                    value={budgetMax}
                    onBlur={applyBudgetFilter}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyBudgetFilter()}
                  />
                </div>
              </div>
            </div>
          </FilterSection>

          <Separator />

          {/* Project Duration */}
          <FilterSection title="Project Duration">
            <div className="space-y-1">
              {durationOptions.map((duration) => (
                <button
                  key={duration.value}
                  className={cn(
                    'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    filters.duration === duration.value
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                  onClick={() =>
                    setFilter(
                      'duration',
                      filters.duration === duration.value ? undefined : duration.value
                    )
                  }
                >
                  {duration.label}
                </button>
              ))}
            </div>
          </FilterSection>

          <Separator />

          {/* Posted Date */}
          <FilterSection title="Posted">
            <div className="flex flex-wrap gap-1.5">
              {postedWithinOptions.map((option) => (
                <Button
                  key={option.value}
                  className="h-7 text-xs"
                  size="sm"
                  variant={filters.postedWithin === option.value ? 'default' : 'outline'}
                  onClick={() =>
                    setFilter(
                      'postedWithin',
                      filters.postedWithin === option.value
                        ? undefined
                        : (option.value as JobSearchFilters['postedWithin'])
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </FilterSection>

          <Separator />

          {/* Client History */}
          <FilterSection title="Client">
            <div className="space-y-2">
              {clientHistoryOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors',
                    filters.clientHistory === option.value ? 'bg-primary/10' : 'hover:bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                      filters.clientHistory === option.value
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                    )}
                  >
                    {filters.clientHistory === option.value && (
                      <Check className="text-primary-foreground h-3 w-3" />
                    )}
                  </div>
                  <option.icon className="text-muted-foreground h-4 w-4" />
                  <span className="text-sm">{option.label}</span>
                  <input
                    checked={filters.clientHistory === option.value}
                    className="sr-only"
                    type="checkbox"
                    onChange={() =>
                      setFilter(
                        'clientHistory',
                        filters.clientHistory === option.value
                          ? undefined
                          : (option.value as JobSearchFilters['clientHistory'])
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </FilterSection>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Filter Section Component
// ============================================================================

function FilterSection({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}
