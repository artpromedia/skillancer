'use client';

import {
  cn,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  BadgeCheck,
  Clock,
  CreditCard,
  HelpCircle,
  type Shield,
  ShieldCheck,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TrustFactor {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  status: 'verified' | 'partial' | 'unverified';
  icon: typeof Shield;
  description: string;
}

interface TrustBadge {
  id: string;
  name: string;
  icon: string;
  earnedAt: string;
}

interface TrustScoreDisplayProps {
  overallScore: number;
  factors: TrustFactor[];
  badges: TrustBadge[];
  averageScore?: number;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  if (score >= 30) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreGradient(score: number): string {
  if (score >= 90) return 'from-emerald-500 to-emerald-600';
  if (score >= 70) return 'from-green-500 to-green-600';
  if (score >= 50) return 'from-yellow-500 to-yellow-600';
  if (score >= 30) return 'from-orange-500 to-orange-600';
  return 'from-red-500 to-red-600';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Needs Work';
  return 'Low';
}

// ============================================================================
// Trust Score Ring
// ============================================================================

function TrustScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
}: Readonly<{
  score: number;
  size?: number;
  strokeWidth?: number;
}>) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" height={size} width={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          className="transition-all duration-1000"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="url(#trustGradient)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        <defs>
          <linearGradient id="trustGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor={score >= 50 ? '#10b981' : '#f59e0b'} />
            <stop offset="100%" stopColor={score >= 50 ? '#059669' : '#ea580c'} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold', getScoreColor(score))}>{score}</span>
        <span className="text-xs text-gray-500">Trust Score</span>
      </div>
    </div>
  );
}

// ============================================================================
// Trust Factor Row
// ============================================================================

function TrustFactorRow({ factor }: Readonly<{ factor: TrustFactor }>) {
  const Icon = factor.icon;
  const percentage = (factor.score / factor.maxScore) * 100;

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={cn(
          'rounded-lg p-2',
          factor.status === 'verified' && 'bg-green-100',
          factor.status === 'partial' && 'bg-yellow-100',
          factor.status === 'unverified' && 'bg-gray-100'
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4',
            factor.status === 'verified' && 'text-green-600',
            factor.status === 'partial' && 'text-yellow-600',
            factor.status === 'unverified' && 'text-gray-400'
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{factor.name}</span>
          <span className="text-xs text-gray-500">
            {factor.score}/{factor.maxScore}
          </span>
        </div>
        <Progress className="h-1.5" value={percentage} />
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1 text-gray-400 hover:text-gray-600">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{factor.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ============================================================================
// How It's Calculated
// ============================================================================

function HowCalculatedTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        How this is calculated
      </button>

      {isOpen && (
        <>
          <button
            aria-label="Close modal"
            className="fixed inset-0 z-10 cursor-default appearance-none border-none bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <h4 className="mb-2 font-semibold text-gray-900">Trust Score Calculation</h4>
            <ul className="space-y-2 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span>
                  <strong>Identity:</strong> Verified ID, linked accounts, profile completeness
                </span>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <span>
                  <strong>Skills:</strong> Assessments passed, credentials earned, endorsements
                  received
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                <span>
                  <strong>Payment:</strong> On-time payments, payment method verified
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <span>
                  <strong>Success:</strong> Job completion rate, client ratings, repeat clients
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
                <span>
                  <strong>Response:</strong> Average response time, availability consistency
                </span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TrustScoreDisplay({
  overallScore,
  factors,
  badges,
  averageScore,
  className,
}: Readonly<TrustScoreDisplayProps>) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-6', className)}>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Trust Score</h3>
        <HowCalculatedTooltip />
      </div>

      <div className="flex flex-col items-center gap-6 md:flex-row">
        {/* Score Ring */}
        <div className="flex flex-col items-center">
          <TrustScoreRing score={overallScore} />
          <span
            className={cn(
              'mt-2 rounded-full px-3 py-1 text-sm font-medium',
              overallScore >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            )}
          >
            {getScoreLabel(overallScore)}
          </span>

          {/* Comparison to average */}
          {averageScore && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <TrendingUp
                className={cn(
                  'h-3.5 w-3.5',
                  overallScore >= averageScore ? 'text-green-500' : 'text-red-500'
                )}
              />
              <span>
                {overallScore >= averageScore ? '+' : ''}
                {overallScore - averageScore} vs avg ({averageScore})
              </span>
            </div>
          )}
        </div>

        {/* Trust Factors */}
        <div className="w-full flex-1">
          <h4 className="mb-3 text-sm font-medium text-gray-700">Trust Factors</h4>
          <div className="space-y-1">
            {factors.map((factor) => (
              <TrustFactorRow key={factor.id} factor={factor} />
            ))}
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      {badges.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-6">
          <h4 className="mb-3 text-sm font-medium text-gray-700">Trust Badges Earned</h4>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <TooltipProvider key={badge.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-1.5">
                      <span className="text-lg">{badge.icon}</span>
                      <span className="text-sm font-medium text-amber-800">{badge.name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Earned {new Date(badge.earnedAt).toLocaleDateString()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Trust Score (for cards)
// ============================================================================

export function TrustScoreCompact({
  score,
  showLabel = true,
  className,
}: Readonly<{
  score: number;
  showLabel?: boolean;
  className?: string;
}>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1.5', className)}>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                getScoreGradient(score)
              )}
            >
              {score}
            </div>
            {showLabel && (
              <span className={cn('text-xs font-medium', getScoreColor(score))}>
                {getScoreLabel(score)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Trust Score: {score}/100</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TrustScoreDisplay;
