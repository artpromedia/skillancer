'use client';

import { cn } from '@skillancer/ui';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Clock,
  BarChart3,
  ChevronRight,
  HelpCircle,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface SkillHealthScoreProps {
  compact?: boolean;
}

interface ScoreBreakdown {
  name: string;
  score: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function SkillHealthScore({ compact = false }: Readonly<SkillHealthScoreProps>) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Mock data
  const overallScore = 73;
  const previousScore = 68;
  const scoreChange = overallScore - previousScore;
  const isImproving = scoreChange > 0;

  const breakdown: ScoreBreakdown[] = [
    {
      name: 'Skills Coverage',
      score: 78,
      description: 'How well your skills match market demand',
      icon: Target,
    },
    {
      name: 'Skill Recency',
      score: 65,
      description: 'How current your skills are',
      icon: Clock,
    },
    {
      name: 'Verification Level',
      score: 82,
      description: 'Percentage of verified skills',
      icon: Shield,
    },
    {
      name: 'Market Alignment',
      score: 67,
      description: 'Alignment with trending skills',
      icon: BarChart3,
    },
  ];

  const peerComparison = {
    percentile: 72,
    category: 'Full-Stack Developers',
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-amber-500';
    return 'from-red-500 to-orange-500';
  };

  // Calculate gauge rotation (0 = -90deg, 100 = 90deg)
  const gaugeRotation = (overallScore / 100) * 180 - 90;

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
        <div className="relative h-10 w-10">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="white"
              strokeDasharray={`${overallScore}, 100`}
              strokeWidth="3"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
            {overallScore}
          </span>
        </div>
        <div>
          <p className="text-xs text-white/80">Skill Health</p>
          <div className="flex items-center gap-1">
            {isImproving ? (
              <TrendingUp className="h-3 w-3 text-green-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            <span className={cn('text-xs', isImproving ? 'text-green-400' : 'text-red-400')}>
              {isImproving ? '+' : ''}
              {scoreChange}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Skill Health Score</h2>
            <button
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <HelpCircle className="h-4 w-4 text-gray-400" />
              {showTooltip && (
                <div className="absolute left-0 top-6 z-10 w-64 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg">
                  Your Skill Health Score measures how competitive your skill set is in the current
                  market. A higher score means more job opportunities and higher rates.
                </div>
              )}
            </button>
          </div>
          <div
            className={cn(
              'flex items-center gap-1',
              isImproving ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isImproving ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {isImproving ? '+' : ''}
              {scoreChange} pts
            </span>
          </div>
        </div>

        {/* Gauge */}
        <div className="mb-4 flex justify-center">
          <div className="relative h-24 w-40 overflow-hidden">
            {/* Background arc */}
            <div className="absolute inset-0 flex items-end justify-center">
              <div
                className="h-40 w-40 rounded-full border-8 border-gray-200"
                style={{
                  clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
                }}
              />
            </div>
            {/* Score arc */}
            <div className="absolute inset-0 flex items-end justify-center">
              <div
                className={cn(
                  'h-40 w-40 rounded-full border-8 bg-gradient-to-r',
                  getScoreGradient(overallScore)
                )}
                style={{
                  clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
                  transform: `rotate(${gaugeRotation - 90}deg)`,
                  transformOrigin: 'center center',
                  background: `conic-gradient(from -90deg, #4F46E5 ${overallScore}%, transparent ${overallScore}%)`,
                  maskImage: 'radial-gradient(transparent 60%, black 60%)',
                  WebkitMaskImage: 'radial-gradient(transparent 60%, black 60%)',
                }}
              />
            </div>
            {/* Score text */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
              <span className={cn('text-4xl font-bold', getScoreColor(overallScore))}>
                {overallScore}
              </span>
              <span className="text-lg text-gray-400">/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-5 pb-5">
        <div className="space-y-3">
          {breakdown.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.name} className="flex items-center gap-3">
                <ItemIcon className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <span className={cn('text-sm font-medium', getScoreColor(item.score))}>
                      {item.score}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r',
                        getScoreGradient(item.score)
                      )}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Peer Comparison */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>
              Top <span className="font-medium text-gray-900">{peerComparison.percentile}%</span>{' '}
              among {peerComparison.category}
            </span>
          </div>
        </div>

        {/* CTA */}
        <Link
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-white transition-colors hover:bg-indigo-700"
          href="/learn/gaps"
        >
          Improve Your Score
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default SkillHealthScore;
