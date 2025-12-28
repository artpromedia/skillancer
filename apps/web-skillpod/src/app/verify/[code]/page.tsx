'use client';

import { cn } from '@skillancer/ui';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  ExternalLink,
  AlertTriangle,
  Loader2,
  BadgeCheck,
  User,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

// Helper functions to reduce cognitive complexity
function getStatusStyles(isValidAndActive: boolean) {
  return {
    bannerClasses: isValidAndActive
      ? 'border border-green-200 bg-green-50'
      : 'border border-amber-200 bg-amber-50',
    iconBgClasses: isValidAndActive ? 'bg-green-100' : 'bg-amber-100',
    titleClasses: isValidAndActive ? 'text-green-900' : 'text-amber-900',
    textClasses: isValidAndActive ? 'text-green-700' : 'text-amber-700',
  };
}

function getStatusContent(isValidAndActive: boolean) {
  return {
    title: isValidAndActive ? 'Credential Verified' : 'Credential Expired',
    description: isValidAndActive
      ? 'This credential is valid and was issued by Skillancer.'
      : 'This credential was valid but has since expired.',
  };
}

interface StatusIconProps {
  readonly isValidAndActive: boolean;
}

function StatusIcon({ isValidAndActive }: StatusIconProps) {
  if (isValidAndActive) {
    return <CheckCircle2 className="h-8 w-8 text-green-600" />;
  }
  return <AlertTriangle className="h-8 w-8 text-amber-600" />;
}

function getExpiryDateStyles(isExpired: boolean) {
  return cn('font-medium', isExpired ? 'text-red-600' : 'text-gray-900');
}

function formatExpiryDate(expiryDate: string, isExpired: boolean) {
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return isExpired ? `${formattedDate} (Expired)` : formattedDate;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-indigo-600" />
        <h2 className="text-lg font-medium text-gray-900">Verifying Credential...</h2>
        <p className="mt-1 text-gray-500">Please wait while we validate this credential</p>
      </div>
    </div>
  );
}

interface ErrorScreenProps {
  readonly error: string | null;
}

function ErrorScreen({ error }: ErrorScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">Verification Failed</h2>
        <p className="mb-6 text-gray-600">{error}</p>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">Common Issues</p>
              <ul className="mt-1 list-inside list-disc text-sm text-amber-700">
                <li>The credential may have expired</li>
                <li>The verification code may be incorrect</li>
                <li>The credential may have been revoked</li>
              </ul>
            </div>
          </div>
        </div>

        <Link
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
          href="/"
        >
          Return to Skillancer
        </Link>
      </div>
    </div>
  );
}

// Mock verification data
const verificationData = {
  isValid: true,
  credential: {
    id: 'cred-1',
    name: 'Advanced React Developer',
    issueDate: '2024-01-15',
    expiryDate: '2027-01-15',
    status: 'active',
    score: 92,
    percentile: 95,
    skills: ['React', 'Redux', 'TypeScript', 'Testing', 'Performance', 'Hooks'],
    verificationCode: 'SKILL-RCT-2024-92847',
    badge: '🏆',
    category: 'Frontend',
    level: 'Advanced',
    issuer: {
      name: 'Skillancer Assessment Board',
      logo: null,
      verifiedAt: '2024-01-15T10:30:00Z',
    },
  },
  holder: {
    name: 'John Developer',
    username: 'johndev',
    profileUrl: '/freelancers/johndev',
  },
  verifiedAt: new Date().toISOString(),
};

