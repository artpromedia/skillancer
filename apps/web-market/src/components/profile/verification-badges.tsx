'use client';

import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  Award,
  BadgeCheck,
  Building2,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Phone,
  Shield,
  ShieldCheck,
  ShieldPlus,
  Sparkles,
  Star,
} from 'lucide-react';
import Link from 'next/link';

import type { FreelancerBadge, VerificationLevel } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface VerificationBadgesProps {
  verificationLevel: VerificationLevel;
  isIdentityVerified: boolean;
  isPaymentVerified: boolean;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  badges: FreelancerBadge[];
  complianceBadges?: ComplianceBadge[];
  showLearnMore?: boolean;
  animated?: boolean;
  className?: string;
}

interface ComplianceBadge {
  id: string;
  type: 'HIPAA' | 'SOC2' | 'GDPR' | 'PCI_DSS' | 'ISO_27001' | 'SECURITY_CLEARANCE';
  name: string;
  verifiedAt?: string;
  expiresAt?: string;
}

interface SingleBadgeProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  verified: boolean;
  animated?: boolean;
}

// ============================================================================
// Single Badge Component
// ============================================================================

function SingleBadge({
  icon,
  label,
  description,
  color,
  bgColor,
  verified,
  animated = false,
}: Readonly<SingleBadgeProps>) {
  if (!verified) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
              bgColor,
              color,
              animated && 'animate-in fade-in slide-in-from-bottom-1 duration-300'
            )}
          >
            {icon}
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="bottom">
          <p className="text-sm">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Identity Verification Badge
// ============================================================================

function IdentityVerificationBadge({
  level,
  animated,
}: Readonly<{
  level: VerificationLevel;
  animated?: boolean;
}>) {
  if (level === 'NONE' || level === 'EMAIL') return null;

  const config = {
    BASIC: {
      icon: <Shield className="h-4 w-4" />,
      label: 'ID Verified',
      description: 'Identity verified with government-issued ID and selfie match.',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
    },
    ENHANCED: {
      icon: <ShieldCheck className="h-4 w-4" />,
      label: 'Enhanced ID',
      description:
        'Enhanced identity verification including AML/PEP screening and background check.',
      color: 'text-purple-700',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
    },
    PREMIUM: {
      icon: <ShieldPlus className="h-4 w-4" />,
      label: 'Premium Verified',
      description:
        'Premium verification with biometric liveness detection, address verification, and continuous monitoring.',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    },
  };

  const badgeConfig = config[level];
  if (!badgeConfig) return null;

  return <SingleBadge {...badgeConfig} animated={animated} verified={true} />;
}

// ============================================================================
// Talent Badge
// ============================================================================

function TalentBadge({
  badge,
  animated,
}: Readonly<{ badge: FreelancerBadge; animated?: boolean }>) {
  const config = {
    RISING_TALENT: {
      icon: <Sparkles className="h-4 w-4" />,
      label: 'Rising Talent',
      description: 'New to the platform with excellent early performance and reviews.',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
    },
    TOP_RATED: {
      icon: <Star className="h-4 w-4 fill-current" />,
      label: 'Top Rated',
      description: 'Consistently delivers outstanding work with 90%+ Job Success Score.',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50 hover:bg-yellow-100',
    },
    TOP_RATED_PLUS: {
      icon: <Star className="h-4 w-4 fill-current" />,
      label: 'Top Rated Plus',
      description: 'Elite talent with exceptional track record and large contract history.',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    },
    EXPERT_VETTED: {
      icon: <Award className="h-4 w-4" />,
      label: 'Expert-Vetted',
      description: 'Hand-selected by Skillancer for exceptional expertise in their field.',
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100',
    },
    SKILL_CERTIFIED: {
      icon: <BadgeCheck className="h-4 w-4" />,
      label: 'Skill Certified',
      description: 'Passed rigorous skill assessments through SkillPod.',
      color: 'text-cyan-700',
      bgColor: 'bg-cyan-50 hover:bg-cyan-100',
    },
  };

  const badgeConfig = config[badge.type];
  if (!badgeConfig) return null;

  return <SingleBadge {...badgeConfig} animated={animated} verified={true} />;
}

// ============================================================================
// Compliance Badge
// ============================================================================

