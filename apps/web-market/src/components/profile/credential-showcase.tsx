'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@skillancer/ui';
import {
  Award,
  BadgeCheck,
  Calendar,
  CheckCircle,
  ExternalLink,
  GraduationCap,
  Shield,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import type { FreelancerCredential } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface CredentialShowcaseProps {
  credentials: FreelancerCredential[];
  isOwnProfile?: boolean;
  maxItems?: number;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getSourceConfig(source: FreelancerCredential['source']) {
  const config = {
    SKILLPOD: {
      label: 'SkillPod',
      icon: Shield,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    EXTERNAL: {
      label: 'External',
      icon: Award,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    MANUAL: {
      label: 'Self-Reported',
      icon: GraduationCap,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
  };
  return config[source] || config.MANUAL;
}

function getStatusConfig(status: FreelancerCredential['status']) {
  const config = {
    ACTIVE: { label: 'Active', color: 'text-emerald-600', icon: CheckCircle },
    EXPIRED: { label: 'Expired', color: 'text-red-600', icon: XCircle },
    REVOKED: { label: 'Revoked', color: 'text-red-600', icon: XCircle },
    PENDING_RENEWAL: { label: 'Pending Renewal', color: 'text-yellow-600', icon: Calendar },
  };
  return config[status] || config.ACTIVE;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================================
// Credential Card
// ============================================================================

interface CredentialCardProps {
  credential: FreelancerCredential;
  onClick: () => void;
}

function CredentialCard({ credential, onClick }: CredentialCardProps) {
  const sourceConfig = getSourceConfig(credential.source);
  const statusConfig = getStatusConfig(credential.status);
  const SourceIcon = sourceConfig.icon;

  return (
    <button
      className="bg-card hover:border-primary/30 focus:ring-primary group relative flex w-full flex-col items-center rounded-lg border p-4 text-center transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
      onClick={onClick}
    >
      {/* Badge image or icon */}
      <div className="relative mb-3 h-16 w-16">
        {credential.badgeUrl ? (
          <Image fill alt={credential.title} className="object-contain" src={credential.badgeUrl} />
        ) : (
          <div
            className={cn(
              'flex h-full w-full items-center justify-center rounded-full',
              sourceConfig.bgColor
            )}
          >
            <SourceIcon className={cn('h-8 w-8', sourceConfig.color)} />
          </div>
        )}

        {/* Verification badge */}
        {credential.isVerified && (
          <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 p-0.5">
            <BadgeCheck className="h-4 w-4 text-white" />
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="line-clamp-2 text-sm font-medium">{credential.title}</h4>

      {/* Issuer */}
      <p className="text-muted-foreground mt-0.5 text-xs">{credential.issuer}</p>

      {/* Status badge */}
      {credential.status !== 'ACTIVE' && (
        <Badge className={cn('mt-2 text-xs', statusConfig.color)} variant="outline">
          {statusConfig.label}
        </Badge>
      )}

      {/* Source badge */}
      <Badge
        className={cn('mt-2 text-xs', sourceConfig.bgColor, sourceConfig.color)}
        variant="secondary"
      >
        <SourceIcon className="mr-1 h-3 w-3" />
        {sourceConfig.label}
      </Badge>
    </button>
  );
}

// ============================================================================
// Credential Detail Dialog
// ============================================================================

interface CredentialDetailDialogProps {
  credential: FreelancerCredential | null;
  onClose: () => void;
}

function CredentialDetailDialog({ credential, onClose }: CredentialDetailDialogProps) {
  if (!credential) return null;

  const sourceConfig = getSourceConfig(credential.source);
  const statusConfig = getStatusConfig(credential.status);
  const SourceIcon = sourceConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={!!credential} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Credential Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Badge image */}
          <div className="flex justify-center">
            <div className="relative h-24 w-24">
              {credential.badgeUrl ? (
                <Image
                  fill
                  alt={credential.title}
                  className="object-contain"
                  src={credential.badgeUrl}
                />
              ) : (
                <div
                  className={cn(
                    'flex h-full w-full items-center justify-center rounded-full',
                    sourceConfig.bgColor
                  )}
                >
                  <SourceIcon className={cn('h-12 w-12', sourceConfig.color)} />
                </div>
              )}
            </div>
          </div>

          {/* Title and issuer */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">{credential.title}</h3>
            <p className="text-muted-foreground">{credential.issuer}</p>
          </div>

          {/* Details */}
          <div className="bg-muted/50 space-y-3 rounded-lg p-4">
            {/* Issue date */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Issued</span>
              <span className="font-medium">{formatDate(credential.issueDate)}</span>
            </div>

            {/* Expiration date */}
            {credential.expirationDate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expires</span>
                <span className="font-medium">{formatDate(credential.expirationDate)}</span>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className={cn('flex items-center gap-1 font-medium', statusConfig.color)}>
                <StatusIcon className="h-4 w-4" />
                {statusConfig.label}
              </span>
            </div>

            {/* Source */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Source</span>
              <span className={cn('flex items-center gap-1 font-medium', sourceConfig.color)}>
                <SourceIcon className="h-4 w-4" />
                {sourceConfig.label}
              </span>
            </div>

            {/* Score */}
            {credential.score !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Score</span>
                <span className="font-medium">
                  {credential.score}%
                  {credential.percentile && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      (Top {100 - credential.percentile}%)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Associated skills */}
          {credential.associatedSkills.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Associated Skills</p>
              <div className="flex flex-wrap gap-1">
                {credential.associatedSkills.map((skill) => (
                  <Badge key={skill} className="text-xs" variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Verification link */}
          {credential.verificationUrl && credential.isVerified && (
            <Button asChild className="w-full" variant="outline">
              <a href={credential.verificationUrl} rel="noopener noreferrer" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                Verify this Credential
              </a>
            </Button>
          )}

          {/* Verification code */}
          {credential.verificationCode && (
            <div className="rounded-lg border p-3 text-center">
              <p className="text-muted-foreground text-xs">Verification Code</p>
              <p className="mt-1 font-mono text-sm font-medium">{credential.verificationCode}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CredentialShowcase({
  credentials,
  isOwnProfile = false,
  maxItems = 6,
  className,
}: CredentialShowcaseProps) {
  const [selectedCredential, setSelectedCredential] = useState<FreelancerCredential | null>(null);

  // Filter active credentials first, then sort by issue date
  const sortedCredentials = [...credentials].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
  });

  const visibleCredentials = sortedCredentials.slice(0, maxItems);
  const hasMore = credentials.length > maxItems;

  // Stats
  const verifiedCount = credentials.filter((c) => c.isVerified).length;
  const skillPodCount = credentials.filter((c) => c.source === 'SKILLPOD').length;

  if (credentials.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <h2 className="text-xl font-semibold">Credentials & Certifications</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <Award className="text-muted-foreground/30 h-12 w-12" />
            <p className="text-muted-foreground mt-4">No credentials yet</p>
            {isOwnProfile && (
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link href="/dashboard/verification">Add Credentials</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <h2 className="text-xl font-semibold">Credentials & Certifications</h2>
          <p className="text-muted-foreground text-sm">
            {credentials.length} credential{credentials.length !== 1 && 's'}
            {verifiedCount > 0 && ` • ${verifiedCount} verified`}
            {skillPodCount > 0 && ` • ${skillPodCount} from SkillPod`}
          </p>
        </div>
        {isOwnProfile && (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/verification">Manage</Link>
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {/* Credentials grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleCredentials.map((credential) => (
            <CredentialCard
              key={credential.id}
              credential={credential}
              onClick={() => setSelectedCredential(credential)}
            />
          ))}
        </div>

        {/* View more */}
        {hasMore && (
          <div className="mt-4 text-center">
            <Button asChild size="sm" variant="ghost">
              <Link href="/credentials">View All ({credentials.length})</Link>
            </Button>
          </div>
        )}

        {/* SkillPod CTA for own profile */}
        {isOwnProfile && skillPodCount === 0 && (
          <div className="bg-primary/5 mt-4 flex items-center justify-between rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-full p-2">
                <Shield className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Earn verified credentials</p>
                <p className="text-muted-foreground text-sm">Complete assessments on SkillPod</p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/skillpod">
                Get Started
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>

      {/* Detail dialog */}
      <CredentialDetailDialog
        credential={selectedCredential}
        onClose={() => setSelectedCredential(null)}
      />
    </Card>
  );
}
