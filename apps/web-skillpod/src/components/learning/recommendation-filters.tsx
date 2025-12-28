'use client';

import { cn } from '@skillancer/ui';
import {
  Filter,
  BookOpen,
  Video,
  Code,
  Award,
  Clock,
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

interface FilterState {
  types: string[];
  levels: string[];
  duration: string[];
  minRelevance: number;
  providers: string[];
  skills: string[];
  sortBy: 'relevance' | 'rating' | 'duration' | 'newest';
}

interface RecommendationFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  availableSkills?: string[];
  availableProviders?: string[];
  totalResults?: number;
}

export function RecommendationFilters({
  filters,
  onChange,
  availableSkills = [
    'React',
    'TypeScript',
    'Node.js',
    'AWS',
    'Python',
    'Docker',
    'Kubernetes',
    'GraphQL',
  ],
  availableProviders = [
    'Coursera',
    'Udemy',
    'Frontend Masters',
    'Pluralsight',
    'LinkedIn Learning',
    'AWS Training',
  ],
  totalResults = 0,
}: Readonly<RecommendationFiltersProps>) {
  const [expandedSection, setExpandedSection] = useState<string | null>('types');

  const types = [
    { id: 'course', label: 'Courses', icon: BookOpen },
    { id: 'tutorial', label: 'Tutorials', icon: Video },
    { id: 'project', label: 'Projects', icon: Code },
    { id: 'certification', label: 'Certifications', icon: Award },
  ];

  const levels = ['Beginner', 'Intermediate', 'Advanced'];

  const durations = [
    { id: 'short', label: 'Under 2 hours' },
    { id: 'medium', label: '2-10 hours' },
    { id: 'long', label: '10-40 hours' },
    { id: 'extensive', label: '40+ hours' },
  ];

  const sortOptions = [
    { id: 'relevance', label: 'Best Match', icon: Sparkles },
    { id: 'rating', label: 'Highest Rated', icon: TrendingUp },
    { id: 'duration', label: 'Shortest First', icon: Clock },
    { id: 'newest', label: 'Newest', icon: Clock },
  ];

  const toggleFilter = (category: keyof FilterState, value: string) => {
    const current = filters[category] as string[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [category]: updated });
  };

  const clearAllFilters = () => {
    onChange({
      types: [],
      levels: [],
      duration: [],
      minRelevance: 0,
      providers: [],
      skills: [],
      sortBy: 'relevance',
    });
  };

  const activeFilterCount =
    filters.types.length +
    filters.levels.length +
    filters.duration.length +
    filters.providers.length +
    filters.skills.length +
    (filters.minRelevance > 0 ? 1 : 0);

  const FilterSection = ({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSection === id;
    return (
      <div className="border-b border-gray-100 last:border-0">
        <button
          className="flex w-full items-center justify-between py-3 text-sm font-medium text-gray-700 hover:text-gray-900"
          onClick={() => setExpandedSection(isExpanded ? null : id)}
        >
          {title}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        {isExpanded && <div className="pb-3">{children}</div>}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900">Filters</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button className="text-sm text-gray-500 hover:text-gray-700" onClick={clearAllFilters}>
            Clear all
          </button>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4 border-b border-gray-100 pb-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{totalResults}</span> recommendations found
        </p>
      </div>

      {/* Sort By */}
      <div className="mb-4 border-b border-gray-100 pb-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Sort By</p>
        <select
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          value={filters.sortBy}
          onChange={(e) =>
            onChange({ ...filters, sortBy: e.target.value as FilterState['sortBy'] })
          }
        >
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content Type */}
      <FilterSection id="types" title="Content Type">
        <div className="space-y-2">
          {types.map((type) => {
            const TypeIcon = type.icon;
            const isSelected = filters.types.includes(type.id);
            return (
              <button
                key={type.id}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => toggleFilter('types', type.id)}
              >
                <TypeIcon className="h-4 w-4" />
                {type.label}
                {isSelected && <span className="ml-auto text-indigo-600">✓</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Level */}
      <FilterSection id="levels" title="Difficulty Level">
        <div className="space-y-2">
          {levels.map((level) => {
            const isSelected = filters.levels.includes(level);
            return (
              <button
                key={level}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                  isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => toggleFilter('levels', level)}
              >
                {level}
                {isSelected && <span className="text-indigo-600">✓</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Duration */}
      <FilterSection id="duration" title="Duration">
        <div className="space-y-2">
          {durations.map((duration) => {
            const isSelected = filters.duration.includes(duration.id);
            return (
              <button
                key={duration.id}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                  isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => toggleFilter('duration', duration.id)}
              >
                {duration.label}
                {isSelected && <span className="text-indigo-600">✓</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Min Relevance Score */}
      <FilterSection id="relevance" title="Minimum Match Score">
        <div className="px-2">
          <input
            className="w-full accent-indigo-600"
            max="100"
            min="0"
            type="range"
            value={filters.minRelevance}
            onChange={(e) =>
              onChange({ ...filters, minRelevance: Number.parseInt(e.target.value, 10) })
            }
          />
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>Any</span>
            <span className="font-medium text-indigo-600">{filters.minRelevance}%+</span>
            <span>100%</span>
          </div>
        </div>
      </FilterSection>

      {/* Skills */}
      <FilterSection id="skills" title="Skills">
        <div className="flex flex-wrap gap-1">
          {availableSkills.map((skill) => {
            const isSelected = filters.skills.includes(skill);
            return (
              <button
                key={skill}
                className={cn(
                  'rounded px-2 py-1 text-xs transition-colors',
                  isSelected
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                onClick={() => toggleFilter('skills', skill)}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Providers */}
      <FilterSection id="providers" title="Providers">
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {availableProviders.map((provider) => {
            const isSelected = filters.providers.includes(provider);
            return (
              <button
                key={provider}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors',
                  isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => toggleFilter('providers', provider)}
              >
                {provider}
                {isSelected && <span className="text-indigo-600">✓</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs text-gray-500">Active Filters:</p>
          <div className="flex flex-wrap gap-1">
            {filters.types.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
              >
                {type}
                <button onClick={() => toggleFilter('types', type)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {filters.levels.map((level) => (
              <span
                key={level}
                className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
              >
                {level}
                <button onClick={() => toggleFilter('levels', level)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {filters.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
              >
                {skill}
                <button onClick={() => toggleFilter('skills', skill)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecommendationFilters;
