'use client';

/**
 * Platform Connection Flow
 * OAuth-based platform connection wizard
 * Sprint M4: Portable Verified Work History
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

// Platform configurations
const platformConfigs: Record<
  string,
  {
    name: string;
    icon: string;
    color: string;
    description: string;
    permissions: string[];
    privacyNote: string;
  }
> = {
  upwork: {
    name: 'Upwork',
    icon: '💼',
    color: 'bg-green-500',
    description:
      'Connect your Upwork account to import verified work history, earnings, and client reviews.',
    permissions: [
      'Read your profile information',
      'Access your job history',
      'View your earnings data',
      'Import client reviews',
    ],
    privacyNote:
      'We only read your data. We cannot modify your Upwork account or accept jobs on your behalf.',
  },
  fiverr: {
    name: 'Fiverr',
    icon: '🎨',
    color: 'bg-green-400',
    description:
      'Import your Fiverr gigs, orders, and seller reviews to build your verified portfolio.',
    permissions: [
      'Read your seller profile',
      'Access completed orders',
      'View earnings history',
      'Import buyer reviews',
    ],
    privacyNote:
      'Client names are anonymized for privacy. Only order amounts and reviews are imported.',
  },
  freelancer: {
    name: 'Freelancer.com',
    icon: '🌐',
    color: 'bg-blue-500',
    description:
      'Sync your Freelancer.com projects, bids, and reputation to your Skillancer profile.',
    permissions: [
      'Read your profile and portfolio',
      'Access awarded projects',
      'View payment history',
      'Import client feedback',
    ],
    privacyNote:
      'Your bid amounts and project details remain confidential unless you choose to display them.',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '👔',
    color: 'bg-blue-600',
    description: 'Coming soon: Import your LinkedIn work experience and recommendations.',
    permissions: ['Read your profile', 'Access work experience', 'View recommendations'],
    privacyNote: 'LinkedIn integration is coming soon.',
  },
};

type ConnectionStep = 'info' | 'authorize' | 'syncing' | 'success' | 'error';

export default function ConnectPlatformPage() {
  const router = useRouter();
  const params = useParams();
  const platformId = params.platformId as string;
  const platform = platformConfigs[platformId];

  const [step, setStep] = useState<ConnectionStep>('info');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importedData, setImportedData] = useState({
    projects: 0,
    reviews: 0,
    earnings: 0,
  });

  useEffect(() => {
    if (step === 'syncing') {
      simulateSync();
    }
  }, [step]);

  const simulateSync = async () => {
    const stages = [
      { progress: 10, status: 'Connecting to platform...' },
      { progress: 25, status: 'Fetching profile data...' },
      { progress: 40, status: 'Importing work history...' },
      { progress: 60, status: 'Syncing reviews...' },
      { progress: 75, status: 'Verifying earnings...' },
      { progress: 90, status: 'Generating verification hashes...' },
      { progress: 100, status: 'Complete!' },
    ];

    for (const stage of stages) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSyncProgress(stage.progress);
      setSyncStatus(stage.status);
    }

    setImportedData({
      projects: Math.floor(Math.random() * 30) + 10,
      reviews: Math.floor(Math.random() * 50) + 20,
      earnings: Math.floor(Math.random() * 50000) + 10000,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    setStep('success');
  };

  const handleAuthorize = () => {
    // In production, this would redirect to OAuth
    setStep('syncing');
  };

  if (!platform) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">Platform not found</h2>
          <button
            onClick={() => router.push('/dashboard/work-history')}
            className="mt-4 text-indigo-600 hover:text-indigo-700"
          >
            Return to Work History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Platform Header */}
        <div className="mb-8 text-center">
          <div
            className={`h-20 w-20 ${platform.color} mx-auto mb-4 flex items-center justify-center rounded-2xl text-4xl shadow-lg`}
          >
            {platform.icon}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Connect {platform.name}</h1>
          <p className="mx-auto mt-2 max-w-md text-gray-600">{platform.description}</p>
        </div>

        {/* Step Content */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {step === 'info' && (
            <div className="p-8">
              {/* Security Badge */}
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 p-4">
                <Lock className="h-6 w-6 text-green-600" />
                <div>
                  <div className="font-medium text-green-900">Secure OAuth Connection</div>
                  <div className="text-sm text-green-700">
                    We use industry-standard OAuth 2.0 to securely connect to your account.
                  </div>
                </div>
              </div>

              {/* Permissions List */}
              <div className="mb-6">
                <h3 className="mb-3 font-semibold text-gray-900">What we'll access:</h3>
                <ul className="space-y-3">
                  {platform.permissions.map((permission, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-600">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
                      {permission}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Privacy Note */}
              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">Privacy Note: </span>
                    {platform.privacyNote}
                  </div>
                </div>
              </div>

              {/* What we do with data */}
              <div className="mb-8">
                <h3 className="mb-3 font-semibold text-gray-900">How we use your data:</h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      ✓
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Verify Your Work</div>
                      <div className="text-sm text-gray-600">
                        Cryptographically seal your work history to prove authenticity
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      📊
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Build Your Reputation</div>
                      <div className="text-sm text-gray-600">
                        Aggregate ratings across platforms into one trusted score
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      🔐
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Export Anywhere</div>
                      <div className="text-sm text-gray-600">
                        Share verified credentials on LinkedIn, portfolios, and more
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAuthorize}
                disabled={platformId === 'linkedin'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ExternalLink className="h-5 w-5" />
                Connect with {platform.name}
              </button>

              <p className="mt-4 text-center text-sm text-gray-500">
                You'll be redirected to {platform.name} to authorize access
              </p>
            </div>
          )}

          {step === 'syncing' && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Syncing Your Data</h2>
              <p className="mb-8 text-gray-600">{syncStatus}</p>

              {/* Progress Bar */}
              <div className="mb-4 h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{syncProgress}% complete</p>
            </div>
          )}

          {step === 'success' && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Successfully Connected!</h2>
              <p className="mb-8 text-gray-600">
                Your {platform.name} data has been imported and verified.
              </p>

              {/* Import Summary */}
              <div className="mb-8 grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-2xl font-bold text-gray-900">{importedData.projects}</div>
                  <div className="text-sm text-gray-600">Projects</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-2xl font-bold text-gray-900">{importedData.reviews}</div>
                  <div className="text-sm text-gray-600">Reviews</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-2xl font-bold text-green-600">
                    ${importedData.earnings.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Verified</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/dashboard/work-history')}
                  className="flex-1 rounded-xl border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  View Work History
                </button>
                <button
                  onClick={() => router.push('/dashboard/credentials')}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
                >
                  Generate Credentials
                </button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Connection Failed</h2>
              <p className="mb-8 text-gray-600">
                {error || 'Something went wrong while connecting to the platform.'}
              </p>

              <button
                onClick={() => setStep('info')}
                className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
