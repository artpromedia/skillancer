'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Quote,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Endorsement {
  id: string;
  skill: {
    id: string;
    name: string;
    category: string;
  };
  endorser: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
    company?: string;
    verified?: boolean;
  };
  relationship: 'client' | 'colleague' | 'manager' | 'mentor' | 'collaborator' | 'other';
  endorsementText?: string;
  projectContext?: {
    id: string;
    title: string;
  };
  createdAt: string;
  featured?: boolean;
}

export interface SkillEndorsementSummary {
  skillId: string;
  skillName: string;
  category: string;
  totalEndorsements: number;
  topEndorsers: Array<{
    id: string;
    name: string;
    avatar?: string;
    title?: string;
  }>;
  percentile?: number;
}

export interface EndorsementsSectionProps {
  endorsements: Endorsement[];
  skillSummaries: SkillEndorsementSummary[];
  totalEndorsements: number;
  isOwnProfile?: boolean;
  onRequestEndorsement?: () => void;
  onViewAll?: () => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const relationshipLabels: Record<Endorsement['relationship'], string> = {
  client: 'Client',
  colleague: 'Colleague',
  manager: 'Manager',
  mentor: 'Mentor',
  collaborator: 'Collaborator',
  other: 'Connection',
};

const relationshipColors: Record<Endorsement['relationship'], string> = {
  client: 'bg-blue-100 text-blue-700',
  colleague: 'bg-green-100 text-green-700',
  manager: 'bg-purple-100 text-purple-700',
  mentor: 'bg-amber-100 text-amber-700',
  collaborator: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-700',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function _formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) return 'Recently';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ============================================================================
// Top Endorsed Skills Component
// ============================================================================

function TopEndorsedSkills({
  summaries,
  maxDisplay = 5,
}: Readonly<{
  summaries: SkillEndorsementSummary[];
  maxDisplay?: number;
}>) {
  const topSkills = [...summaries]
    .sort((a, b) => b.totalEndorsements - a.totalEndorsements)
    .slice(0, maxDisplay);

  if (topSkills.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <TrendingUp className="h-4 w-4" />
        Most Endorsed Skills
      </h3>
      <div className="space-y-2">
        {topSkills.map((skill, index) => (
          <div
            key={skill.skillId}
            className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  index === 0 && 'bg-amber-100 text-amber-700',
                  index === 1 && 'bg-slate-200 text-slate-700',
                  index === 2 && 'bg-orange-100 text-orange-700',
                  index > 2 && 'bg-slate-100 text-slate-600'
                )}
              >
                {index + 1}
              </span>
              <div>
                <p className="font-medium">{skill.skillName}</p>
                <p className="text-muted-foreground text-xs">{skill.category}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Top endorsers avatars */}
              <div className="flex -space-x-2">
                {skill.topEndorsers.slice(0, 3).map((endorser) => (
                  <TooltipProvider key={endorser.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-6 w-6 border-2 border-white">
                          <AvatarImage alt={endorser.name} src={endorser.avatar} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(endorser.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{endorser.name}</p>
                        {endorser.title && (
                          <p className="text-muted-foreground text-xs">{endorser.title}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              <Badge className="font-semibold" variant="secondary">
                <ThumbsUp className="mr-1 h-3 w-3" />
                {skill.totalEndorsements}
              </Badge>
              {skill.percentile && skill.percentile >= 90 && (
                <Badge className="bg-amber-100 text-amber-700" variant="secondary">
                  Top {100 - skill.percentile}%
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Featured Testimonial Card
// ============================================================================

function FeaturedTestimonialCard({ endorsement }: Readonly<{ endorsement: Endorsement }>) {
  return (
    <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <div className="absolute right-0 top-0">
        <div className="bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
          <Star className="mr-0.5 inline h-3 w-3" fill="currentColor" />
          Featured
        </div>
      </div>
      <CardContent className="p-5">
        <Quote className="mb-3 h-8 w-8 text-amber-300" />
        <p className="mb-4 text-slate-700">&quot;{endorsement.endorsementText}&quot;</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-amber-200">
              <AvatarImage alt={endorsement.endorser.name} src={endorsement.endorser.avatar} />
              <AvatarFallback className="bg-amber-100 text-amber-700">
                {getInitials(endorsement.endorser.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link
                className="font-medium hover:underline"
                href={`/freelancers/${endorsement.endorser.id}`}
              >
                {endorsement.endorser.name}
              </Link>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                {endorsement.endorser.title && (
                  <span>
                    {endorsement.endorser.title}
                    {endorsement.endorser.company && ` at ${endorsement.endorser.company}`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge className="font-normal" variant="outline">
            <ThumbsUp className="mr-1 h-3 w-3" />
            {endorsement.skill.name}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Regular Testimonial Card
// ============================================================================

function TestimonialCard({
  endorsement,
  compact = false,
}: Readonly<{
  endorsement: Endorsement;
  compact?: boolean;
}>) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', compact && 'border-0 bg-slate-50')}>
      <CardContent className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-start gap-3">
          <Avatar className={cn(compact ? 'h-8 w-8' : 'h-10 w-10')}>
            <AvatarImage alt={endorsement.endorser.name} src={endorsement.endorser.avatar} />
            <AvatarFallback className="text-xs">
              {getInitials(endorsement.endorser.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                className="text-sm font-medium hover:underline"
                href={`/freelancers/${endorsement.endorser.id}`}
              >
                {endorsement.endorser.name}
              </Link>
              <Badge
                className={cn(relationshipColors[endorsement.relationship], 'text-xs')}
                variant="secondary"
              >
                {relationshipLabels[endorsement.relationship]}
              </Badge>
            </div>
            {endorsement.endorser.title && !compact && (
              <p className="text-muted-foreground text-xs">
                {endorsement.endorser.title}
                {endorsement.endorser.company && ` at ${endorsement.endorser.company}`}
              </p>
            )}
            {endorsement.endorsementText && (
              <p
                className={cn(
                  'text-muted-foreground mt-2 text-sm italic',
                  compact && 'line-clamp-2'
                )}
              >
                &quot;{endorsement.endorsementText}&quot;
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Badge className="text-xs font-normal" variant="outline">
                {endorsement.skill.name}
              </Badge>
              {endorsement.projectContext && (
                <Link
                  className="text-muted-foreground inline-flex items-center text-xs hover:underline"
                  href={`/contracts/${endorsement.projectContext.id}`}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  {endorsement.projectContext.title}
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Endorsement Summary Stats
// ============================================================================

function EndorsementStats({
  totalEndorsements,
  skillCount,
  topRelationship,
}: Readonly<{
  totalEndorsements: number;
  skillCount: number;
  topRelationship?: { type: string; count: number } | undefined;
}>) {
  return (
    <div className="grid grid-cols-3 gap-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-4">
      <div className="text-center">
        <p className="text-2xl font-bold text-blue-700">{totalEndorsements}</p>
        <p className="text-muted-foreground text-xs">Endorsements</p>
      </div>
      <div className="border-l border-r text-center">
        <p className="text-2xl font-bold text-purple-700">{skillCount}</p>
        <p className="text-muted-foreground text-xs">Skills Endorsed</p>
      </div>
      <div className="text-center">
        {topRelationship ? (
          <>
            <p className="text-2xl font-bold text-green-700">{topRelationship.count}</p>
            <p className="text-muted-foreground text-xs">From {topRelationship.type}s</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-green-700">—</p>
            <p className="text-muted-foreground text-xs">Clients</p>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EndorsementsSection({
  endorsements,
  skillSummaries,
  totalEndorsements,
  isOwnProfile = false,
  onRequestEndorsement,
  onViewAll,
  className,
}: Readonly<EndorsementsSectionProps>) {
  const [showAllTestimonials, setShowAllTestimonials] = useState(false);

  // Get featured endorsements (with testimonials and marked as featured)
  const featuredEndorsements = endorsements.filter((e) => e.featured && e.endorsementText);

  // Get endorsements with testimonials (not featured)
  const testimonialEndorsements = endorsements.filter((e) => !e.featured && e.endorsementText);

  // Calculate top relationship type
  const relationshipCounts = endorsements.reduce(
    (acc, e) => {
      acc[e.relationship] = (acc[e.relationship] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const topRelationship = Object.entries(relationshipCounts).sort((a, b) => b[1] - a[1])[0];

  // How many testimonials to show initially
  const initialTestimonialCount = 3;
  const displayedTestimonials = showAllTestimonials
    ? testimonialEndorsements
    : testimonialEndorsements.slice(0, initialTestimonialCount);

  if (totalEndorsements === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            Endorsements
          </CardTitle>
          <CardDescription>Skill endorsements from clients and colleagues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center">
            <Users className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 font-semibold">No endorsements yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm text-sm">
              {isOwnProfile
                ? 'Request endorsements from past clients and colleagues to build trust with potential clients.'
                : 'This freelancer has not received any endorsements yet.'}
            </p>
            {isOwnProfile && onRequestEndorsement && (
              <Button onClick={onRequestEndorsement}>
                <Users className="mr-2 h-4 w-4" />
                Request Endorsement
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5" />
              Endorsements
              <Badge className="ml-1" variant="secondary">
                {totalEndorsements}
              </Badge>
            </CardTitle>
            <CardDescription>Skill endorsements from clients and colleagues</CardDescription>
          </div>
          <div className="flex gap-2">
            {isOwnProfile && onRequestEndorsement && (
              <Button size="sm" variant="outline" onClick={onRequestEndorsement}>
                <Users className="mr-2 h-4 w-4" />
                Request
              </Button>
            )}
            {onViewAll && (
              <Button size="sm" variant="ghost" onClick={onViewAll}>
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Overview */}
        <EndorsementStats
          skillCount={skillSummaries.length}
          topRelationship={
            topRelationship
              ? {
                  type: relationshipLabels[topRelationship[0] as Endorsement['relationship']],
                  count: topRelationship[1],
                }
              : undefined
          }
          totalEndorsements={totalEndorsements}
        />

        {/* Top Endorsed Skills */}
        <TopEndorsedSkills maxDisplay={5} summaries={skillSummaries} />

        {/* Featured Testimonials */}
        {featuredEndorsements.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Star className="h-4 w-4 text-amber-500" />
              Featured Testimonials
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {featuredEndorsements.slice(0, 2).map((endorsement) => (
                <FeaturedTestimonialCard key={endorsement.id} endorsement={endorsement} />
              ))}
            </div>
          </div>
        )}

        {/* Other Testimonials */}
        {testimonialEndorsements.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <MessageSquare className="h-4 w-4" />
              What People Say
            </h3>
            <div className="space-y-3">
              {displayedTestimonials.map((endorsement) => (
                <TestimonialCard key={endorsement.id} endorsement={endorsement} />
              ))}
            </div>
            {testimonialEndorsements.length > initialTestimonialCount && (
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => setShowAllTestimonials(!showAllTestimonials)}
              >
                {showAllTestimonials
                  ? 'Show less'
                  : `Show ${testimonialEndorsements.length - initialTestimonialCount} more testimonials`}
              </Button>
            )}
          </div>
        )}

        {/* CTA for own profile */}
        {isOwnProfile && featuredEndorsements.length === 0 && (
          <Card className="border-dashed bg-slate-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-amber-100 p-2">
                <Sparkles className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Feature your best testimonials</p>
                <p className="text-muted-foreground text-sm">
                  Select endorsements with testimonials to feature prominently on your profile.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={onViewAll}>
                Manage
              </Button>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Variant for sidebars
// ============================================================================

export interface CompactEndorsementsSectionProps {
  skillSummaries: SkillEndorsementSummary[];
  totalEndorsements: number;
  onViewAll?: () => void;
  className?: string;
}

export function CompactEndorsementsSection({
  skillSummaries,
  totalEndorsements,
  onViewAll,
  className,
}: Readonly<CompactEndorsementsSectionProps>) {
  const topSkills = [...skillSummaries]
    .sort((a, b) => b.totalEndorsements - a.totalEndorsements)
    .slice(0, 3);

  if (totalEndorsements === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <ThumbsUp className="h-4 w-4" />
          Endorsements
          <Badge className="text-xs" variant="secondary">
            {totalEndorsements}
          </Badge>
        </h3>
        {onViewAll && (
          <Button className="h-6 px-2 text-xs" size="sm" variant="ghost" onClick={onViewAll}>
            View all
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {topSkills.map((skill) => (
          <div
            key={skill.skillId}
            className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
          >
            <span className="text-sm font-medium">{skill.skillName}</span>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {skill.topEndorsers.slice(0, 2).map((endorser) => (
                  <Avatar key={endorser.id} className="h-5 w-5 border border-white">
                    <AvatarImage alt={endorser.name} src={endorser.avatar} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(endorser.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-muted-foreground text-xs">{skill.totalEndorsements}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
