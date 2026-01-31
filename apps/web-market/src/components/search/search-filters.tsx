'use client';

import {
  Button,
  Badge,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  cn,
} from '@skillancer/ui';
import {
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  MapPin,
  Briefcase,
  DollarSign,
  Laptop,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

import { useDebounce } from '@/hooks/use-debounce';
import {
  type JobSearchFilters,
  type Category,
  getJobCategories,
  getLocationSuggestions,
  type LocationSuggestion,
} from '@/lib/api/jobs';
import { searchSkills, type Skill } from '@/lib/api/skills';

// ============================================================================
// Types
// ============================================================================

interface SearchFiltersProps {
  filters: JobSearchFilters;
  onFilterChange: <K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) => void;
  onFiltersChange: (filters: Partial<JobSearchFilters>) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  className?: string;
}

// ============================================================================
// Budget Range Component
// ============================================================================

interface BudgetRangeInputProps {
  minValue?: number;
  maxValue?: number;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
}

function BudgetRangeInput({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: Readonly<BudgetRangeInputProps>) {
  const presetRanges = [
    { label: 'Any', min: undefined, max: undefined },
    { label: '$0-$500', min: 0, max: 500 },
    { label: '$500-$1K', min: 500, max: 1000 },
    { label: '$1K-$5K', min: 1000, max: 5000 },
    { label: '$5K-$10K', min: 5000, max: 10000 },
    { label: '$10K+', min: 10000, max: undefined },
  ];

  const selectedPreset = presetRanges.find((r) => r.min === minValue && r.max === maxValue);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presetRanges.map((range) => (
          <Button
            key={range.label}
            className="h-7 text-xs"
            size="sm"
            variant={selectedPreset === range ? 'default' : 'outline'}
            onClick={() => {
              onMinChange(range.min);
              onMaxChange(range.max);
            }}
          >
            {range.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <DollarSign className="text-muted-foreground absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            className="h-8 pl-7 text-sm"
            min={0}
            placeholder="Min"
            type="number"
            value={minValue ?? ''}
            onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <span className="text-muted-foreground text-sm">to</span>
        <div className="relative flex-1">
          <DollarSign className="text-muted-foreground absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            className="h-8 pl-7 text-sm"
            min={0}
            placeholder="Max"
            type="number"
            value={maxValue ?? ''}
            onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skills Tag Input Component
// ============================================================================

interface SkillsTagInputProps {
  selectedSkills: string[];
  onSkillsChange: (skills: string[]) => void;
}

function SkillsTagInput({ selectedSkills, onSkillsChange }: Readonly<SkillsTagInputProps>) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Skill[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch skill suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const result = await searchSkills(debouncedQuery);
        setSuggestions(result.skills.filter((s) => !selectedSkills.includes(s.name)));
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSuggestions();
  }, [debouncedQuery, selectedSkills]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addSkill = useCallback(
    (skillName: string) => {
      if (!selectedSkills.includes(skillName)) {
        onSkillsChange([...selectedSkills, skillName]);
      }
      setQuery('');
      setIsOpen(false);
    },
    [selectedSkills, onSkillsChange]
  );

  const removeSkill = useCallback(
    (skillName: string) => {
      onSkillsChange(selectedSkills.filter((s) => s !== skillName));
    },
    [selectedSkills, onSkillsChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        addSkill(query.trim());
      } else if (e.key === 'Backspace' && !query && selectedSkills.length > 0) {
        removeSkill(selectedSkills[selectedSkills.length - 1]);
      }
    },
    [query, selectedSkills, addSkill, removeSkill]
  );

  return (
    <div ref={containerRef} className="relative space-y-2">
      {/* Selected skills */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedSkills.map((skill) => (
            <Badge key={skill} className="gap-1 pr-1" variant="secondary">
              {skill}
              <button
                className="hover:bg-muted rounded-full p-0.5"
                type="button"
                onClick={() => removeSkill(skill)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Sparkles className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          ref={inputRef}
          className="h-8 pl-8 text-sm"
          placeholder="Add skills..."
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (query.length >= 2 || isLoading) && (
        <div className="bg-popover absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border shadow-lg">
          {isLoading ? (
            <div className="text-muted-foreground p-2 text-center text-sm">Loading...</div>
          ) : suggestions.length > 0 ? (
            <div className="max-h-48 overflow-y-auto p-1">
              {suggestions.map((skill) => (
                <button
                  key={skill.id}
                  className="hover:bg-accent flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm"
                  type="button"
                  onClick={() => addSkill(skill.name)}
                >
                  <span>{skill.name}</span>
                  {skill.category && (
                    <span className="text-muted-foreground text-xs">{skill.category}</span>
                  )}
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-2">
              <button
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                type="button"
                onClick={() => addSkill(query.trim())}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Add &quot;{query.trim()}&quot;</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Location Autocomplete Component
// ============================================================================

interface LocationAutocompleteProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

function LocationAutocomplete({ value, onChange }: Readonly<LocationAutocompleteProps>) {
  const [query, setQuery] = useState(value ?? '');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch location suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const locations = await getLocationSuggestions(debouncedQuery);
        setSuggestions(locations);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSuggestions();
  }, [debouncedQuery]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync internal state with prop
  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  const selectLocation = useCallback(
    (location: LocationSuggestion) => {
      const displayName = location.country
        ? `${location.name}, ${location.country}`
        : location.name;
      setQuery(displayName);
      onChange(displayName);
      setIsOpen(false);
    },
    [onChange]
  );

  const clearLocation = useCallback(() => {
    setQuery('');
    onChange(undefined);
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          className="h-8 pl-8 pr-8 text-sm"
          placeholder="City, country, or remote"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) {
              onChange(undefined);
            }
          }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button
            className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            type="button"
            onClick={clearLocation}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (query.length >= 2 || isLoading) && (
        <div className="bg-popover absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border shadow-lg">
          {isLoading ? (
            <div className="text-muted-foreground p-2 text-center text-sm">Loading...</div>
          ) : suggestions.length > 0 ? (
            <div className="max-h-48 overflow-y-auto p-1">
              {suggestions.map((location) => (
                <button
                  key={location.id}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                  type="button"
                  onClick={() => selectLocation(location)}
                >
                  <MapPin className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                  <div>
                    <span>{location.name}</span>
                    {location.country && (
                      <span className="text-muted-foreground">, {location.country}</span>
                    )}
                  </div>
                  <Badge className="ml-auto text-[10px]" variant="outline">
                    {location.type}
                  </Badge>
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="text-muted-foreground p-2 text-center text-sm">No locations found</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Category Select Component
// ============================================================================

interface CategorySelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

function CategorySelect({ value, onChange }: Readonly<CategorySelectProps>) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const data = await getJobCategories();
        setCategories(data);
      } catch {
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchCategories();
  }, []);

  // Flatten categories with children
  const flatCategories = useMemo(() => {
    const result: { id: string; name: string; isChild: boolean }[] = [];

    categories.forEach((cat) => {
      result.push({ id: cat.id, name: cat.name, isChild: false });
      if (cat.children) {
        cat.children.forEach((child) => {
          result.push({ id: child.id, name: child.name, isChild: true });
        });
      }
    });

    return result;
  }, [categories]);

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value ?? 'all'} onValueChange={(v) => onChange(v === 'all' ? undefined : v)}>
      <SelectTrigger className="h-8 text-sm">
        <Briefcase className="text-muted-foreground mr-2 h-3.5 w-3.5" />
        <SelectValue placeholder="All categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All categories</SelectItem>
        {flatCategories.map((cat) => (
          <SelectItem key={cat.id} className={cn(cat.isChild && 'pl-6')} value={cat.id}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Filter Section Component
// ============================================================================

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, children, defaultOpen = true }: Readonly<FilterSectionProps>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        className="flex w-full items-center justify-between py-1 font-medium"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm">{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  );
}

// ============================================================================
// Main SearchFilters Component
// ============================================================================

export function SearchFilters({
  filters,
  onFilterChange,
  onFiltersChange: _onFiltersChange,
  onClearFilters,
  activeFilterCount,
  isCollapsed = false,
  onToggleCollapsed,
  className,
}: Readonly<SearchFiltersProps>) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-semibold">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="h-5 min-w-5 justify-center px-1.5" variant="secondary">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <Button
              className="h-7 gap-1 text-xs"
              size="sm"
              variant="ghost"
              onClick={onClearFilters}
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </Button>
          )}
          {onToggleCollapsed && (
            <Button className="h-7 w-7" size="icon" variant="ghost" onClick={onToggleCollapsed}>
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Filter Sections */}
      {!isCollapsed && (
        <div className="space-y-4">
          {/* Category */}
          <FilterSection title="Category">
            <CategorySelect
              value={filters.category}
              onChange={(value) => onFilterChange('category', value)}
            />
          </FilterSection>

          <Separator />

          {/* Skills */}
          <FilterSection title="Skills">
            <SkillsTagInput
              selectedSkills={filters.skills ?? []}
              onSkillsChange={(skills) =>
                onFilterChange('skills', skills.length > 0 ? skills : undefined)
              }
            />
          </FilterSection>

          <Separator />

          {/* Budget */}
          <FilterSection title="Budget">
            <div className="space-y-3">
              <Select
                value={filters.budgetType ?? 'any'}
                onValueChange={(v) =>
                  onFilterChange(
                    'budgetType',
                    v === 'any' ? undefined : (v as JobSearchFilters['budgetType'])
                  )
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Budget type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any type</SelectItem>
                  <SelectItem value="FIXED">Fixed price</SelectItem>
                  <SelectItem value="HOURLY">Hourly rate</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <BudgetRangeInput
                maxValue={filters.budgetMax}
                minValue={filters.budgetMin}
                onMaxChange={(value) => onFilterChange('budgetMax', value)}
                onMinChange={(value) => onFilterChange('budgetMin', value)}
              />
            </div>
          </FilterSection>

          <Separator />

          {/* Location */}
          <FilterSection title="Location">
            <div className="space-y-3">
              <LocationAutocomplete
                value={filters.location}
                onChange={(value) => onFilterChange('location', value)}
              />

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={filters.remoteOnly ?? false}
                  id="remote-only"
                  onCheckedChange={(checked) =>
                    onFilterChange('remoteOnly', checked === true ? true : undefined)
                  }
                />
                <Label
                  className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                  htmlFor="remote-only"
                >
                  <Laptop className="h-3.5 w-3.5" />
                  Remote only
                </Label>
              </div>
            </div>
          </FilterSection>

          <Separator />

          {/* Experience Level */}
          <FilterSection title="Experience Level">
            <div className="space-y-2">
              {(['ENTRY', 'INTERMEDIATE', 'EXPERT'] as const).map((level) => (
                <div key={level} className="flex items-center space-x-2">
                  <Checkbox
                    checked={filters.experienceLevel === level}
                    id={`exp-${level}`}
                    onCheckedChange={(checked) =>
                      onFilterChange('experienceLevel', checked ? level : undefined)
                    }
                  />
                  <Label
                    className="cursor-pointer text-sm font-normal capitalize"
                    htmlFor={`exp-${level}`}
                  >
                    {level.toLowerCase().replace('_', ' ')}
                  </Label>
                </div>
              ))}
            </div>
          </FilterSection>

          <Separator />

          {/* Posted Within */}
          <FilterSection title="Posted Within">
            <Select
              value={filters.postedWithin ?? 'any'}
              onValueChange={(v) =>
                onFilterChange(
                  'postedWithin',
                  v === 'any' ? undefined : (v as JobSearchFilters['postedWithin'])
                )
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="3d">Last 3 days</SelectItem>
                <SelectItem value="week">Last week</SelectItem>
                <SelectItem value="month">Last month</SelectItem>
              </SelectContent>
            </Select>
          </FilterSection>

          <Separator />

          {/* Client History */}
          <FilterSection defaultOpen={false} title="Client History">
            <Select
              value={filters.clientHistory ?? 'any'}
              onValueChange={(v) =>
                onFilterChange(
                  'clientHistory',
                  v === 'any' ? undefined : (v as JobSearchFilters['clientHistory'])
                )
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Any client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any client</SelectItem>
                <SelectItem value="verified">Payment verified</SelectItem>
                <SelectItem value="top">Top clients only</SelectItem>
              </SelectContent>
            </Select>
          </FilterSection>
        </div>
      )}
    </div>
  );
}
