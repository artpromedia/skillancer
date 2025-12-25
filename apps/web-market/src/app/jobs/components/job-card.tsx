'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  formatRelativeTime,
  formatCurrency,
  truncate,
} from '@skillancer/ui';
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  DollarSign,
  MapPin,
  Star,
  Shield,
  Users,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { MatchScoreBadge } from '@/components/shared/match-score-badge';
import { SkillTag } from '@/components/shared/skill-tag';
import { useJobStore } from '@/stores/job-store';

import type { Job } from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

interface JobCardProps {
  job: Job;
  viewMode?: 'list' | 'grid';
  showMatchScore?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function JobCard({
  job,
  viewMode = 'list',
  showMatchScore = true,
  className,
}: JobCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Store actions
  const isJobSaved = useJobStore((state) => state.isJobSaved);
  const toggleSaveJob = useJobStore((state) => state.toggleSaveJob);
  const hasApplied = useJobStore((state) => state.hasApplied);

  const isSaved = isJobSaved(job.id);
  const applied = hasApplied(job.id);

  // Format budget display
  const budgetDisplay = formatBudget(job);

  // Skills to show (max 5, with "more" indicator)
  const visibleSkills = job.skills.slice(0, 5);
  const moreSkillsCount = job.skills.length - 5;

  const isGrid = viewMode === 'grid';

  return (
    <Card
      className={cn(
        'group relative transition-shadow hover:shadow-md',
        isGrid ? 'h-full' : '',
        applied && 'border-green-500/30 bg-green-50/50 dark:bg-green-950/10',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className={cn('p-4', isGrid ? 'flex h-full flex-col' : '')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Title */}
            <Link className="group/title block" href={`/jobs/${job.slug}`}>
              <h3
                className={cn(
                  'text-foreground group-hover/title:text-primary line-clamp-2 font-semibold transition-colors',
                  isGrid ? 'text-base' : 'text-lg'
                )}
              >
                {job.title}
              </h3>
            </Link>

            {/* Meta info */}
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(job.createdAt)}
              </span>

              {job.budgetType && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {budgetDisplay}
                  </span>
                </>
              )}

              {job.experienceLevel && (
                <>
                  <span>•</span>
                  <Badge className="h-5 text-xs" variant="outline">
                    {formatExperienceLevel(job.experienceLevel)}
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Save Button */}
          <Button
            aria-label={isSaved ? 'Unsave job' : 'Save job'}
            className={cn(
              'h-8 w-8 shrink-0 transition-opacity',
              !isHovered && !isSaved && 'opacity-0 group-hover:opacity-100'
            )}
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.preventDefault();
              toggleSaveJob(job.id);
            }}
          >
            {isSaved ? (
              <BookmarkCheck className="text-primary h-4 w-4 fill-current" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Description */}
        <p
          className={cn(
            'text-muted-foreground mt-3 text-sm',
            isGrid ? 'line-clamp-3' : 'line-clamp-2'
          )}
        >
          {truncate(job.description, isGrid ? 150 : 200)}
        </p>

        {/* Skills */}
        {visibleSkills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <SkillTag key={skill.id} size="sm" skill={skill.name} />
            ))}
            {moreSkillsCount > 0 && (
              <Badge className="text-xs" variant="secondary">
                +{moreSkillsCount} more
              </Badge>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className={cn(
            'mt-4 flex items-center justify-between gap-4 border-t pt-4',
            isGrid && 'mt-auto'
          )}
        >
          {/* Client Info */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Client avatar/flag */}
            {job.client.countryCode && (
              <span className="text-lg" title={job.client.country}>
                {getCountryFlag(job.client.countryCode)}
              </span>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {job.client.isPaymentVerified && (
                  <Shield className="h-3 w-3 text-green-500" title="Payment Verified" />
                )}
                {job.client.reviewScore && (
                  <span className="flex items-center gap-0.5 text-sm">
                    <Star className="h-3 w-3 fill-current text-yellow-500" />
                    {job.client.reviewScore.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                ${job.client.totalSpent.toLocaleString()} spent
                {job.client.hireRate > 0 && ` • ${job.client.hireRate}% hire rate`}
              </div>
            </div>
          </div>

          {/* Proposals count & Match score */}
          <div className="flex shrink-0 items-center gap-3">
            {job.proposalCount > 0 && (
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Users className="h-3 w-3" />
                <span>
                  {job.proposalCount} proposal{job.proposalCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Match Score (placeholder - would be from SmartMatch API) */}
            {showMatchScore && <MatchScoreBadge score={85} size="sm" />}

            {/* Applied badge */}
            {applied && (
              <Badge className="bg-green-600 text-white" variant="success">
                Applied
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions (visible on hover) */}
        {isHovered && !isGrid && (
          <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button asChild size="sm">
              <Link href={`/jobs/${job.slug}`}>
                View Details
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatBudget(job: Job): string {
  const { budgetType, budgetMin, budgetMax } = job;

  if (!budgetMin && !budgetMax) {
    return budgetType === 'HOURLY' ? 'Hourly' : 'Fixed Price';
  }

  const formatAmount = (amount: number) =>
    amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount.toString();

  if (budgetType === 'HOURLY') {
    if (budgetMin && budgetMax) {
      return `$${formatAmount(budgetMin)}-$${formatAmount(budgetMax)}/hr`;
    }
    return budgetMin ? `$${formatAmount(budgetMin)}+/hr` : `Up to $${formatAmount(budgetMax!)}/hr`;
  }

  // Fixed price
  if (budgetMin && budgetMax) {
    if (budgetMin === budgetMax) {
      return `$${formatAmount(budgetMin)}`;
    }
    return `$${formatAmount(budgetMin)}-$${formatAmount(budgetMax)}`;
  }
  return budgetMin ? `$${formatAmount(budgetMin)}+` : `Up to $${formatAmount(budgetMax!)}`;
}

function formatExperienceLevel(level: string): string {
  switch (level) {
    case 'ENTRY':
      return 'Entry';
    case 'INTERMEDIATE':
      return 'Intermediate';
    case 'EXPERT':
      return 'Expert';
    default:
      return level;
  }
}

function getCountryFlag(countryCode: string): string {
  // Convert country code to flag emoji
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
