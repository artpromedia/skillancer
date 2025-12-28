'use client';

import { Badge, Button, Card, CardContent, CardHeader, cn } from '@skillancer/ui';
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { WorkHistoryItem } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface WorkHistoryProps {
  items: WorkHistoryItem[];
  isOwnProfile?: boolean;
  maxItems?: number;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatDuration(startDate: string, endDate?: string, _isCurrent?: boolean): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

  if (months < 1) return 'Less than a month';
  if (months === 1) return '1 month';
  if (months < 12) return `${months} months`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (remainingMonths === 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
  return `${years} ${years === 1 ? 'year' : 'years'}, ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;
}

function formatEarnings(amount: number): string {
  if (amount >= 10000) {
    return `$${Math.round(amount / 1000)}K+`;
  }
  return `$${amount.toLocaleString()}`;
}

function formatEndDate(isCurrent: boolean, endDate: string | undefined | null): string {
  if (isCurrent) return 'Present';
  if (endDate) return formatDate(endDate);
  return '';
}

// ============================================================================
// Work History Item Component
// ============================================================================

interface WorkHistoryItemCardProps {
  item: WorkHistoryItem;
  isLast: boolean;
}

function WorkHistoryItemCard({ item, isLast }: Readonly<WorkHistoryItemCardProps>) {
  const [expanded, setExpanded] = useState(false);
  const isPlatformWork = item.type === 'PLATFORM';

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="bg-border absolute left-[17px] top-10 h-[calc(100%-24px)] w-0.5" />
      )}

      {/* Timeline dot */}
      <div
        className={cn(
          'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
          isPlatformWork
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/30 bg-background'
        )}
      >
        {isPlatformWork ? (
          <Briefcase className="text-primary h-4 w-4" />
        ) : (
          <Building2 className="text-muted-foreground h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-foreground font-medium">{item.role}</h4>
            <p className="text-muted-foreground text-sm">
              {item.companyName}
              {isPlatformWork && (
                <Badge className="ml-2 text-xs" variant="outline">
                  Skillancer
                </Badge>
              )}
            </p>
          </div>

          {/* Rating for platform work */}
          {isPlatformWork && item.rating && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{item.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Date and duration */}
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {formatDate(item.startDate)} – {formatEndDate(item.isCurrent, item.endDate)}
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDuration(item.startDate, item.endDate, item.isCurrent)}</span>
        </div>

        {/* Description */}
        {item.description && (
          <div className="mt-2">
            <p className={cn('text-muted-foreground text-sm', !expanded && 'line-clamp-2')}>
              {item.description}
            </p>
            {item.description.length > 150 && (
              <Button
                className="h-auto p-0 text-xs"
                size="sm"
                variant="link"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show less' : 'Show more'}
              </Button>
            )}
          </div>
        )}

        {/* Feedback for platform work */}
        {isPlatformWork && item.feedback && !item.feedbackPrivate && (
          <blockquote className="border-primary/30 text-muted-foreground mt-3 border-l-2 pl-3 text-sm italic">
            &ldquo;{item.feedback}&rdquo;
          </blockquote>
        )}

        {/* Skills */}
        {item.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.skills.map((skill) => (
              <Badge key={skill} className="text-xs" variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {/* Earnings for platform work */}
        {isPlatformWork && item.earnings && item.earnings > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Earned: {formatEarnings(item.earnings)}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkHistory({
  items,
  isOwnProfile = false,
  maxItems = 5,
  className,
}: Readonly<WorkHistoryProps>) {
  const [showAll, setShowAll] = useState(false);

  // Sort by date (most recent first)
  const sortedItems = [...items].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const visibleItems = showAll ? sortedItems : sortedItems.slice(0, maxItems);
  const hasMore = sortedItems.length > maxItems;

  // Stats
  const platformJobs = items.filter((i) => i.type === 'PLATFORM').length;
  const externalJobs = items.filter((i) => i.type === 'EXTERNAL').length;

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <h2 className="text-xl font-semibold">Work History</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground">No work history yet</p>
            {isOwnProfile && (
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link href="/dashboard/profile">Add Experience</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <h2 className="text-xl font-semibold">Work History</h2>
          <p className="text-muted-foreground text-sm">
            {platformJobs > 0 &&
              `${platformJobs} Skillancer ${platformJobs === 1 ? 'job' : 'jobs'}`}
            {platformJobs > 0 && externalJobs > 0 && ' • '}
            {externalJobs > 0 &&
              `${externalJobs} external ${externalJobs === 1 ? 'position' : 'positions'}`}
          </p>
        </div>
        {isOwnProfile && (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/profile">
              <ExternalLink className="mr-2 h-3 w-3" />
              Edit
            </Link>
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {/* Timeline */}
        <div className="space-y-0">
          {visibleItems.map((item, index) => (
            <WorkHistoryItemCard
              key={item.id}
              isLast={index === visibleItems.length - 1}
              item={item}
            />
          ))}
        </div>

        {/* Show more/less */}
        {hasMore && (
          <Button
            className="mt-2 w-full"
            size="sm"
            variant="ghost"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show More ({sortedItems.length - maxItems} more)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
