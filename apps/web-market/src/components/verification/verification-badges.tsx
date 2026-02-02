'use client';

import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@skillancer/ui';
import {
  Award,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldPlus,
  Star,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type VerificationLevel = 'NONE' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface VerificationBadgeProps {
  readonly type: 'email' | 'phone' | 'identity' | 'payment' | 'skill' | 'business' | 'topRated';
  readonly verified: boolean;
  readonly level?: VerificationLevel;
  readonly skillName?: string;
  readonly skillScore?: number;
  readonly size?: BadgeSize;
  readonly showLabel?: boolean;
  readonly className?: string;
}

export interface ProfileBadgesProps {
  readonly emailVerified?: boolean;
  readonly phoneVerified?: boolean;
  readonly identityVerified?: boolean;
  readonly identityLevel?: VerificationLevel;
  readonly paymentVerified?: boolean;
  readonly businessVerified?: boolean;
  readonly verifiedSkills?: Array<{
    id: string;
    name: string;
    score: number;
  }>;
  readonly isTopRated?: boolean;
  readonly size?: BadgeSize;
  readonly showLabels?: boolean;
  readonly maxSkills?: number;
  readonly className?: string;
}

// ============================================================================
// Badge Configuration
// ============================================================================

interface BadgeConfig {
  icon: LucideIcon;
  label: string;
  verifiedColor: string;
  unverifiedColor: string;
  bgColor: string;
}

const badgeConfigs: Record<string, BadgeConfig> = {
  email: {
    icon: Mail,
    label: 'Email Verified',
    verifiedColor: 'text-blue-600',
    unverifiedColor: 'text-gray-400',
    bgColor: 'bg-blue-100',
  },
  phone: {
    icon: Phone,
    label: 'Phone Verified',
    verifiedColor: 'text-emerald-600',
    unverifiedColor: 'text-gray-400',
    bgColor: 'bg-emerald-100',
  },
  identity: {
    icon: Shield,
    label: 'Identity Verified',
    verifiedColor: 'text-purple-600',
    unverifiedColor: 'text-gray-400',
    bgColor: 'bg-purple-100',
  },
  payment: {
    icon: CreditCard,
    label: 'Payment Verified',
    verifiedColor: 'text-emerald-600',
    unverifiedColor: 'text-gray-400',
    bgColor: 'bg-emerald-100',
  },
  skill: {
    icon: Award,
    label: 'Skill Verified',
    verifiedColor: 'text-amber-600',
    unverifiedColor: 'text-gray-400',
    bgColor: 'bg-amber-100',
  },
  business: {
    icon: Building2,
    label: 'Business Verified',
    verifiedColor: 'text-orange-600',
    unverifiedColor: 'text-gray-400',
    bgColor: 'bg-orange-100',
  },
  topRated: {
    icon: Star,
    label: 'Top Rated',
    verifiedColor: 'text-yellow-500',
    unverifiedColor: 'text-gray-400',
    bgColor: 'bg-yellow-100',
  },
};

const identityLevelConfigs: Record<
  VerificationLevel,
  { icon: LucideIcon; label: string; color: string }
> = {
  NONE: { icon: Shield, label: 'Not Verified', color: 'text-gray-400' },
  BASIC: { icon: Shield, label: 'Basic Verified', color: 'text-blue-600' },
  ENHANCED: { icon: ShieldCheck, label: 'Enhanced Verified', color: 'text-purple-600' },
  PREMIUM: { icon: ShieldPlus, label: 'Premium Verified', color: 'text-emerald-600' },
};

const sizeConfigs: Record<
  BadgeSize,
  { iconSize: string; containerSize: string; fontSize: string }
> = {
  sm: { iconSize: 'h-3 w-3', containerSize: 'h-5 w-5', fontSize: 'text-xs' },
  md: { iconSize: 'h-4 w-4', containerSize: 'h-6 w-6', fontSize: 'text-sm' },
  lg: { iconSize: 'h-5 w-5', containerSize: 'h-8 w-8', fontSize: 'text-base' },
};

// ============================================================================
// Single Badge Component
// ============================================================================

export function VerificationBadge({
  type,
  verified,
  level,
  skillName,
  skillScore,
  size = 'md',
  showLabel = false,
  className,
}: VerificationBadgeProps) {
  const config = badgeConfigs[type];
  const sizeConfig = sizeConfigs[size];

  // For identity badges, use level-specific config
  const identityConfig = type === 'identity' && level ? identityLevelConfigs[level] : null;
  const Icon = identityConfig?.icon ?? config.icon;
  const iconColor = verified
    ? (identityConfig?.color ?? config.verifiedColor)
    : config.unverifiedColor;

  const label =
    type === 'skill' && skillName
      ? `${skillName} (${skillScore}%)`
      : (identityConfig?.label ?? config.label);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-1.5', className)}>
            <div
              className={cn(
                'flex items-center justify-center rounded-full',
                sizeConfig.containerSize,
                verified && config.bgColor
              )}
            >
              <Icon className={cn(sizeConfig.iconSize, iconColor)} />
            </div>
            {showLabel && <span className={cn(sizeConfig.fontSize, iconColor)}>{label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
          {type === 'skill' && skillScore !== undefined && (
            <p className="text-muted-foreground text-xs">Score: {skillScore}%</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Identity Badge with Level
// ============================================================================

interface IdentityBadgeProps {
  readonly level: VerificationLevel;
  readonly size?: BadgeSize;
  readonly showLabel?: boolean;
  readonly className?: string;
}

export function IdentityBadge({
  level,
  size = 'md',
  showLabel = false,
  className,
}: IdentityBadgeProps) {
  const config = identityLevelConfigs[level];
  const sizeConfig = sizeConfigs[size];
  const Icon = config.icon;

  if (level === 'NONE') {
    return null;
  }

  const bgColors: Record<VerificationLevel, string> = {
    NONE: '',
    BASIC: 'bg-blue-100',
    ENHANCED: 'bg-purple-100',
    PREMIUM: 'bg-emerald-100',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-1.5', className)}>
            <div
              className={cn(
                'flex items-center justify-center rounded-full',
                sizeConfig.containerSize,
                bgColors[level]
              )}
            >
              <Icon className={cn(sizeConfig.iconSize, config.color)} />
            </div>
            {showLabel && (
              <span className={cn(sizeConfig.fontSize, config.color)}>{config.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Skill Badge
// ============================================================================

interface SkillBadgeProps {
  readonly name: string;
  readonly score: number;
  readonly size?: BadgeSize;
  readonly showLabel?: boolean;
  readonly className?: string;
}

export function SkillBadge({
  name,
  score,
  size = 'md',
  showLabel = false,
  className,
}: SkillBadgeProps) {
  const sizeConfig = sizeConfigs[size];

  // Color based on score
  const getScoreColor = (s: number): string => {
    if (s >= 90) return 'text-emerald-600';
    if (s >= 70) return 'text-blue-600';
    if (s >= 50) return 'text-amber-600';
    return 'text-gray-500';
  };

  const getBgColor = (s: number): string => {
    if (s >= 90) return 'bg-emerald-100';
    if (s >= 70) return 'bg-blue-100';
    if (s >= 50) return 'bg-amber-100';
    return 'bg-gray-100';
  };

  const scoreColor = getScoreColor(score);
  const bgColor = getBgColor(score);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-1.5', className)}>
            <div
              className={cn(
                'flex items-center justify-center rounded-full',
                sizeConfig.containerSize,
                bgColor
              )}
            >
              <Award className={cn(sizeConfig.iconSize, scoreColor)} />
            </div>
            {showLabel && <span className={cn(sizeConfig.fontSize, scoreColor)}>{name}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground text-xs">Verified Score: {score}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Profile Badges Collection
// ============================================================================

export function ProfileBadges({
  emailVerified = false,
  phoneVerified = false,
  identityVerified = false,
  identityLevel = 'NONE',
  paymentVerified = false,
  businessVerified = false,
  verifiedSkills = [],
  isTopRated = false,
  size = 'md',
  showLabels = false,
  maxSkills = 3,
  className,
}: ProfileBadgesProps) {
  const displayedSkills = verifiedSkills.slice(0, maxSkills);
  const remainingSkills = verifiedSkills.length - maxSkills;

  // Don't render if nothing is verified
  const hasAnyVerification =
    emailVerified ||
    phoneVerified ||
    identityVerified ||
    paymentVerified ||
    businessVerified ||
    verifiedSkills.length > 0 ||
    isTopRated;

  if (!hasAnyVerification) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Top Rated (most prominent) */}
      {isTopRated && (
        <VerificationBadge verified showLabel={showLabels} size={size} type="topRated" />
      )}

      {/* Identity (with level) */}
      {identityVerified && identityLevel !== 'NONE' && (
        <IdentityBadge level={identityLevel} showLabel={showLabels} size={size} />
      )}

      {/* Business */}
      {businessVerified && (
        <VerificationBadge verified showLabel={showLabels} size={size} type="business" />
      )}

      {/* Payment */}
      {paymentVerified && (
        <VerificationBadge verified showLabel={showLabels} size={size} type="payment" />
      )}

      {/* Verified Skills */}
      {displayedSkills.map((skill) => (
        <SkillBadge
          key={skill.id}
          name={skill.name}
          score={skill.score}
          showLabel={showLabels}
          size={size}
        />
      ))}

      {/* More skills indicator */}
      {remainingSkills > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('text-muted-foreground', sizeConfigs[size].fontSize)}>
                +{remainingSkills} more
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{remainingSkills} more verified skills</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Email & Phone (less prominent) */}
      {emailVerified && (
        <VerificationBadge verified showLabel={showLabels} size={size} type="email" />
      )}
      {phoneVerified && (
        <VerificationBadge verified showLabel={showLabels} size={size} type="phone" />
      )}
    </div>
  );
}

// ============================================================================
// Compact Badge Strip (for cards/list items)
// ============================================================================

interface CompactBadgeStripProps {
  readonly emailVerified?: boolean;
  readonly phoneVerified?: boolean;
  readonly identityLevel?: VerificationLevel;
  readonly paymentVerified?: boolean;
  readonly businessVerified?: boolean;
  readonly skillCount?: number;
  readonly isTopRated?: boolean;
  readonly className?: string;
}

export function CompactBadgeStrip({
  emailVerified,
  phoneVerified,
  identityLevel = 'NONE',
  paymentVerified,
  businessVerified,
  skillCount = 0,
  isTopRated,
  className,
}: CompactBadgeStripProps) {
  const badges: Array<{ icon: LucideIcon; color: string; label: string }> = [];

  if (isTopRated) {
    badges.push({ icon: Star, color: 'text-yellow-500', label: 'Top Rated' });
  }

  if (identityLevel !== 'NONE') {
    const config = identityLevelConfigs[identityLevel];
    badges.push({ icon: config.icon, color: config.color, label: config.label });
  }

  if (businessVerified) {
    badges.push({ icon: Building2, color: 'text-orange-600', label: 'Business Verified' });
  }

  if (paymentVerified) {
    badges.push({ icon: CreditCard, color: 'text-emerald-600', label: 'Payment Verified' });
  }

  if (skillCount > 0) {
    badges.push({
      icon: Award,
      color: 'text-amber-600',
      label: `${skillCount} Verified Skills`,
    });
  }

  if (emailVerified) {
    badges.push({ icon: Mail, color: 'text-blue-600', label: 'Email Verified' });
  }

  if (phoneVerified) {
    badges.push({ icon: Phone, color: 'text-emerald-600', label: 'Phone Verified' });
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1', className)}>
        {badges.slice(0, 5).map(({ icon: Icon, color, label }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <div className="rounded-full p-0.5">
                <Icon className={cn('h-3.5 w-3.5', color)} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {badges.length > 5 && (
          <span className="text-muted-foreground text-xs">+{badges.length - 5}</span>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Verification Status Indicator
// ============================================================================

interface VerificationStatusIndicatorProps {
  readonly verified: boolean;
  readonly label?: string;
  readonly size?: BadgeSize;
  readonly className?: string;
}

export function VerificationStatusIndicator({
  verified,
  label,
  size = 'sm',
  className,
}: VerificationStatusIndicatorProps) {
  const sizeConfig = sizeConfigs[size];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1',
        verified ? 'text-emerald-600' : 'text-muted-foreground',
        className
      )}
    >
      {verified ? (
        <BadgeCheck className={sizeConfig.iconSize} />
      ) : (
        <CheckCircle2 className={cn(sizeConfig.iconSize, 'opacity-50')} />
      )}
      {label && <span className={sizeConfig.fontSize}>{label}</span>}
    </div>
  );
}
