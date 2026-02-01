'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  cn,
  EmptyState,
} from '@skillancer/ui';
import {
  Bell,
  BellOff,
  Bookmark,
  ChevronRight,
  Clock,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback } from 'react';

import type { SavedSearch, JobSearchFilters, CreateSavedSearchData } from '@/lib/api/jobs';

import { useSavedSearches } from '@/hooks/use-saved-searches';

// ============================================================================
// Types
// ============================================================================

interface SavedSearchesListProps {
  className?: string;
}

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: JobSearchFilters;
  onSave: (data: CreateSavedSearchData) => Promise<SavedSearch | void>;
  isSaving: boolean;
}

interface SavedSearchCardProps {
  search: SavedSearch;
  onToggleAlerts: (enabled: boolean) => Promise<SavedSearch | void>;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  isDeleting: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFiltersSummary(filters: JobSearchFilters): string {
  const parts: string[] = [];

  if (filters.query) {
    parts.push(`"${filters.query}"`);
  }
  if (filters.category) {
    parts.push(`Category: ${filters.category}`);
  }
  if (filters.skills?.length) {
    parts.push(`${filters.skills.length} skill${filters.skills.length > 1 ? 's' : ''}`);
  }
  if (filters.budgetMin || filters.budgetMax) {
    const min = filters.budgetMin ? `$${filters.budgetMin}` : '';
    const max = filters.budgetMax ? `$${filters.budgetMax}` : '';
    if (min && max) {
      parts.push(`${min}-${max}`);
    } else if (min) {
      parts.push(`${min}+`);
    } else if (max) {
      parts.push(`Up to ${max}`);
    }
  }
  if (filters.location) {
    parts.push(filters.location);
  }
  if (filters.remoteOnly) {
    parts.push('Remote only');
  }
  if (filters.experienceLevel) {
    parts.push(filters.experienceLevel.toLowerCase());
  }

  return parts.length > 0 ? parts.join(' • ') : 'All jobs';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function buildSearchUrl(filters: JobSearchFilters): string {
  const params = new URLSearchParams();

  if (filters.query) params.set('q', filters.query);
  if (filters.category) params.set('category', filters.category);
  if (filters.skills?.length) {
    filters.skills.forEach((s) => params.append('skills', s));
  }
  if (filters.budgetMin) params.set('budgetMin', String(filters.budgetMin));
  if (filters.budgetMax) params.set('budgetMax', String(filters.budgetMax));
  if (filters.budgetType) params.set('budgetType', filters.budgetType);
  if (filters.location) params.set('location', filters.location);
  if (filters.remoteOnly) params.set('remoteOnly', 'true');
  if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel);
  if (filters.postedWithin) params.set('postedWithin', filters.postedWithin);

  const queryString = params.toString();
  return queryString ? `/jobs?${queryString}` : '/jobs';
}

// ============================================================================
// Save Search Dialog
// ============================================================================

export function SaveSearchDialog({
  open,
  onOpenChange,
  filters,
  onSave,
  isSaving,
}: Readonly<SaveSearchDialogProps>) {
  const [name, setName] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [alertFrequency, setAlertFrequency] = useState<'instant' | 'daily' | 'weekly'>('daily');

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;

    await onSave({
      name: name.trim(),
      filters,
      emailAlerts,
      alertFrequency,
    });

    // Reset form
    setName('');
    setEmailAlerts(true);
    setAlertFrequency('daily');
    onOpenChange(false);
  }, [name, filters, emailAlerts, alertFrequency, onSave, onOpenChange]);

  const filtersSummary = formatFiltersSummary(filters);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save This Search</DialogTitle>
          <DialogDescription>
            Save your current search filters and get notified when new matching jobs are posted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              placeholder="e.g., React Remote Jobs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Filters summary */}
          <div className="space-y-2">
            <Label>Filters</Label>
            <p className="text-muted-foreground rounded-md border p-2 text-sm">{filtersSummary}</p>
          </div>

          {/* Email alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-alerts">Email Alerts</Label>
              <p className="text-muted-foreground text-sm">Get notified of new matching jobs</p>
            </div>
            <Switch checked={emailAlerts} id="email-alerts" onCheckedChange={setEmailAlerts} />
          </div>

          {/* Alert frequency */}
          {emailAlerts && (
            <div className="space-y-2">
              <Label htmlFor="alert-frequency">Alert Frequency</Label>
              <Select
                value={alertFrequency}
                onValueChange={(v) => setAlertFrequency(v as typeof alertFrequency)}
              >
                <SelectTrigger id="alert-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant (as jobs are posted)</SelectItem>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || isSaving} onClick={() => void handleSave()}>
            {isSaving ? 'Saving...' : 'Save Search'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Saved Search Card
// ============================================================================

function SavedSearchCard({
  search,
  onToggleAlerts,
  onDelete,
  onEdit,
  isDeleting,
}: Readonly<SavedSearchCardProps>) {
  const [isTogglingAlerts, setIsTogglingAlerts] = useState(false);

  const handleToggleAlerts = useCallback(async () => {
    setIsTogglingAlerts(true);
    try {
      await onToggleAlerts(!search.emailAlerts);
    } finally {
      setIsTogglingAlerts(false);
    }
  }, [search.emailAlerts, onToggleAlerts]);

  const filtersSummary = formatFiltersSummary(search.filters);
  const searchUrl = buildSearchUrl(search.filters);

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link className="hover:text-primary font-medium transition-colors" href={searchUrl}>
                {search.name}
              </Link>
              {search.newJobsCount > 0 && (
                <Badge className="h-5 min-w-5 justify-center px-1.5" variant="default">
                  {search.newJobsCount} new
                </Badge>
              )}
            </div>

            <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">{filtersSummary}</p>

            <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Updated {formatRelativeTime(search.updatedAt)}
              </span>
              <span className="flex items-center gap-1">
                {search.emailAlerts ? (
                  <>
                    <Bell className="h-3 w-3" />
                    {search.alertFrequency} alerts
                  </>
                ) : (
                  <>
                    <BellOff className="h-3 w-3" />
                    Alerts off
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              className="h-8 w-8"
              disabled={isTogglingAlerts}
              size="icon"
              title={search.emailAlerts ? 'Disable alerts' : 'Enable alerts'}
              variant="ghost"
              onClick={() => void handleToggleAlerts()}
            >
              {search.emailAlerts ? (
                <Bell className="h-4 w-4 text-emerald-600" />
              ) : (
                <BellOff className="text-muted-foreground h-4 w-4" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-8 w-8" size="icon" variant="ghost">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={searchUrl}>
                    <Search className="mr-2 h-4 w-4" />
                    Run Search
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  disabled={isDeleting}
                  onClick={() => void onDelete()}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Saved Searches List
// ============================================================================

export function SavedSearchesList({ className }: Readonly<SavedSearchesListProps>) {
  const {
    savedSearches,
    isLoading,
    error,
    totalNewJobs,
    deleteSearch,
    toggleEmailAlerts,
    isDeleting,
  } = useSavedSearches();

  // Note: editingSearch functionality will be implemented in future update
  const [_editingSearch, _setEditingSearch] = useState<SavedSearch | null>(null);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {(['saved-sk-1', 'saved-sk-2', 'saved-sk-3'] as const).map((id) => (
          <Card key={id}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <EmptyState
          actionLabel="Try Again"
          description={error.message}
          icon={<Bookmark className="h-12 w-12 text-red-500" />}
          title="Failed to load saved searches"
          onAction={() => globalThis.location.reload()}
        />
      </div>
    );
  }

  if (savedSearches.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          actionLabel="Search Jobs"
          description="Save your search filters to quickly find jobs later and get notified of new matches."
          icon={<Bookmark className="h-12 w-12" />}
          title="No saved searches yet"
          onAction={() => {
            globalThis.location.href = '/jobs';
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      {totalNewJobs > 0 && (
        <div className="bg-primary/10 border-primary/20 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Bell className="text-primary h-4 w-4" />
            <span className="text-sm font-medium">
              {totalNewJobs} new job{totalNewJobs === 1 ? '' : 's'} match your saved searches
            </span>
          </div>
        </div>
      )}

      {/* List */}
      {savedSearches.map((search) => (
        <SavedSearchCard
          key={search.id}
          isDeleting={isDeleting}
          search={search}
          onDelete={() => deleteSearch(search.id)}
          onEdit={() => setEditingSearch(search)}
          onToggleAlerts={(enabled) => toggleEmailAlerts(search.id, enabled)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Save Search Button (for use in search filters)
// ============================================================================

interface SaveSearchButtonProps {
  filters: JobSearchFilters;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function SaveSearchButton({
  filters,
  variant = 'outline',
  size = 'sm',
  className,
}: Readonly<SaveSearchButtonProps>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { createSearch, isSaving } = useSavedSearches();

  // Check if there are any active filters
  const hasFilters = Boolean(
    filters.query ||
    filters.category ||
    filters.skills?.length ||
    filters.budgetMin ||
    filters.budgetMax ||
    filters.location ||
    filters.remoteOnly ||
    filters.experienceLevel
  );

  if (!hasFilters) {
    return null;
  }

  return (
    <>
      <Button
        className={cn('gap-1.5', className)}
        size={size}
        variant={variant}
        onClick={() => setDialogOpen(true)}
      >
        <Bookmark className="h-4 w-4" />
        Save Search
      </Button>

      <SaveSearchDialog
        filters={filters}
        isSaving={isSaving}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={async (data) => {
          await createSearch(data);
        }}
      />
    </>
  );
}

// ============================================================================
// Saved Searches Dropdown (for header/nav)
// ============================================================================

interface SavedSearchesDropdownProps {
  className?: string;
}

export function SavedSearchesDropdown({ className }: Readonly<SavedSearchesDropdownProps>) {
  const { savedSearches, totalNewJobs, isLoading } = useSavedSearches();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn('relative', className)} size="icon" variant="ghost">
          <Bookmark className="h-5 w-5" />
          {totalNewJobs > 0 && (
            <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium">
              {totalNewJobs > 99 ? '99+' : totalNewJobs}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="font-medium">Saved Searches</span>
          <Link className="text-primary text-xs hover:underline" href="/dashboard/saved-searches">
            Manage
          </Link>
        </div>
        <DropdownMenuSeparator />

        {isLoading && (
          <div className="space-y-2 p-2">
            {(['dd-sk-1', 'dd-sk-2', 'dd-sk-3'] as const).map((id) => (
              <Skeleton key={id} className="h-10 w-full" />
            ))}
          </div>
        )}
        {!isLoading && savedSearches.length === 0 && (
          <div className="text-muted-foreground p-4 text-center text-sm">No saved searches yet</div>
        )}
        {!isLoading && savedSearches.length > 0 && (
          <>
            {savedSearches.slice(0, 5).map((search) => (
              <DropdownMenuItem key={search.id} asChild>
                <Link
                  className="flex items-center justify-between"
                  href={buildSearchUrl(search.filters)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{search.name}</span>
                      {search.newJobsCount > 0 && (
                        <Badge className="h-4 px-1 text-[10px]" variant="default">
                          {search.newJobsCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {formatFiltersSummary(search.filters)}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground ml-2 h-4 w-4 shrink-0" />
                </Link>
              </DropdownMenuItem>
            ))}

            {savedSearches.length > 5 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    className="text-muted-foreground justify-center text-sm"
                    href="/dashboard/saved-searches"
                  >
                    View all {savedSearches.length} saved searches
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