export default function VerifyCredentialPage() {
  const params = useParams();
  const verificationCode = params.code as string;
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<typeof verificationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call
    const verifyCredential = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock: Check if code matches
      if (verificationCode === 'SKILL-RCT-2024-92847' || verificationCode.startsWith('SKILL-')) {
        setData(verificationData);
      } else {
        setError('Invalid verification code. This credential could not be verified.');
      }
      setIsLoading(false);
    };

    void verifyCredential();
  }, [verificationCode]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !data) {
    return <ErrorScreen error={error} />;
  }

  const credential = data.credential;
  const holder = data.holder;
  const isExpired = new Date(credential.expiryDate) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="font-bold text-gray-900">Skillancer Credential Verification</h1>
                <p className="text-sm text-gray-500">
                  Verify the authenticity of skill credentials
                </p>
              </div>
            </div>
            <Link className="text-sm font-medium text-indigo-600 hover:text-indigo-700" href="/">
              Visit Skillancer
              <ExternalLink className="ml-1 inline h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Verification Result */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Status Banner */}
        {(() => {
          const isValidAndActive = data.isValid && !isExpired;
          const styles = getStatusStyles(isValidAndActive);
          const content = getStatusContent(isValidAndActive);
          return (
            <div className={cn('mb-6 rounded-xl p-6', styles.bannerClasses)}>
              <div className="flex items-start gap-4">
                <div className={cn('rounded-full p-3', styles.iconBgClasses)}>
                  <StatusIcon isValidAndActive={isValidAndActive} />
                </div>
                <div>
                  <h2 className={cn('text-xl font-bold', styles.titleClasses)}>{content.title}</h2>
                  <p className={styles.textClasses}>{content.description}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    Verified at {new Date(data.verifiedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Credential Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <div className="mb-4 flex items-start justify-between">
              <span className="text-4xl">{credential.badge}</span>
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
                {credential.level}
              </span>
            </div>
            <h3 className="mb-1 text-2xl font-bold">{credential.name}</h3>
            <p className="text-white/80">{credential.category}</p>
          </div>

          {/* Holder Info */}
          <div className="border-b border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                <User className="h-6 w-6 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Credential Holder</p>
                <p className="font-semibold text-gray-900">{holder.name}</p>
                <Link
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                  href={holder.profileUrl}
                >
                  View Profile
                </Link>
              </div>
            </div>
          </div>

          {/* Score & Stats */}
          <div className="grid grid-cols-3 border-b border-gray-100">
            <div className="border-r border-gray-100 p-6 text-center">
              <p className="text-3xl font-bold text-gray-900">{credential.score}%</p>
              <p className="text-sm text-gray-500">Score</p>
            </div>
            <div className="border-r border-gray-100 p-6 text-center">
              <p className="text-3xl font-bold text-indigo-600">
                Top {100 - credential.percentile}%
              </p>
              <p className="text-sm text-gray-500">Percentile</p>
            </div>
            <div className="p-6 text-center">
              <p className="text-3xl font-bold text-gray-900">{credential.skills.length}</p>
              <p className="text-sm text-gray-500">Skills</p>
            </div>
          </div>

          {/* Skills */}
          <div className="border-b border-gray-100 p-6">
            <h4 className="mb-3 text-sm font-medium text-gray-500">Verified Skills</h4>
            <div className="flex flex-wrap gap-2">
              {credential.skills.map((skill) => (
                <span
                  key={skill}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-6 border-b border-gray-100 p-6">
            <div>
              <div className="mb-1 flex items-center gap-2 text-gray-500">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Issue Date</span>
              </div>
              <p className="font-medium text-gray-900">
                {new Date(credential.issueDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-gray-500">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Expiry Date</span>
              </div>
              <p className={getExpiryDateStyles(isExpired)}>
                {formatExpiryDate(credential.expiryDate, isExpired)}
              </p>
            </div>
          </div>

          {/* Issuer */}
          <div className="bg-gray-50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-white">
                <Building2 className="h-6 w-6 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Issued by</p>
                <p className="font-semibold text-gray-900">{credential.issuer.name}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 text-green-600">
                <BadgeCheck className="h-5 w-5" />
                <span className="text-sm font-medium">Verified Issuer</span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Code */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="mb-2 text-sm text-gray-500">Verification Code</p>
          <code className="font-mono text-lg font-bold text-gray-900">
            {credential.verificationCode}
          </code>
        </div>

        {/* Footer Note */}
        <p className="mt-8 text-center text-sm text-gray-500">
          This credential was independently verified through Skillancer&apos;s secure verification
          system. For questions about this credential, please{' '}
          <a className="text-indigo-600 hover:underline" href="mailto:support@skillancer.com">
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
