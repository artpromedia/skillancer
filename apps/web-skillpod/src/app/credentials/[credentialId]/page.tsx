'use client';

import { cn } from '@skillancer/ui';
import {
  Shield,
  Clock,
  CheckCircle2,
  ExternalLink,
  Download,
  Copy,
  Linkedin,
  Twitter,
  ArrowLeft,
  BadgeCheck,
  Star,
  Trophy,
  TrendingUp,
  Target,
  RotateCcw,
  QrCode,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

// Mock credential data
const credentialData = {
  id: 'cred-1',
  name: 'Advanced React Developer',
  issueDate: '2024-01-15',
  expiryDate: '2027-01-15',
  status: 'active',
  score: 92,
  percentile: 95,
  skills: ['React', 'Redux', 'TypeScript', 'Testing', 'Performance', 'Hooks'],
  verificationCode: 'SKILL-RCT-2024-92847',
  verificationUrl: 'https://skillancer.com/verify/SKILL-RCT-2024-92847',
  badge: '🏆',
  category: 'Frontend',
  level: 'Advanced',
  issuer: 'Skillancer Assessment Board',
  assessment: {
    id: 'assess-react-adv',
    name: 'Advanced React Developer Assessment',
    duration: 75,
    questionsCount: 45,
    passScore: 80,
  },
  holder: {
    name: 'John Developer',
    username: 'johndev',
    avatar: null,
  },
  strengths: ['React Hooks & Context API', 'Performance Optimization', 'Testing Best Practices'],
  areasToImprove: ['Advanced Redux Patterns', 'Server-Side Rendering'],
  metadata: {
    proctored: true,
    attempts: 1,
    timeTaken: 68,
  },
};

// Helper Functions
function getCredentialStatusText(isExpired: boolean, isExpiringSoon: boolean): string {
  if (isExpired) return 'Expired';
  if (isExpiringSoon) return 'Expiring Soon';
  return 'Verified Credential';
}

export default function CredentialDetailPage() {
  const params = useParams();
  const _credentialId = params.credentialId as string;
  const [copied, setCopied] = useState(false);

  const credential = credentialData;
  const daysUntilExpiry = Math.ceil(
    (new Date(credential.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpiringSoon = daysUntilExpiry < 90;
  const isExpired = daysUntilExpiry < 0;

  const copyVerificationLink = async () => {
    await navigator.clipboard.writeText(credential.verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const twitterText = `I earned the ${credential.name} credential on Skillancer! 🎉`;
  const emailSubject = `My ${credential.name} Credential`;
  const emailBody = `Check out my verified credential: ${credential.verificationUrl}`;

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(credential.verificationUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(credential.verificationUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            href="/credentials"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Credentials
          </Link>
        </div>
      </div>

      {/* Credential Card */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Main Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white" />
            <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white" />
          </div>

          <div className="relative z-10">
            {/* Status Badge */}
            <div className="mb-6 flex items-center justify-between">
              <span
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
                  (() => {
                    if (isExpired) return 'bg-red-500/20 text-red-200';
                    if (isExpiringSoon) return 'bg-amber-500/20 text-amber-200';
                    return 'bg-white/20 text-white';
                  })()
                )}
              >
                <BadgeCheck className="h-4 w-4" />
                {getCredentialStatusText(isExpired, isExpiringSoon)}
              </span>
              <span className="text-5xl">{credential.badge}</span>
            </div>

            {/* Credential Name */}
            <h1 className="mb-2 text-3xl font-bold">{credential.name}</h1>
            <p className="mb-6 text-white/80">
              {credential.category} • {credential.level}
            </p>

            {/* Stats Grid */}
            <div className="mb-6 grid grid-cols-4 gap-6">
              <div>
                <p className="text-3xl font-bold">{credential.score}%</p>
                <p className="text-sm text-white/70">Score</p>
              </div>
              <div>
                <p className="text-3xl font-bold">Top {100 - credential.percentile}%</p>
                <p className="text-sm text-white/70">Percentile</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{credential.skills.length}</p>
                <p className="text-sm text-white/70">Skills Verified</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{credential.metadata.timeTaken}m</p>
                <p className="text-sm text-white/70">Time Taken</p>
              </div>
            </div>

            {/* Holder Info */}
            <div className="flex items-center justify-between border-t border-white/20 pt-6">
              <div>
                <p className="text-sm text-white/70">Issued to</p>
                <p className="font-semibold">{credential.holder.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/70">Issue Date</p>
                <p className="font-semibold">
                  {new Date(credential.issueDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Verification & Actions */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Verification Code */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Verification Code</h3>
                <p className="text-sm text-gray-500">Share this code to verify your credential</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
              <code className="flex-1 font-mono text-gray-900">{credential.verificationCode}</code>
              <button
                className="rounded-lg p-2 transition-colors hover:bg-gray-200"
                onClick={() => void copyVerificationLink()}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>

            <Link
              className="mt-4 flex items-center justify-center gap-2 font-medium text-indigo-600 hover:text-indigo-700"
              href={`/verify/${credential.verificationCode}`}
            >
              <ExternalLink className="h-4 w-4" />
              View Public Verification Page
            </Link>
          </div>

          {/* Share & Download */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">Share Your Achievement</h3>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <a
                className="flex items-center justify-center gap-2 rounded-lg bg-[#0077b5] px-4 py-2 text-white hover:opacity-90"
                href={shareLinks.linkedin}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
              <a
                className="flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
                href={shareLinks.twitter}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </a>
            </div>

            <div className="flex gap-3">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Download PDF
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
                <QrCode className="h-4 w-4" />
                QR Code
              </button>
            </div>
          </div>
        </div>

        {/* Skill Breakdown */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-gray-900">Verified Skills</h3>
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

        {/* Strengths & Improvements */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Strengths</h3>
            </div>
            <ul className="space-y-2">
              {credential.strengths.map((strength) => (
                <li key={strength} className="flex items-start gap-2 text-gray-600">
                  <Star className="mt-0.5 h-4 w-4 text-green-500" />
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Areas to Improve</h3>
            </div>
            <ul className="space-y-2">
              {credential.areasToImprove.map((area) => (
                <li key={area} className="flex items-start gap-2 text-gray-600">
                  <Target className="mt-0.5 h-4 w-4 text-amber-500" />
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Assessment Details */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-gray-900">Assessment Details</h3>
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Assessment</p>
              <p className="font-medium text-gray-900">{credential.assessment.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Duration</p>
              <p className="font-medium text-gray-900">{credential.assessment.duration} minutes</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Questions</p>
              <p className="font-medium text-gray-900">
                {credential.assessment.questionsCount} questions
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pass Score</p>
              <p className="font-medium text-gray-900">{credential.assessment.passScore}%</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
            {credential.metadata.proctored && (
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-green-600" />
                Proctored Assessment
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Attempt #{credential.metadata.attempts}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Completed in {credential.metadata.timeTaken} minutes
            </span>
          </div>
        </div>

        {/* Validity */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Credential Validity</h3>
              <p className="text-sm text-gray-500">
                {isExpired
                  ? 'This credential has expired'
                  : `Valid until ${new Date(credential.expiryDate).toLocaleDateString()}`}
              </p>
            </div>
            {!isExpired && (
              <div className="text-right">
                <p
                  className={cn(
                    'text-2xl font-bold',
                    isExpiringSoon ? 'text-amber-600' : 'text-gray-900'
                  )}
                >
                  {daysUntilExpiry} days
                </p>
                <p className="text-sm text-gray-500">remaining</p>
              </div>
            )}
          </div>

          {(isExpired || isExpiringSoon) && (
            <Link
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              href={`/assessments/${credential.assessment.id}`}
            >
              <RotateCcw className="h-4 w-4" />
              {isExpired ? 'Retake Assessment' : 'Renew Credential'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
