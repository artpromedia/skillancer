'use client';

import { cn } from '@skillancer/ui';
import { Award, CheckCircle2 } from 'lucide-react';

interface CredentialBadgeProps {
  credential: {
    name: string;
    badge: string;
    level: string;
    category: string;
    score: number;
    percentile: number;
    issueDate: string;
    expiryDate?: string;
    status: 'active' | 'expiring-soon' | 'expired';
    verificationCode?: string;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'compact' | 'card' | 'inline';
  showScore?: boolean;
  showVerification?: boolean;
  onClick?: () => void;
}

export function CredentialBadge({
  credential,
  size = 'md',
  variant = 'default',
  showScore = true,
  showVerification = false,
  onClick,
}: Readonly<CredentialBadgeProps>) {
  const sizes = {
    sm: {
      container: 'w-16 h-16',
      emoji: 'text-2xl',
      ring: 'ring-2',
    },
    md: {
      container: 'w-24 h-24',
      emoji: 'text-4xl',
      ring: 'ring-3',
    },
    lg: {
      container: 'w-32 h-32',
      emoji: 'text-5xl',
      ring: 'ring-4',
    },
    xl: {
      container: 'w-40 h-40',
      emoji: 'text-6xl',
      ring: 'ring-4',
    },
  };

  const getLevelColor = () => {
    switch (credential.level.toLowerCase()) {
      case 'advanced':
      case 'expert':
        return 'from-purple-500 to-indigo-600';
      case 'professional':
        return 'from-blue-500 to-cyan-500';
      case 'intermediate':
        return 'from-green-500 to-emerald-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const getStatusRing = () => {
    switch (credential.status) {
      case 'active':
        return 'ring-green-400';
      case 'expiring-soon':
        return 'ring-amber-400';
      case 'expired':
        return 'ring-gray-300';
      default:
        return 'ring-gray-300';
    }
  };

  if (variant === 'compact') {
    return (
      <button
        className={cn(
          'flex items-center gap-2 rounded-full px-3 py-1.5 transition-all hover:scale-105',
          'bg-gradient-to-r',
          getLevelColor(),
          'text-white shadow-md'
        )}
        onClick={onClick}
      >
        <span className="text-lg">{credential.badge}</span>
        <span className="text-sm font-medium">{credential.name}</span>
      </button>
    );
  }

  if (variant === 'inline') {
    const badgeClassName = cn(
      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-sm font-medium',
      (() => {
        if (credential.status === 'active') return 'bg-green-100 text-green-800';
        if (credential.status === 'expiring-soon') return 'bg-amber-100 text-amber-800';
        return 'bg-gray-100 text-gray-600';
      })()
    );

    const badgeContent = (
      <>
        <span>{credential.badge}</span>
        <span>{credential.name}</span>
        {credential.status === 'active' && <CheckCircle2 className="h-3 w-3" />}
      </>
    );

    if (onClick) {
      return (
        <button
          type="button"
          className={cn(badgeClassName, 'cursor-pointer hover:opacity-80')}
          onClick={onClick}
        >
          {badgeContent}
        </button>
      );
    }

    return <span className={badgeClassName}>{badgeContent}</span>;
  }

  if (variant === 'card') {
    return (
      <button
        className={cn(
          'block w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:shadow-lg',
          credential.status === 'expired' && 'opacity-60'
        )}
        onClick={onClick}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner',
              getLevelColor()
            )}
          >
            <span className="text-2xl">{credential.badge}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-semibold text-gray-900">{credential.name}</h4>
            <p className="text-sm text-gray-500">
              {credential.category} • {credential.level}
            </p>
            {showScore && (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">{credential.score}%</span>
                <span className="text-xs text-gray-400">Top {100 - credential.percentile}%</span>
              </div>
            )}
          </div>
          <div>
            {credential.status === 'active' && (
              <span className="rounded-full bg-green-100 p-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </span>
            )}
            {credential.status === 'expiring-soon' && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Expiring
              </span>
            )}
            {credential.status === 'expired' && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                Expired
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Default circular badge
  return (
    <div className="flex flex-col items-center">
      <button
        className={cn(
          'relative flex items-center justify-center rounded-full bg-gradient-to-br shadow-lg transition-transform hover:scale-105',
          sizes[size].container,
          sizes[size].ring,
          getStatusRing(),
          getLevelColor()
        )}
        onClick={onClick}
      >
        <span className={sizes[size].emoji}>{credential.badge}</span>

        {/* Status indicator */}
        {credential.status === 'active' && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </span>
        )}
      </button>

      {/* Label */}
      <div className="mt-2 text-center">
        <p className="text-sm font-medium text-gray-900">{credential.name}</p>
        {showScore && (
          <p className="text-xs text-gray-500">
            {credential.score}% • {credential.level}
          </p>
        )}
        {showVerification && credential.verificationCode && (
          <p className="mt-1 font-mono text-xs text-gray-400">{credential.verificationCode}</p>
        )}
      </div>
    </div>
  );
}

// Collection display for profile
export function CredentialBadgeCollection({
  credentials,
  maxVisible = 5,
  size = 'sm',
  onViewAll,
}: Readonly<{
  credentials: CredentialBadgeProps['credential'][];
  maxVisible?: number;
  size?: 'sm' | 'md';
  onViewAll?: () => void;
}>) {
  const visibleCredentials = credentials.slice(0, maxVisible);
  const remainingCount = credentials.length - maxVisible;

  const badgeSize = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  const emojiSize = size === 'sm' ? 'text-lg' : 'text-xl';
  const overlap = size === 'sm' ? '-ml-2' : '-ml-3';

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        {visibleCredentials.map((cred, idx) => (
          <div
            key={cred.name}
            className={cn(
              'relative flex items-center justify-center rounded-full border-2 border-white bg-gradient-to-br shadow',
              badgeSize,
              idx > 0 && overlap,
              cred.status === 'active'
                ? 'from-indigo-500 to-purple-600'
                : 'from-gray-400 to-gray-500'
            )}
            style={{ zIndex: visibleCredentials.length - idx }}
            title={cred.name}
          >
            <span className={emojiSize}>{cred.badge}</span>
          </div>
        ))}

        {remainingCount > 0 && (
          <button
            className={cn(
              'relative flex items-center justify-center rounded-full border-2 border-white bg-gray-100 shadow transition-colors hover:bg-gray-200',
              badgeSize,
              overlap
            )}
            style={{ zIndex: 0 }}
            onClick={onViewAll}
          >
            <span className="text-xs font-bold text-gray-600">+{remainingCount}</span>
          </button>
        )}
      </div>

      {onViewAll && (
        <button
          className="ml-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          onClick={onViewAll}
        >
          View all
        </button>
      )}
    </div>
  );
}

// Badge for profile header
export function ProfileCredentialBadge({
  topCredential,
  totalCredentials,
  onClick,
}: Readonly<{
  topCredential?: CredentialBadgeProps['credential'];
  totalCredentials: number;
  onClick?: () => void;
}>) {
  if (!topCredential) {
    return (
      <button
        className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-200"
        onClick={onClick}
      >
        <Award className="h-4 w-4" />
        <span className="text-sm">No credentials yet</span>
      </button>
    );
  }

  return (
    <button
      className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1.5 transition-colors hover:border-indigo-200"
      onClick={onClick}
    >
      <span className="text-lg">{topCredential.badge}</span>
      <div className="text-left">
        <p className="text-sm font-medium text-gray-900">{topCredential.name}</p>
        <p className="text-xs text-gray-500">{totalCredentials} credentials</p>
      </div>
      <CheckCircle2 className="ml-1 h-4 w-4 text-green-600" />
    </button>
  );
}

export default CredentialBadge;
