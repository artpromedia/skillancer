'use client';

import { cn } from '@skillancer/ui';
import { TrendingUp, DollarSign, Clock, ChevronRight, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface SkillGap {
  id: string;
  skillName: string;
  category: string;
  currentLevel: 'None' | 'Beginner' | 'Intermediate';
  requiredLevel: 'Intermediate' | 'Advanced' | 'Expert';
  severity: 'critical' | 'high' | 'medium' | 'low';
  demandTrend: 'up' | 'down' | 'stable';
  impact: {
    missedJobs: number;
    potentialRateIncrease: string;
    opportunityScore: number;
  };
  timeToAcquire: string;
  learningPath?: {
    id: string;
    name: string;
    duration: string;
  };
  relatedJobs: string[];
}

interface GapImpactChartProps {
  gaps: SkillGap[];
}

export function GapImpactChart({ gaps }: Readonly<GapImpactChartProps>) {
  const [selectedGap, setSelectedGap] = useState<SkillGap | null>(null);
  const [viewMode, setViewMode] = useState<'opportunity' | 'earnings' | 'time'>('opportunity');

  // Calculate max values for scaling
  const maxOpportunity = Math.max(...gaps.map((g) => g.impact.opportunityScore));
  const _maxJobs = Math.max(...gaps.map((g) => g.impact.missedJobs));

  const _getSeverityColor = (severity: SkillGap['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
    }
  };

  const getSeverityGradient = (severity: SkillGap['severity']) => {
    switch (severity) {
      case 'critical':
        return 'from-red-500 to-red-600';
      case 'high':
        return 'from-orange-400 to-orange-500';
      case 'medium':
        return 'from-yellow-400 to-yellow-500';
      case 'low':
        return 'from-blue-400 to-blue-500';
    }
  };

  const parseTimeToMonths = (time: string): number => {
    if (time.includes('week')) {
      return Number.parseFloat(time) / 4;
    }
    if (time.includes('month')) {
      return Number.parseFloat(time);
    }
    return 1;
  };

  const sortedGaps = [...gaps].sort((a, b) => {
    if (viewMode === 'opportunity') {
      return b.impact.opportunityScore - a.impact.opportunityScore;
    }
    if (viewMode === 'earnings') {
      const aRate = Number.parseInt(a.impact.potentialRateIncrease.replaceAll(/\D/g, ''), 10);
      const bRate = Number.parseInt(b.impact.potentialRateIncrease.replaceAll(/\D/g, ''), 10);
      return bRate - aRate;
    }
    // Time - shortest first
    return parseTimeToMonths(a.timeToAcquire) - parseTimeToMonths(b.timeToAcquire);
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Skill Gap Impact Analysis</h3>
          <p className="text-sm text-gray-500">
            Visualize the career impact of closing each skill gap
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
          <button
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
              viewMode === 'opportunity' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
            )}
            onClick={() => setViewMode('opportunity')}
          >
            <TrendingUp className="h-4 w-4" />
            Opportunity
          </button>
          <button
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
              viewMode === 'earnings' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
            )}
            onClick={() => setViewMode('earnings')}
          >
            <DollarSign className="h-4 w-4" />
            Earnings
          </button>
          <button
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
              viewMode === 'time' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
            )}
            onClick={() => setViewMode('time')}
          >
            <Clock className="h-4 w-4" />
            Quick Wins
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-3">
        {sortedGaps.map((gap) => {
          const opportunityWidth = (gap.impact.opportunityScore / maxOpportunity) * 100;
          const rateValue = Number.parseInt(
            gap.impact.potentialRateIncrease.replaceAll(/\D/g, ''),
            10
          );
          const maxRate = Math.max(
            ...gaps.map((g) =>
              Number.parseInt(g.impact.potentialRateIncrease.replaceAll(/\D/g, ''), 10)
            )
          );
          const earningsWidth = (rateValue / maxRate) * 100;
          const maxTime = Math.max(...gaps.map((g) => parseTimeToMonths(g.timeToAcquire)));
          const timeWidth =
            ((maxTime - parseTimeToMonths(gap.timeToAcquire) + 0.5) / maxTime) * 100;

          let barWidth = opportunityWidth;
          if (viewMode === 'earnings') barWidth = earningsWidth;
          if (viewMode === 'time') barWidth = timeWidth;

          return (
            <div
              key={gap.id}
              className={cn(
                'group cursor-pointer transition-all',
                selectedGap?.id === gap.id && 'rounded-lg ring-2 ring-indigo-500'
              )}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedGap(selectedGap?.id === gap.id ? null : gap)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedGap(selectedGap?.id === gap.id ? null : gap);
                }
              }}
            >
              <div className="flex items-center gap-4">
                {/* Skill Name */}
                <div className="w-32 flex-shrink-0">
                  <p className="truncate text-sm font-medium text-gray-900">{gap.skillName}</p>
                  <p className="text-xs text-gray-500">{gap.category}</p>
                </div>

                {/* Bar */}
                <div className="relative flex-1">
                  <div className="h-8 overflow-hidden rounded-lg bg-gray-100">
                    <div
                      className={cn(
                        'h-full rounded-lg bg-gradient-to-r transition-all duration-500',
                        getSeverityGradient(gap.severity)
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  {/* Value label */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 px-2 text-sm font-medium text-white"
                    style={{ left: Math.min(barWidth - 10, 5) + '%' }}
                  >
                    {viewMode === 'opportunity' && `${gap.impact.opportunityScore}`}
                    {viewMode === 'earnings' && gap.impact.potentialRateIncrease}
                    {viewMode === 'time' && gap.timeToAcquire}
                  </div>
                </div>

                {/* Secondary info */}
                <div className="w-24 flex-shrink-0 text-right">
                  <p className="text-sm font-medium text-gray-700">{gap.impact.missedJobs} jobs</p>
                  <p className="text-xs text-gray-500">{gap.timeToAcquire}</p>
                </div>

                {/* Action */}
                <Link
                  className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                  href={
                    gap.learningPath
                      ? `/learn/paths/${gap.learningPath.id}`
                      : `/learn/gaps/${gap.id}`
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </Link>
              </div>

              {/* Expanded Details */}
              {selectedGap?.id === gap.id && (
                <div className="ml-36 mt-3 rounded-lg bg-gray-50 p-4">
                  <div className="mb-3 grid grid-cols-4 gap-4">
                    <div>
                      <p className="mb-0.5 text-xs text-gray-500">Current Level</p>
                      <p className="text-sm font-medium text-gray-900">{gap.currentLevel}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-500">Required Level</p>
                      <p className="text-sm font-medium text-gray-900">{gap.requiredLevel}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-500">Rate Increase</p>
                      <p className="text-sm font-medium text-green-600">
                        {gap.impact.potentialRateIncrease}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-500">Missed Jobs</p>
                      <p className="text-sm font-medium text-blue-600">{gap.impact.missedJobs}</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="mb-1 text-xs text-gray-500">Career Opportunities</p>
                    <div className="flex flex-wrap gap-1">
                      {gap.relatedJobs.map((job) => (
                        <span
                          key={job}
                          className="rounded bg-white px-2 py-0.5 text-xs text-gray-700"
                        >
                          {job}
                        </span>
                      ))}
                    </div>
                  </div>
                  {gap.learningPath && (
                    <Link
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                      href={`/learn/paths/${gap.learningPath.id}`}
                    >
                      Start {gap.learningPath.name}
                      <span className="text-indigo-200">({gap.learningPath.duration})</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Severity:</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-xs text-gray-600">Critical</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-orange-500" />
                <span className="text-xs text-gray-600">High</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="text-xs text-gray-600">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-600">Low</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">Click a bar for details</p>
        </div>
      </div>
    </div>
  );
}

export default GapImpactChart;