function ComplianceBadgeItem({
  badge,
  animated,
}: Readonly<{ badge: ComplianceBadge; animated?: boolean }>) {
  const config = {
    HIPAA: {
      icon: <Building2 className="h-4 w-4" />,
      label: 'HIPAA',
      description: 'Trained and certified for handling protected health information.',
      color: 'text-teal-700',
      bgColor: 'bg-teal-50 hover:bg-teal-100',
    },
    SOC2: {
      icon: <Shield className="h-4 w-4" />,
      label: 'SOC 2',
      description: 'Verified compliance with SOC 2 security and privacy standards.',
      color: 'text-slate-700',
      bgColor: 'bg-slate-50 hover:bg-slate-100',
    },
    GDPR: {
      icon: <Shield className="h-4 w-4" />,
      label: 'GDPR',
      description: 'Trained in GDPR compliance and data protection requirements.',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
    },
    PCI_DSS: {
      icon: <CreditCard className="h-4 w-4" />,
      label: 'PCI DSS',
      description: 'Compliant with Payment Card Industry Data Security Standards.',
      color: 'text-orange-700',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
    },
    ISO_27001: {
      icon: <Shield className="h-4 w-4" />,
      label: 'ISO 27001',
      description: 'Certified in information security management standards.',
      color: 'text-gray-700',
      bgColor: 'bg-gray-50 hover:bg-gray-100',
    },
    SECURITY_CLEARANCE: {
      icon: <ShieldCheck className="h-4 w-4" />,
      label: 'Security Clearance',
      description: 'Holds active government security clearance.',
      color: 'text-red-700',
      bgColor: 'bg-red-50 hover:bg-red-100',
    },
  };

  const badgeConfig = config[badge.type];
  if (!badgeConfig) return null;

  return <SingleBadge {...badgeConfig} animated={animated} verified={true} />;
}

// ============================================================================
// Main Component
// ============================================================================

export function VerificationBadges({
  verificationLevel,
  isIdentityVerified,
  isPaymentVerified,
  isPhoneVerified,
  isEmailVerified: _isEmailVerified,
  badges,
  complianceBadges = [],
  showLearnMore = false,
  animated = false,
  className,
}: Readonly<VerificationBadgesProps>) {
  const hasAnyBadge =
    isIdentityVerified ||
    isPaymentVerified ||
    isPhoneVerified ||
    badges.length > 0 ||
    complianceBadges.length > 0;

  if (!hasAnyBadge) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Trust badges row */}
      <div className="flex flex-wrap gap-2">
        {/* Identity verification tier */}
        <IdentityVerificationBadge animated={animated} level={verificationLevel} />

        {/* Payment verified */}
        {isPaymentVerified && (
          <SingleBadge
            animated={animated}
            bgColor="bg-green-50 hover:bg-green-100"
            color="text-green-700"
            description="Payment method has been verified for secure transactions."
            icon={<CreditCard className="h-4 w-4" />}
            label="Payment Verified"
            verified={true}
          />
        )}

        {/* Phone verified */}
        {isPhoneVerified && (
          <SingleBadge
            animated={animated}
            bgColor="bg-gray-50 hover:bg-gray-100"
            color="text-gray-700"
            description="Phone number has been verified via SMS."
            icon={<Phone className="h-4 w-4" />}
            label="Phone Verified"
            verified={true}
          />
        )}
      </div>

      {/* Talent badges row */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge, _index) => (
            <TalentBadge key={badge.id} animated={animated} badge={badge} />
          ))}
        </div>
      )}

      {/* Compliance badges row */}
      {complianceBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {complianceBadges.map((badge) => (
            <ComplianceBadgeItem key={badge.id} animated={animated} badge={badge} />
          ))}
        </div>
      )}

      {/* Learn more link */}
      {showLearnMore && (
        <div className="pt-1">
          <Button asChild className="text-muted-foreground h-auto p-0" size="sm" variant="link">
            <Link className="inline-flex items-center gap-1" href="/help/verification">
              <HelpCircle className="h-3.5 w-3.5" />
              Learn about verification
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Inline Badge for Cards
// ============================================================================

export function InlineVerificationBadge({
  verificationLevel,
  size = 'sm',
}: Readonly<{
  verificationLevel: VerificationLevel;
  size?: 'xs' | 'sm' | 'md';
}>) {
  if (verificationLevel === 'NONE' || verificationLevel === 'EMAIL') return null;

  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
  };

  const config = {
    BASIC: { icon: Shield, color: 'text-blue-600' },
    ENHANCED: { icon: ShieldCheck, color: 'text-purple-600' },
    PREMIUM: { icon: ShieldPlus, color: 'text-emerald-600' },
  };

  const badgeConfig = config[verificationLevel];
  if (!badgeConfig) return null;

  const Icon = badgeConfig.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={cn(sizeClasses[size], badgeConfig.color)} />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            {verificationLevel === 'BASIC' && 'ID Verified'}
            {verificationLevel === 'ENHANCED' && 'Enhanced Verification'}
            {verificationLevel === 'PREMIUM' && 'Premium Verified'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
