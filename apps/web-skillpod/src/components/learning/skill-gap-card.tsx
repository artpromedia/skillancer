'use client';

import { cn } from '@skillancer/ui';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Briefcase,
  ChevronRight,
  BookOpen,
  Minus,
} from 'lucide-react';
import Link from 'next/link';

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

interface SkillGapCardProps {
  gap: SkillGap;
}

export function SkillGapCard({ gap }: Readonly<SkillGapCardProps>) {
  const getSeverityStyles = (severity: SkillGap['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          badge: 'bg-red-100 text-red-700',
          icon: 'text-red-600',
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          badge: 'bg-orange-100 text-orange-700',
          icon: 'text-orange-600',
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          badge: 'bg-yellow-100 text-yellow-700',
          icon: 'text-yellow-600',
        };
      case 'low':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          badge: 'bg-blue-100 text-blue-700',
          icon: 'text-blue-600',
        };
    }
  };

  const styles = getSeverityStyles(gap.severity);

  const getLevelWidth = (level: string) => {
    switch (level) {
      case 'None':
        return '0%';
      case 'Beginner':
        return '25%';
      case 'Intermediate':
        return '50%';
      case 'Advanced':
        return '75%';
      case 'Expert':
        return '100%';
      default:
        return '0%';
    }
  };

  return (
    <div className={cn('rounded-xl border p-5', styles.bg, styles.border)}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{gap.skillName}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', styles.badge)}>
              {gap.severity.charAt(0).toUpperCase() + gap.severity.slice(1)}
            </span>
          </div>
          <p className="text-sm text-gray-500">{gap.category}</p>
        </div>
        <div className="flex items-center gap-1">
          {gap.demandTrend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
          {gap.demandTrend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
          {gap.demandTrend === 'stable' && <Minus className="h-4 w-4 text-gray-400" />}
          <span className="text-xs text-gray-500">
            {gap.demandTrend === 'up' && 'Trending'}
            {gap.demandTrend === 'down' && 'Declining'}
            {gap.demandTrend === 'stable' && 'Stable'}
          </span>
        </div>
      </div>

      {/* Level Gap Visualization */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-gray-500">Current: {gap.currentLevel}</span>
          <span className="font-medium text-gray-900">Required: {gap.requiredLevel}</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-gray-200">
          {/* Current level */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gray-400"
            style={{ width: getLevelWidth(gap.currentLevel) }}
          />
          {/* Required level marker */}
          <div
            className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-indigo-600"
            style={{ left: getLevelWidth(gap.requiredLevel) }}
          />
        </div>
      </div>

      {/* Impact Stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <div className="mb-0.5 flex items-center justify-center gap-1 text-green-600">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold">{gap.impact.potentialRateIncrease}</span>
          </div>
          <p className="text-xs text-gray-500">Rate Increase</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <div className="mb-0.5 flex items-center justify-center gap-1 text-blue-600">
            <Briefcase className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold">{gap.impact.missedJobs}</span>
          </div>
          <p className="text-xs text-gray-500">Jobs Missed</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <div className="mb-0.5 flex items-center justify-center gap-1 text-purple-600">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold">{gap.timeToAcquire}</span>
          </div>
          <p className="text-xs text-gray-500">To Learn</p>
        </div>
      </div>

      {/* Related Jobs */}
      <div className="mb-4">
        <p className="mb-1 text-xs text-gray-500">Opens doors to:</p>
        <div className="flex flex-wrap gap-1">
          {gap.relatedJobs.slice(0, 3).map((job) => (
            <span key={job} className="rounded bg-white/60 px-2 py-0.5 text-xs text-gray-700">
              {job}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {gap.learningPath ? (
          <Link
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            href={`/learn/paths/${gap.learningPath.id}`}
          >
            <BookOpen className="h-4 w-4" />
            Start Learning Path
          </Link>
        ) : (
          <Link
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            href={`/learn/recommendations?skill=${gap.skillName}`}
          >
            <BookOpen className="h-4 w-4" />
            Find Courses
          </Link>
        )}
        <Link
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50"
          href={`/learn/skills/add?skill=${gap.skillName}`}
        >
          Details
          <ChevronRight className="ml-1 inline h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default SkillGapCard;
