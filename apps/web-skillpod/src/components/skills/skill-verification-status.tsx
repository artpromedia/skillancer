'use client';

import { cn } from '@skillancer/ui';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Shield,
  Award,
  ChevronRight,
} from 'lucide-react';

type VerificationStatus = 'verified' | 'pending' | 'expired' | 'unverified' | 'failed';

interface SkillVerificationStatusProps {
  skill: string;
  status: VerificationStatus;
  verifiedAt?: string;
  expiresAt?: string;
  credentialId?: string;
  onVerify?: () => void;
  onViewCredential?: () => void;
  showDetails?: boolean;
  className?: string;
}

const statusConfig: Record<
  VerificationStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: typeof CheckCircle2;
    description: string;
  }
> = {
  verified: {
    label: 'Verified',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
    description: 'Skill verified through assessment',
  },
  pending: {
    label: 'Pending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: Clock,
    description: 'Verification in progress',
  },
  expired: {
    label: 'Expired',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: AlertCircle,
    description: 'Credential has expired',
  },
  unverified: {
    label: 'Unverified',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    icon: Shield,
    description: 'Not yet verified',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
    description: 'Verification unsuccessful',
  },
};

export function SkillVerificationStatus({
  skill,
  status,
  verifiedAt,
  expiresAt,
  credentialId,
  onVerify,
  onViewCredential,
  showDetails = false,
  className,
}: Readonly<SkillVerificationStatusProps>) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Calculate days until expiry
  const daysUntilExpiry = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={cn('', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-full p-2', config.bgColor)}>
            <StatusIcon className={cn('h-4 w-4', config.color)} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{skill}</p>
            <div className="flex items-center gap-2">
              <span className={cn('text-sm', config.color)}>{config.label}</span>
              {showDetails && verifiedAt && status === 'verified' && (
                <span className="text-xs text-gray-400">
                  • {new Date(verifiedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'unverified' && onVerify && (
            <button
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              onClick={onVerify}
            >
              Verify Now
            </button>
          )}
          {(status === 'verified' || status === 'expired') && credentialId && onViewCredential && (
            <button
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
              onClick={onViewCredential}
            >
              View <ChevronRight className="h-3 w-3" />
            </button>
          )}
          {status === 'expired' && onVerify && (
            <button
              className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700 hover:bg-orange-200"
              onClick={onVerify}
            >
              Renew
            </button>
          )}
        </div>
      </div>

      {/* Expiry Warning */}
      {status === 'verified' && daysUntilExpiry !== null && daysUntilExpiry < 30 && (
        <div className="mt-2 flex items-center gap-2 rounded bg-orange-50 px-3 py-1.5 text-xs text-orange-600">
          <AlertCircle className="h-3 w-3" />
          Expires in {daysUntilExpiry} days
        </div>
      )}
    </div>
  );
}

// Compact inline badge
export function VerificationBadge({
  status,
  size = 'sm',
  showLabel = true,
  className,
}: Readonly<{
  status: VerificationStatus;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}>) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const sizes = {
    xs: { icon: 'w-3 h-3', text: 'text-xs', padding: 'px-1.5 py-0.5' },
    sm: { icon: 'w-3.5 h-3.5', text: 'text-xs', padding: 'px-2 py-1' },
    md: { icon: 'w-4 h-4', text: 'text-sm', padding: 'px-3 py-1.5' },
  };

  if (!showLabel) {
    return (
      <div className={cn('rounded-full p-1', config.bgColor, className)}>
        <StatusIcon className={cn(sizes[size].icon, config.color)} />
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.bgColor,
        config.color,
        sizes[size].padding,
        sizes[size].text,
        className
      )}
    >
      <StatusIcon className={sizes[size].icon} />
      {config.label}
    </span>
  );
}

// Skill list with verification status
export function SkillVerificationList({
  skills,
  onVerify,
  onViewCredential,
  className,
}: Readonly<{
  skills: Array<{
    name: string;
    status: VerificationStatus;
    verifiedAt?: string;
    expiresAt?: string;
    credentialId?: string;
  }>;
  onVerify?: (skillName: string) => void;
  onViewCredential?: (credentialId: string) => void;
  className?: string;
}>) {
  const verifiedCount = skills.filter((s) => s.status === 'verified').length;
  const expiredCount = skills.filter((s) => s.status === 'expired').length;
  const pendingCount = skills.filter((s) => s.status === 'pending').length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-green-100 p-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <span className="text-sm">
            <span className="font-medium">{verifiedCount}</span> verified
          </span>
        </div>
        {expiredCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-orange-100 p-1.5">
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </div>
            <span className="text-sm">
              <span className="font-medium">{expiredCount}</span> expired
            </span>
          </div>
        )}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-yellow-100 p-1.5">
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
            <span className="text-sm">
              <span className="font-medium">{pendingCount}</span> pending
            </span>
          </div>
        )}
      </div>

      {/* Skill List */}
      <div className="divide-y divide-gray-100">
        {skills.map((skill) => (
          <div key={skill.name} className="py-3">
            <SkillVerificationStatus
              showDetails
              credentialId={skill.credentialId}
              expiresAt={skill.expiresAt}
              skill={skill.name}
              status={skill.status}
              verifiedAt={skill.verifiedAt}
              onVerify={onVerify ? () => onVerify(skill.name) : undefined}
              onViewCredential={
                onViewCredential && skill.credentialId
                  ? () => onViewCredential(skill.credentialId!)
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Verified skills showcase
export function VerifiedSkillsShowcase({
  skills,
  maxDisplay = 5,
  onViewAll,
  className,
}: Readonly<{
  skills: Array<{ name: string; score?: number }>;
  maxDisplay?: number;
  onViewAll?: () => void;
  className?: string;
}>) {
  const displayedSkills = skills.slice(0, maxDisplay);
  const remaining = skills.length - maxDisplay;

  return (
    <div className={cn('', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Award className="h-5 w-5 text-indigo-600" />
        <h4 className="font-medium text-gray-900">Verified Skills</h4>
        <span className="text-sm text-gray-500">({skills.length})</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayedSkills.map((skill) => (
          <span
            key={skill.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-800"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {skill.name}
            {skill.score && <span className="text-xs text-green-600">({skill.score}%)</span>}
          </span>
        ))}
        {remaining > 0 && onViewAll && (
          <button
            className="rounded-full px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
            onClick={onViewAll}
          >
            +{remaining} more
          </button>
        )}
      </div>
    </div>
  );
}

export default SkillVerificationStatus;
