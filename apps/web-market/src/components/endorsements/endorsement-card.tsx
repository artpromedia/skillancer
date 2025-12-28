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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  Award,
  Briefcase,
  CheckCircle,
  ExternalLink,
  Flag,
  MoreHorizontal,
  Star,
  ThumbsUp,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

export interface EndorsementData {
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
    connectionDegree?: 1 | 2 | 3;
  };
  relationship: 'client' | 'colleague' | 'manager' | 'mentor' | 'collaborator' | 'other';
  endorsementText?: string;
  projectContext?: {
    id: string;
    title: string;
  };
  createdAt: string;
  featured?: boolean;
  verified?: boolean;
}

export interface EndorsementCardProps {
  endorsement: EndorsementData;
  variant?: 'default' | 'compact' | 'featured';
  showActions?: boolean;
  onToggleFeatured?: (id: string) => void;
  onRemove?: (id: string) => void;
  onReport?: (id: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const relationshipConfig: Record<
  EndorsementData['relationship'],
  { label: string; icon: typeof User; color: string }
> = {
  client: {
    label: 'Client',
    icon: Briefcase,
    color: 'bg-blue-100 text-blue-700',
  },
  colleague: {
    label: 'Colleague',
    icon: User,
    color: 'bg-green-100 text-green-700',
  },
  manager: {
    label: 'Manager',
    icon: User,
    color: 'bg-purple-100 text-purple-700',
  },
  mentor: {
    label: 'Mentor',
    icon: Award,
    color: 'bg-amber-100 text-amber-700',
  },
  collaborator: {
    label: 'Collaborator',
    icon: User,
    color: 'bg-teal-100 text-teal-700',
  },
  other: {
    label: 'Connection',
    icon: User,
    color: 'bg-slate-100 text-slate-700',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Default Variant
// ============================================================================

function DefaultEndorsementCard({
  endorsement,
  showActions,
  onToggleFeatured,
  onRemove,
  onReport,
  className,
}: Readonly<Omit<EndorsementCardProps, 'variant'>>) {
  const relationshipInfo = relationshipConfig[endorsement.relationship];
  const RelationshipIcon = relationshipInfo.icon;

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        endorsement.featured && 'ring-2 ring-amber-300 ring-offset-2',
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage alt={endorsement.endorser.name} src={endorsement.endorser.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(endorsement.endorser.name)}
              </AvatarFallback>
            </Avatar>
            {endorsement.endorser.verified && (
              <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5">
                <CheckCircle className="h-4 w-4 fill-blue-500 text-white" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="font-semibold text-slate-900 hover:underline"
                    href={`/freelancers/${endorsement.endorser.id}`}
                  >
                    {endorsement.endorser.name}
                  </Link>
                  <Badge className={relationshipInfo.color} variant="secondary">
                    <RelationshipIcon className="mr-1 h-3 w-3" />
                    {relationshipInfo.label}
                  </Badge>
                  {endorsement.verified && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className="bg-green-100 text-green-700" variant="secondary">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          This endorsement has been verified through project collaboration
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {endorsement.endorser.title && (
                  <p className="text-muted-foreground text-sm">
                    {endorsement.endorser.title}
                    {endorsement.endorser.company && ` at ${endorsement.endorser.company}`}
                  </p>
                )}
              </div>

              {/* Actions Dropdown */}
              {showActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onToggleFeatured && (
                      <DropdownMenuItem onClick={() => onToggleFeatured(endorsement.id)}>
                        <Star
                          className="mr-2 h-4 w-4"
                          fill={endorsement.featured ? 'currentColor' : 'none'}
                        />
                        {endorsement.featured ? 'Remove from featured' : 'Feature on profile'}
                      </DropdownMenuItem>
                    )}
                    {onReport && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onReport(endorsement.id)}>
                          <Flag className="mr-2 h-4 w-4" />
                          Report endorsement
                        </DropdownMenuItem>
                      </>
                    )}
                    {onRemove && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => onRemove(endorsement.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove endorsement
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Skill and Project Context */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="font-normal" variant="outline">
                <ThumbsUp className="mr-1 h-3 w-3" />
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

            {/* Endorsement Text */}
            {endorsement.endorsementText && (
              <blockquote className="border-primary/20 mt-3 border-l-2 pl-3">
                <p className="text-muted-foreground text-sm italic">
                  &quot;{endorsement.endorsementText}&quot;
                </p>
              </blockquote>
            )}

            {/* Timestamp */}
            <p className="text-muted-foreground mt-3 text-xs">
              {formatTimeAgo(endorsement.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

function CompactEndorsementCard({
  endorsement,
  className,
}: Readonly<Omit<EndorsementCardProps, 'variant'>>) {
  const relationshipInfo = relationshipConfig[endorsement.relationship];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-white p-3 transition-colors hover:bg-slate-50',
        className
      )}
    >
      <Avatar className="h-9 w-9">
        <AvatarImage alt={endorsement.endorser.name} src={endorsement.endorser.avatar} />
        <AvatarFallback className="text-xs">
          {getInitials(endorsement.endorser.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{endorsement.endorser.name}</p>
          <Badge className={cn(relationshipInfo.color, 'text-xs')} variant="secondary">
            {relationshipInfo.label}
          </Badge>
        </div>
        <p className="text-muted-foreground truncate text-xs">
          Endorsed for <span className="font-medium">{endorsement.skill.name}</span>
        </p>
      </div>

      <span className="text-muted-foreground shrink-0 text-xs">
        {formatTimeAgo(endorsement.createdAt)}
      </span>
    </div>
  );
}

// ============================================================================
// Featured Variant
// ============================================================================

function FeaturedEndorsementCard({
  endorsement,
  showActions,
  onToggleFeatured,
  className,
}: Readonly<Omit<EndorsementCardProps, 'variant'>>) {
  const relationshipInfo = relationshipConfig[endorsement.relationship];
  const RelationshipIcon = relationshipInfo.icon;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white',
        className
      )}
    >
      {/* Featured badge */}
      <div className="absolute right-0 top-0">
        <div className="bg-amber-500 px-3 py-1 text-xs font-medium text-white">
          <Star className="mr-1 inline h-3 w-3" fill="currentColor" />
          Featured
        </div>
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
          {/* Avatar */}
          <div className="mb-4 sm:mb-0 sm:mr-6">
            <div className="relative">
              <Avatar className="h-16 w-16 ring-4 ring-amber-200">
                <AvatarImage alt={endorsement.endorser.name} src={endorsement.endorser.avatar} />
                <AvatarFallback className="bg-amber-100 text-lg text-amber-700">
                  {getInitials(endorsement.endorser.name)}
                </AvatarFallback>
              </Avatar>
              {endorsement.endorser.verified && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5">
                  <CheckCircle className="h-5 w-5 fill-blue-500 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Link
                className="text-lg font-semibold text-slate-900 hover:underline"
                href={`/freelancers/${endorsement.endorser.id}`}
              >
                {endorsement.endorser.name}
              </Link>
              <Badge className={relationshipInfo.color} variant="secondary">
                <RelationshipIcon className="mr-1 h-3 w-3" />
                {relationshipInfo.label}
              </Badge>
            </div>

            {endorsement.endorser.title && (
              <p className="text-muted-foreground text-sm">
                {endorsement.endorser.title}
                {endorsement.endorser.company && ` at ${endorsement.endorser.company}`}
              </p>
            )}

            {endorsement.endorsementText && (
              <blockquote className="mt-4">
                <p className="text-base text-slate-700">
                  &quot;{endorsement.endorsementText}&quot;
                </p>
              </blockquote>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <Badge className="font-normal" variant="outline">
                <ThumbsUp className="mr-1 h-3 w-3" />
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
              <span className="text-muted-foreground text-xs">
                {formatTimeAgo(endorsement.createdAt)}
              </span>
            </div>
          </div>

          {/* Remove from featured button */}
          {showActions && onToggleFeatured && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="absolute right-2 top-8 text-amber-600 hover:text-amber-700"
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleFeatured(endorsement.id)}
                  >
                    <Star className="h-4 w-4" fill="currentColor" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove from featured</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EndorsementCard({ variant = 'default', ...props }: Readonly<EndorsementCardProps>) {
  switch (variant) {
    case 'compact':
      return <CompactEndorsementCard {...props} />;
    case 'featured':
      return <FeaturedEndorsementCard {...props} />;
    default:
      return <DefaultEndorsementCard {...props} />;
  }
}

// ============================================================================
// Endorsement Count Badge (for showing total endorsements on a skill)
// ============================================================================

export interface EndorsementCountBadgeProps {
  count: number;
  topEndorsers?: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  skillName?: string;
  onClick?: () => void;
  className?: string;
}

export function EndorsementCountBadge({
  count,
  topEndorsers = [],
  skillName,
  onClick,
  className,
}: Readonly<EndorsementCountBadgeProps>) {
  if (count === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100',
              className
            )}
            onClick={onClick}
          >
            <div className="flex -space-x-1.5">
              {topEndorsers.slice(0, 3).map((endorser) => (
                <Avatar key={endorser.id} className="h-4 w-4 border border-white">
                  <AvatarImage alt={endorser.name} src={endorser.avatar} />
                  <AvatarFallback className="text-[8px]">{endorser.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <ThumbsUp className="h-3 w-3" />
            <span>{count}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {count} endorsement{count === 1 ? '' : 's'}
            {skillName && ` for ${skillName}`}
          </p>
          {topEndorsers.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Including {topEndorsers.map((e) => e.name).join(', ')}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
