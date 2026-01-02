/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@skillancer/ui';
import {
  Calendar,
  CheckCircle,
  Clock,
  Flag,
  Globe,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Share2,
  Shield,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import type { FreelancerProfile, VerificationLevel } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface GuildMembership {
  id: string;
  name: string;
  slug: string;
  role: string;
  combinedRating: number;
}

interface ProfileHeaderProps {
  profile: FreelancerProfile;
  isOwnProfile?: boolean;
  onHireClick?: () => void;
  onMessageClick?: () => void;
  className?: string;
  /** Guilds the freelancer is a member of */
  guilds?: GuildMembership[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getVerificationInfo(level: VerificationLevel) {
  const info = {
    NONE: { label: 'Not Verified', color: 'text-gray-400', bgColor: 'bg-gray-100' },
    EMAIL: { label: 'Email Verified', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    BASIC: { label: 'ID Verified', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    ENHANCED: { label: 'Enhanced ID', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    PREMIUM: { label: 'Premium Verified', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  };
  return info[level] || info.NONE;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMemberSince(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvailabilityInfo(status: string) {
  const info = {
    AVAILABLE: { label: 'Available Now', color: 'text-emerald-600', dotColor: 'bg-emerald-500' },
    PARTIALLY_AVAILABLE: {
      label: 'Partially Available',
      color: 'text-yellow-600',
      dotColor: 'bg-yellow-500',
    },
    NOT_AVAILABLE: { label: 'Not Available', color: 'text-gray-500', dotColor: 'bg-gray-400' },
  };
  return info[status as keyof typeof info] || info.NOT_AVAILABLE;
}

// ============================================================================
// Component
// ============================================================================

export function ProfileHeader({
  profile,
  isOwnProfile = false,
  onHireClick,
  onMessageClick,
  className,
  guilds = [],
}: ProfileHeaderProps) {
  const verificationInfo = getVerificationInfo(profile.verificationLevel);
  const availabilityInfo = getAvailabilityInfo(profile.availability);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `${profile.displayName} - ${profile.title}`,
        text: profile.headline ?? profile.title,
        url: profile.profileUrl,
      });
    } catch {
      // Fallback to copy to clipboard
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <section className={cn('relative', className)}>
      {/* Background gradient */}
      <div className="from-primary/10 via-primary/5 absolute inset-x-0 top-0 h-32 bg-gradient-to-r to-transparent" />

      <div className="relative px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          {/* Avatar with online status */}
          <div className="relative flex-shrink-0">
            <Avatar className="border-background h-24 w-24 border-4 shadow-lg sm:h-32 sm:w-32">
              <AvatarImage alt={profile.displayName} src={profile.avatarUrl} />
              <AvatarFallback className="text-2xl font-semibold">
                {getInitials(profile.firstName, profile.lastName)}
              </AvatarFallback>
            </Avatar>
            {/* Online status indicator */}
            {profile.isOnline && (
              <span className="border-background absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 bg-emerald-500 sm:h-5 sm:w-5" />
            )}
          </div>

          {/* Profile info */}
          <div className="min-w-0 flex-1">
            {/* Name and verification */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground text-2xl font-bold sm:text-3xl">
                {profile.displayName}
              </h1>
              {profile.verificationLevel !== 'NONE' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    verificationInfo.bgColor,
                    verificationInfo.color
                  )}
                >
                  {profile.verificationLevel === 'PREMIUM' ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : (
                    <Shield className="h-3.5 w-3.5" />
                  )}
                  {verificationInfo.label}
                </span>
              )}
            </div>

            {/* Professional title */}
            <p className="text-muted-foreground mt-1 text-lg">{profile.title}</p>

            {/* Meta info row */}
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {/* Location */}
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                  {profile.timezone && (
                    <span className="text-muted-foreground/60">({profile.timezone})</span>
                  )}
                </span>
              )}

              {/* Member since */}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Member since {formatMemberSince(profile.memberSince)}
              </span>

              {/* Response time */}
              {profile.stats.responseTime > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {profile.stats.responseTime < 1
                    ? 'Responds within an hour'
                    : profile.stats.responseTime < 24
                      ? `Responds in ${Math.round(profile.stats.responseTime)}h`
                      : 'Responds in 1+ days'}
                </span>
              )}
            </div>

            {/* Badges row */}
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.badges.map((badge) => (
                <Badge key={badge.id} className="gap-1 rounded-full" variant="secondary">
                  {badge.type === 'TOP_RATED' && (
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  )}
                  {badge.type === 'TOP_RATED_PLUS' && (
                    <Star className="h-3 w-3 fill-emerald-400 text-emerald-400" />
                  )}
                  {badge.type === 'RISING_TALENT' && <span className="text-blue-500">🚀</span>}
                  {badge.name}
                </Badge>
              ))}
              {profile.isPaymentVerified && (
                <Badge className="gap-1 rounded-full text-emerald-600" variant="outline">
                  <CheckCircle className="h-3 w-3" />
                  Payment Verified
                </Badge>
              )}
              {/* Guild Memberships */}
              {guilds.length > 0 &&
                guilds.map((guild) => (
                  <Link key={guild.id} href={`/guilds/${guild.slug}`}>
                    <Badge
                      className="cursor-pointer gap-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100"
                      variant="outline"
                    >
                      <Users className="h-3 w-3" />
                      {guild.name}
                      {guild.role === 'LEAD' && <span className="text-xs">★</span>}
                    </Badge>
                  </Link>
                ))}
            </div>

            {/* Availability and rate */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {/* Availability */}
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm font-medium',
                  availabilityInfo.color
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', availabilityInfo.dotColor)} />
                {availabilityInfo.label}
                {profile.hoursPerWeek > 0 && (
                  <span className="text-muted-foreground">({profile.hoursPerWeek}+ hrs/week)</span>
                )}
              </span>

              {/* Hourly rate */}
              {profile.hourlyRate && (
                <span className="text-foreground text-lg font-semibold">
                  {formatCurrency(profile.hourlyRate, profile.currency)}/hr
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
              {/* Rating */}
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{profile.stats.avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  ({profile.stats.totalReviews} reviews)
                </span>
              </div>

              {/* Jobs completed */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{profile.stats.completedJobs}</span>
                <span className="text-muted-foreground">Jobs Completed</span>
              </div>

              {/* Success rate */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{profile.stats.jobSuccessRate}%</span>
                <span className="text-muted-foreground">Job Success</span>
              </div>

              {/* On-time delivery */}
              {profile.stats.onTimeDelivery > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{profile.stats.onTimeDelivery}%</span>
                  <span className="text-muted-foreground">On Time</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
            {isOwnProfile ? (
              <Button asChild>
                <Link href="/dashboard/profile">Edit Profile</Link>
              </Button>
            ) : (
              <>
                <Button className="min-w-[140px]" size="lg" onClick={onHireClick}>
                  Hire Me
                </Button>
                <Button
                  className="min-w-[140px]"
                  size="lg"
                  variant="outline"
                  onClick={onMessageClick}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
              </>
            )}

            <div className="flex items-center gap-2 sm:justify-end">
              <Button size="icon" variant="ghost" onClick={() => void handleShare()}>
                <Share2 className="h-4 w-4" />
                <span className="sr-only">Share profile</span>
              </Button>
              {!isOwnProfile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Globe className="mr-2 h-4 w-4" />
                      Copy profile link
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Flag className="mr-2 h-4 w-4" />
                      Report profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
