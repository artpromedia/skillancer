/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  formatRelativeTime,
  formatDate,
  Avatar,
  AvatarFallback,
  AvatarImage,
  getInitials,
} from '@skillancer/ui';
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  DollarSign,
  ExternalLink,
  Flag,
  MapPin,
  MessageSquare,
  Share2,
  Shield,
  Star,
  Timer,
  Users,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import type { Job } from '@/lib/api/jobs';

import { MatchScoreBadge } from '@/components/shared/match-score-badge';
import { SkillTag } from '@/components/shared/skill-tag';
import { useJobStore } from '@/stores/job-store';

// ============================================================================
// Types
// ============================================================================

interface JobDetailContentProps {
  job: Job;
}

// ============================================================================
// Component
// ============================================================================

export function JobDetailContent({ job }: JobDetailContentProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Store state - Zustand middleware type inference handled by file-level eslint-disable
  const isJobSaved = useJobStore((state) => state.isJobSaved);
  const toggleSaveJob = useJobStore((state) => state.toggleSaveJob);
  const hasApplied = useJobStore((state) => state.hasApplied);
  const addRecentlyViewed = useJobStore((state) => state.addRecentlyViewed);

  const isSaved = isJobSaved(job.id);
  const applied = hasApplied(job.id);

  // Track view
  useEffect(() => {
    addRecentlyViewed(job);
  }, [job, addRecentlyViewed]);

  // Budget display
  const budgetDisplay = formatBudget(job);

  // Description handling
  const isLongDescription = job.description.length > 1500;
  const displayDescription = showFullDescription ? job.description : job.description.slice(0, 1500);

  // Mock match score (would come from SmartMatch API)
  const matchScore = 85;

  // Mock user skills (would come from auth)
  const userSkills = ['React', 'TypeScript', 'Node.js'];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          {/* Title and Actions */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex-1">
              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                <span>Posted {formatRelativeTime(job.createdAt)}</span>
                {job.visibility === 'INVITE_ONLY' && <Badge variant="secondary">Invite Only</Badge>}
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{job.title}</h1>
            </div>

            {/* Match Score */}
            <div className="flex items-center gap-3">
              <MatchScoreBadge showLabel score={matchScore} size="lg" />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={DollarSign}
              label={job.budgetType === 'HOURLY' ? 'Hourly Rate' : 'Fixed Budget'}
              value={budgetDisplay}
            />
            <StatCard
              icon={Timer}
              label="Duration"
              value={formatDuration(job.estimatedDuration, job.durationUnit)}
            />
            <StatCard
              icon={Star}
              label="Experience"
              value={formatExperienceLevel(job.experienceLevel)}
            />
            <StatCard icon={Users} label="Proposals" value={`${job.proposalCount}`} />
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3 border-t pt-6">
            <Button className="flex-1 sm:flex-none" disabled={applied} size="lg">
              {applied ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Applied
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Submit Proposal
                </>
              )}
            </Button>
            <Button size="lg" variant="outline" onClick={() => toggleSaveJob(job.id)}>
              {isSaved ? (
                <>
                  <BookmarkCheck className="mr-2 h-4 w-4 fill-current" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="mr-2 h-4 w-4" />
                  Save Job
                </>
              )}
            </Button>
            <Button aria-label="Share job" size="icon" variant="outline">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button aria-label="Report job" size="icon" variant="ghost">
              <Flag className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Description Card */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold">Job Description</h2>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'prose prose-sm dark:prose-invert max-w-none',
              !showFullDescription && isLongDescription && 'line-clamp-[20]'
            )}
          >
            {/* Render description with line breaks */}
            {displayDescription.split('\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {isLongDescription && (
            <Button
              className="mt-2 h-auto p-0"
              variant="link"
              onClick={() => setShowFullDescription(!showFullDescription)}
            >
              {showFullDescription ? 'Show less' : 'Read more'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Skills Card */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold">Skills Required</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {job.skills.map((skill) => {
              const isMatched = userSkills.some(
                (s) => s.toLowerCase() === skill.name.toLowerCase()
              );
              return (
                <SkillTag
                  key={skill.id}
                  size="md"
                  skill={skill.name}
                  variant={isMatched ? 'matched' : 'default'}
                />
              );
            })}
          </div>

          {/* Skills Match Summary */}
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-600">
                <CheckCircle className="h-4 w-4" />
                {
                  job.skills.filter((s) =>
                    userSkills.some((us) => us.toLowerCase() === s.name.toLowerCase())
                  ).length
                }{' '}
                matched
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                {
                  job.skills.filter(
                    (s) => !userSkills.some((us) => us.toLowerCase() === s.name.toLowerCase())
                  ).length
                }{' '}
                to learn
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Screening Questions */}
      {job.questions && job.questions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold">Screening Questions</h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {job.questions.map((question, index) => (
                <li key={question.id} className="flex gap-3">
                  <span className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm">{question.question}</p>
                    {question.isRequired && (
                      <span className="text-destructive text-xs">Required</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {job.attachments && job.attachments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold">Attachments</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {job.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  className="hover:bg-muted flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  href={attachment.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded">
                    📎
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{attachment.name}</p>
                    {attachment.size && (
                      <p className="text-muted-foreground text-xs">
                        {formatFileSize(attachment.size)}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="text-muted-foreground h-4 w-4" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Card */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold">About the Client</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage alt={job.client.name} src={job.client.avatarUrl} />
              <AvatarFallback>{getInitials(job.client.name)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{job.client.name}</h3>
                {job.client.isPaymentVerified && (
                  <Badge className="gap-1" variant="outline">
                    <Shield className="h-3 w-3 text-green-500" />
                    Verified
                  </Badge>
                )}
              </div>

              {job.client.country && (
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3" />
                  {job.client.country}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Total Spent</p>
              <p className="font-semibold">${job.client.totalSpent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Jobs Posted</p>
              <p className="font-semibold">{job.client.jobsPosted}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Hire Rate</p>
              <p className="font-semibold">{job.client.hireRate}%</p>
            </div>
            {job.client.reviewScore && (
              <div>
                <p className="text-muted-foreground text-sm">Rating</p>
                <p className="flex items-center gap-1 font-semibold">
                  <Star className="h-4 w-4 fill-current text-yellow-500" />
                  {job.client.reviewScore.toFixed(1)}
                  <span className="text-muted-foreground font-normal">
                    ({job.client.reviewCount})
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="text-muted-foreground mt-4 text-sm">
            <Calendar className="mr-1 inline-block h-3 w-3" />
            Member since {formatDate(job.client.memberSince, { format: 'long' })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
      <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        <p className="truncate font-semibold">{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatBudget(job: Job): string {
  const { budgetType, budgetMin, budgetMax } = job;

  if (!budgetMin && !budgetMax) {
    return 'TBD';
  }

  const format = (n: number) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `$${n}`;
  };

  if (budgetType === 'HOURLY') {
    if (budgetMin && budgetMax) {
      return `${format(budgetMin)} - ${format(budgetMax)}/hr`;
    }
    return budgetMin
      ? `${format(budgetMin)}+/hr`
      : budgetMax
        ? `Up to ${format(budgetMax)}/hr`
        : 'Hourly';
  }

  if (budgetMin && budgetMax) {
    if (budgetMin === budgetMax) return format(budgetMin);
    return `${format(budgetMin)} - ${format(budgetMax)}`;
  }
  return budgetMin ? `${format(budgetMin)}+` : budgetMax ? `Up to ${format(budgetMax)}` : 'TBD';
}

function formatDuration(duration: number | undefined, unit: string | undefined): string {
  if (!duration || !unit) return 'Not specified';

  const unitLabels: Record<string, string> = {
    HOURS: 'hour',
    DAYS: 'day',
    WEEKS: 'week',
    MONTHS: 'month',
  };

  const label = unitLabels[unit] || unit.toLowerCase();
  return `${duration} ${label}${duration !== 1 ? 's' : ''}`;
}

function formatExperienceLevel(level: string | undefined): string {
  if (!level) return 'Any';
  return level.charAt(0) + level.slice(1).toLowerCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
