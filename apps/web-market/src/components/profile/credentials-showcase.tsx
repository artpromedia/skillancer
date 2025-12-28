'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  Award,
  BadgeCheck,
  Calendar,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Shield,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Credential {
  id: string;
  name: string;
  issuer: string;
  issuerLogo?: string;
  badge?: string;
  level: 'foundation' | 'associate' | 'professional' | 'expert';
  issuedAt: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'revoked';
  verificationUrl: string;
  verificationCode: string;
  skills: string[];
  source: 'skillpod' | 'external' | 'manual';
}

interface CredentialsShowcaseProps {
  credentials: Credential[];
  isOwnProfile?: boolean;
  maxFeatured?: number;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const levelConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  foundation: { label: 'Foundation', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  associate: { label: 'Associate', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  professional: { label: 'Professional', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  expert: { label: 'Expert', color: 'text-amber-600', bgColor: 'bg-amber-100' },
};

const _sourceConfig: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  skillpod: { label: 'SkillPod', color: 'text-emerald-600', icon: Shield },
  external: { label: 'External', color: 'text-blue-600', icon: Award },
  manual: { label: 'Self-Reported', color: 'text-gray-500', icon: Award },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function getStatusInfo(credential: Credential) {
  if (credential.status === 'expired') {
    return { label: 'Expired', color: 'text-red-600', icon: XCircle };
  }
  if (credential.status === 'revoked') {
    return { label: 'Revoked', color: 'text-red-600', icon: XCircle };
  }
  if (credential.expiresAt) {
    const daysUntilExpiry = Math.ceil(
      (new Date(credential.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry < 30) {
      return {
        label: `Expires in ${daysUntilExpiry} days`,
        color: 'text-orange-600',
        icon: Calendar,
      };
    }
  }
  return { label: 'Active', color: 'text-green-600', icon: CheckCircle };
}

// ============================================================================
// Credential Card
// ============================================================================

function CredentialCard({
  credential,
  size = 'default',
  onVerify,
}: Readonly<{
  credential: Credential;
  size?: 'small' | 'default';
  onVerify?: () => void;
}>) {
  const level = levelConfig[credential.level];
  const status = getStatusInfo(credential);
  const StatusIcon = status.icon;

  if (size === 'small') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white transition-transform hover:scale-105"
              onClick={onVerify}
            >
              {credential.badge ? (
                <span className="text-2xl">{credential.badge}</span>
              ) : (
                <Award className="h-6 w-6" />
              )}
              {credential.source === 'skillpod' && (
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{credential.name}</p>
            <p className="text-xs opacity-80">{credential.issuer}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <button
      className={cn(
        'group relative w-full cursor-pointer rounded-xl border bg-white p-4 text-left transition-all hover:shadow-lg',
        credential.status === 'active' ? 'border-gray-200' : 'border-red-200 bg-red-50/30'
      )}
      type="button"
      onClick={onVerify}
    >
      <div className="flex items-start gap-4">
        {/* Badge */}
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          {credential.badge ? (
            <span className="text-2xl">{credential.badge}</span>
          ) : (
            <Award className="h-6 w-6" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="truncate font-semibold text-gray-900 transition-colors group-hover:text-indigo-600">
                {credential.name}
              </h4>
              <p className="flex items-center gap-1 text-sm text-gray-500">
                {credential.issuer}
                {credential.source === 'skillpod' && (
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <div className="mt-2 flex items-center gap-2">
            {level && (
              <span className={cn('rounded-full px-2 py-0.5 text-xs', level.bgColor, level.color)}>
                {level.label}
              </span>
            )}
            <span className={cn('flex items-center gap-1 text-xs', status.color)}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
          </div>

          <p className="mt-2 text-xs text-gray-400">Issued {formatDate(credential.issuedAt)}</p>
        </div>
      </div>

      {/* Verification note */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
        Click to verify
      </div>
    </button>
  );
}

// ============================================================================
// Verification Modal
// ============================================================================

function VerificationModal({
  credential,
  isOpen,
  onClose,
}: Readonly<{
  credential: Credential;
  isOpen: boolean;
  onClose: () => void;
}>) {
  const status = getStatusInfo(credential);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Credential</DialogTitle>
        </DialogHeader>

        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            {credential.badge ? (
              <span className="text-4xl">{credential.badge}</span>
            ) : (
              <Award className="h-10 w-10" />
            )}
          </div>

          <h3 className="text-xl font-bold text-gray-900">{credential.name}</h3>
          <p className="text-gray-500">{credential.issuer}</p>

          <div
            className={cn(
              'mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm',
              status.color === 'text-green-600' ? 'bg-green-100' : 'bg-red-100'
            )}
          >
            <status.icon className="h-4 w-4" />
            {status.label}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 py-2">
            <span className="text-gray-500">Verification Code</span>
            <span className="font-mono font-medium">{credential.verificationCode}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-2">
            <span className="text-gray-500">Issue Date</span>
            <span>{formatDate(credential.issuedAt)}</span>
          </div>
          {credential.expiresAt && (
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Expiry Date</span>
              <span>{formatDate(credential.expiresAt)}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <Button className="flex-1" variant="outline" onClick={onClose}>
            Close
          </Button>
          <a
            className="flex-1"
            href={credential.verificationUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Button className="w-full">
              Verify Online
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CredentialsShowcase({
  credentials,
  isOwnProfile = false,
  maxFeatured = 3,
  className,
}: Readonly<CredentialsShowcaseProps>) {
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);

  const activeCredentials = credentials.filter((c) => c.status === 'active');
  const featuredCredentials = activeCredentials.slice(0, maxFeatured);
  const remainingCredentials = activeCredentials.slice(maxFeatured);

  if (credentials.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Credentials</h3>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-gray-500">
            <Award className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>No credentials yet</p>
            {isOwnProfile && (
              <Link href="/assessments">
                <Button className="mt-3" size="sm" variant="outline">
                  Earn Your First Credential
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn('', className)}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Credentials</h3>
            <p className="text-sm text-gray-500">
              {activeCredentials.length} verified credential
              {activeCredentials.length === 1 ? '' : 's'}
            </p>
          </div>
          {isOwnProfile && (
            <Link href="/credentials">
              <Button size="sm" variant="outline">
                Manage
              </Button>
            </Link>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Featured credentials */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredCredentials.map((credential) => (
              <CredentialCard
                key={credential.id}
                credential={credential}
                onVerify={() => setSelectedCredential(credential)}
              />
            ))}
          </div>

          {/* Badge grid for remaining */}
          {remainingCredentials.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="mb-3 text-sm text-gray-500">
                +{remainingCredentials.length} more credentials
              </p>
              <div className="flex flex-wrap gap-2">
                {remainingCredentials.map((credential) => (
                  <CredentialCard
                    key={credential.id}
                    credential={credential}
                    size="small"
                    onVerify={() => setSelectedCredential(credential)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* View all link */}
          {credentials.length > maxFeatured && (
            <Link
              className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
              href={isOwnProfile ? '/credentials' : '#'}
            >
              View all credentials
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Verification Modal */}
      {selectedCredential && (
        <VerificationModal
          credential={selectedCredential}
          isOpen={!!selectedCredential}
          onClose={() => setSelectedCredential(null)}
        />
      )}
    </>
  );
}

export default CredentialsShowcase;
