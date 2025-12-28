'use client';

import { cn } from '@skillancer/ui';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  Briefcase,
  Users,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface WhyRecommendedProps {
  reasons: string[];
  matchScore: number;
  skillAlignment: string[];
  careerRelevance: string;
  marketDemand: string;
  peerActivity?: string;
  variant?: 'inline' | 'modal' | 'tooltip';
  onClose?: () => void;
}

export function WhyRecommended({
  reasons,
  matchScore,
  skillAlignment,
  careerRelevance,
  marketDemand,
  peerActivity,
  variant = 'inline',
  onClose,
}: Readonly<WhyRecommendedProps>) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 80) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const content = (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-100 p-1.5">
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <h4 className="font-medium text-gray-900">Why This Recommendation?</h4>
        </div>
        {variant === 'modal' && onClose && (
          <button className="rounded p-1 hover:bg-gray-100" onClick={onClose}>
            <X className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Match Score */}
      <div
        className={cn(
          'mb-4 flex items-center justify-between rounded-lg p-3',
          getScoreColor(matchScore)
        )}
      >
        <span className="text-sm font-medium">Match Score</span>
        <span className="text-lg font-bold">{matchScore}%</span>
      </div>

      {/* Key Reasons */}
      <div className="mb-4 space-y-3">
        {/* Skill Alignment */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-blue-50 p-1.5">
            <Target className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Skills Alignment</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {skillAlignment.map((skill) => (
                <span key={skill} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Career Relevance */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-purple-50 p-1.5">
            <Briefcase className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Career Relevance</p>
            <p className="text-sm text-gray-500">{careerRelevance}</p>
          </div>
        </div>

        {/* Market Demand */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-green-50 p-1.5">
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Market Demand</p>
            <p className="text-sm text-gray-500">{marketDemand}</p>
          </div>
        </div>

        {/* Peer Activity */}
        {peerActivity && (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-amber-50 p-1.5">
              <Users className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Peer Activity</p>
              <p className="text-sm text-gray-500">{peerActivity}</p>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Reasons */}
      {reasons.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Additional Insights</p>
          <ul className="space-y-1">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1 text-indigo-400">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  if (variant === 'inline') {
    return (
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        {content}
      </div>
    );
  }

  if (variant === 'tooltip') {
    return (
      <div className="relative">
        <button
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <HelpCircle className="h-4 w-4" />
          Why this?
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {isExpanded && (
          <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            {content}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5">
          {content}
        </div>
      </div>
    );
  }

  return null;
}

export default WhyRecommended;
