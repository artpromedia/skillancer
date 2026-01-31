/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * FreelancerPreview Component
 *
 * Compact preview card showing key freelancer information.
 * Used in proposal lists and quick views.
 */

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
} from '@skillancer/ui';
import {
  Briefcase,
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Shield,
  Star,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

import type { Proposal } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface FreelancerPreviewProps {
  freelancer: Proposal['freelancer'];
  compact?: boolean;
  showActions?: boolean;
  onMessage?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FreelancerPreview({
  freelancer,
  compact = false,
  showActions = true,
  onMessage,
  className,
}: Readonly<FreelancerPreviewProps>) {
  if (!freelancer) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const getVerificationBadge = () => {
    switch (freelancer.verificationLevel) {
      case 'VERIFIED':
        return (
          <Badge className="border-blue-200 bg-blue-100 text-blue-700" variant="outline">
            <Shield className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        );
      case 'PREMIUM':
        return (
          <Badge className="border-purple-200 bg-purple-100 text-purple-700" variant="outline">
            <Star className="mr-1 h-3 w-3" />
            Premium
          </Badge>
        );
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Avatar className="h-10 w-10">
          <AvatarImage alt={freelancer.name ?? freelancer.displayName} src={freelancer.avatarUrl} />
          <AvatarFallback>
            {(freelancer.name ?? freelancer.displayName)?.charAt(0) ?? 'F'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{freelancer.name ?? freelancer.displayName}</p>
            {freelancer.verificationLevel !== 'BASIC' && (
              <Shield className="h-4 w-4 flex-shrink-0 text-blue-500" />
            )}
          </div>
          <p className="text-muted-foreground truncate text-sm">{freelancer.title}</p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-medium">{freelancer.rating?.toFixed(1)}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage
              alt={freelancer.name ?? freelancer.displayName}
              src={freelancer.avatarUrl}
            />
            <AvatarFallback className="text-lg">
              {(freelancer.name ?? freelancer.displayName)?.charAt(0) ?? 'F'}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{freelancer.name ?? freelancer.displayName}</h3>
                  {getVerificationBadge()}
                </div>
                <p className="text-muted-foreground">{freelancer.title}</p>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{freelancer.rating?.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">({freelancer.reviewCount})</span>
              </div>
            </div>

            {freelancer.location && (
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                <span>{freelancer.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-4 gap-3 rounded-lg bg-slate-50 p-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-600">{freelancer.successRate}%</span>
            </div>
            <p className="text-muted-foreground text-xs">Success</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Briefcase className="h-4 w-4 text-slate-500" />
              <span className="font-semibold">
                {freelancer.jobsCompleted ?? freelancer.completedJobs}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">Jobs</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="font-semibold">{freelancer.responseTime}</span>
            </div>
            <p className="text-muted-foreground text-xs">Response</p>
          </div>

          <div className="text-center">
            <span className="font-semibold">{formatCurrency(freelancer.hourlyRate)}</span>
            <p className="text-muted-foreground text-xs">/hour</p>
          </div>
        </div>

        {/* Bio Preview */}
        {freelancer.bio && (
          <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">{freelancer.bio}</p>
        )}

        {/* Skills */}
        {freelancer.skills && freelancer.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {freelancer.skills.slice(0, 5).map((skill, idx) => {
              const skillName = typeof skill === 'string' ? skill : skill.name;
              const skillKey = typeof skill === 'string' ? skill : skill.id;
              return (
                <Badge key={skillKey ?? idx} className="text-xs" variant="secondary">
                  {skillName}
                </Badge>
              );
            })}
            {freelancer.skills.length > 5 && (
              <Badge className="text-xs" variant="secondary">
                +{freelancer.skills.length - 5}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-4 flex gap-2">
            <Button asChild className="flex-1" size="sm" variant="outline">
              <Link href={`/freelancers/${freelancer.username}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Profile
              </Link>
            </Button>
            {onMessage && (
              <Button className="flex-1" size="sm" variant="outline" onClick={onMessage}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Message
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Inline Version
// ============================================================================

export function FreelancerInline({
  freelancer,
  showRating = true,
}: Readonly<{
  freelancer: Proposal['freelancer'];
  showRating?: boolean;
}>) {
  if (!freelancer) return null;

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage alt={freelancer.name ?? freelancer.displayName} src={freelancer.avatarUrl} />
        <AvatarFallback className="text-xs">
          {(freelancer.name ?? freelancer.displayName)?.charAt(0) ?? 'F'}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium">{freelancer.name ?? freelancer.displayName}</span>
      {freelancer.verificationLevel !== 'BASIC' && (
        <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
      )}
      {showRating && (
        <span className="text-muted-foreground flex items-center gap-1 text-sm">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {freelancer.rating?.toFixed(1)}
        </span>
      )}
    </div>
  );
}
