'use client';

import { cn } from '@skillancer/ui';
import {
  BookOpen,
  Video,
  Code,
  Award,
  Clock,
  Star,
  Users,
  TrendingUp,
  Briefcase,
  ChevronRight,
  Bookmark,
  X,
  ExternalLink,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';

interface Recommendation {
  id: string;
  title: string;
  type: 'course' | 'certification' | 'project' | 'tutorial';
  provider: string;
  duration: string;
  relevanceScore: number;
  reasons: string[];
  thumbnail?: string;
  rating: number;
  enrollments: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  skills: string[];
  careerImpact: {
    rateIncrease: string;
    opportunityIncrease: string;
  };
  price?: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onSave?: (id: string) => void;
  onDismiss?: (id: string) => void;
  isSaved?: boolean;
  showReasons?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

export function RecommendationCard({
  recommendation,
  onSave,
  onDismiss,
  isSaved = false,
  showReasons = false,
  variant = 'default',
}: Readonly<RecommendationCardProps>) {
  const rec = recommendation;

  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'course':
        return BookOpen;
      case 'certification':
        return Award;
      case 'project':
        return Code;
      case 'tutorial':
        return Video;
    }
  };

  const getTypeBadgeColor = (type: Recommendation['type']) => {
    switch (type) {
      case 'course':
        return 'bg-blue-100 text-blue-700';
      case 'certification':
        return 'bg-purple-100 text-purple-700';
      case 'project':
        return 'bg-green-100 text-green-700';
      case 'tutorial':
        return 'bg-orange-100 text-orange-700';
    }
  };

  const getLevelColor = (level: Recommendation['level']) => {
    switch (level) {
      case 'Beginner':
        return 'bg-green-50 text-green-700';
      case 'Intermediate':
        return 'bg-blue-50 text-blue-700';
      case 'Advanced':
        return 'bg-purple-50 text-purple-700';
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const TypeIcon = getTypeIcon(rec.type);

  if (variant === 'compact') {
    return (
      <Link
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
        href={`/learn/course/${rec.id}`}
      >
        <div
          className={cn(
            'rounded-lg p-2',
            getTypeBadgeColor(rec.type).replace('text-', 'bg-').replace('700', '100')
          )}
        >
          <TypeIcon className={cn('h-4 w-4', getTypeBadgeColor(rec.type).split(' ')[1])} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{rec.title}</p>
          <p className="text-sm text-gray-500">{rec.provider}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('font-medium', getRelevanceColor(rec.relevanceScore))}>
            {rec.relevanceScore}%
          </span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </Link>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              getTypeBadgeColor(rec.type)
            )}
          >
            <TypeIcon className="h-3 w-3" />
            {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
          </span>
          <div className="flex items-center gap-1">
            {onSave && (
              <button
                className="rounded p-1 transition-colors hover:bg-gray-100"
                onClick={() => onSave(rec.id)}
              >
                <Bookmark
                  className={cn(
                    'h-4 w-4',
                    isSaved ? 'fill-indigo-600 text-indigo-600' : 'text-gray-400'
                  )}
                />
              </button>
            )}
            {onDismiss && (
              <button
                className="rounded p-1 transition-colors hover:bg-gray-100"
                onClick={() => onDismiss(rec.id)}
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <h3 className="mb-1 font-medium text-gray-900">{rec.title}</h3>
        <p className="mb-3 text-sm text-gray-500">{rec.provider}</p>

        {/* Meta */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {rec.duration}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {rec.rating}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {rec.enrollments.toLocaleString()}
          </span>
          <span
            className={cn('rounded px-1.5 py-0.5 text-xs font-medium', getLevelColor(rec.level))}
          >
            {rec.level}
          </span>
        </div>

        {/* Relevance Score */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-gray-500">
              <Sparkles className="h-3 w-3" />
              Match Score
            </span>
            <span className={cn('font-medium', getRelevanceColor(rec.relevanceScore))}>
              {rec.relevanceScore}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
              style={{ width: `${rec.relevanceScore}%` }}
            />
          </div>
        </div>

        {/* Skills */}
        <div className="mb-3 flex flex-wrap gap-1">
          {rec.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {skill}
            </span>
          ))}
          {rec.skills.length > 3 && (
            <span className="text-xs text-gray-400">+{rec.skills.length - 3}</span>
          )}
        </div>

        {/* Why Recommended */}
        {showReasons && rec.reasons.length > 0 && (
          <div className="mb-3 rounded-lg bg-indigo-50 p-2">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-indigo-700">
              <HelpCircle className="h-3 w-3" />
              Why this recommendation?
            </p>
            <ul className="space-y-0.5">
              {rec.reasons.slice(0, 2).map((reason) => (
                <li key={reason} className="flex items-start gap-1 text-xs text-indigo-600">
                  <span className="text-indigo-400">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Career Impact */}
      <div className="border-t border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3">
        <p className="mb-1 text-xs font-medium text-green-700">Career Impact</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm text-green-700">
            <TrendingUp className="h-4 w-4" />
            {rec.careerImpact.rateIncrease}
          </span>
          <span className="flex items-center gap-1 text-sm text-green-700">
            <Briefcase className="h-4 w-4" />
            {rec.careerImpact.opportunityIncrease} jobs
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 p-4 pt-3">
        <div className="flex gap-2">
          <Link
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            href={`/learn/course/${rec.id}`}
          >
            Start Learning
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {onSave && (
            <button
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
              onClick={() => onSave(rec.id)}
            >
              {isSaved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
        {rec.price && <p className="mt-2 text-center text-xs text-gray-500">{rec.price}</p>}
      </div>
    </div>
  );
}

export default RecommendationCard;
