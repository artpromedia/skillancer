'use client';

import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@skillancer/ui';
import { Award, BookOpen, CheckCircle, Flame, GraduationCap, TrendingUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LearningCompletion {
  id: string;
  title: string;
  type: 'course' | 'assessment' | 'certification';
  completedAt: string;
}

interface SkillUpdate {
  skill: string;
  improvement: number; // percentage points
  updatedAt: string;
}

interface LearningActivityBadgeProps {
  isActiveLearner: boolean;
  learningStreak: number; // days
  recentCompletions: LearningCompletion[];
  skillUpdates: SkillUpdate[];
  lastActivityAt?: string;
  variant?: 'badge' | 'card' | 'inline';
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

const completionIcons = {
  course: BookOpen,
  assessment: Award,
  certification: GraduationCap,
};

// ============================================================================
// Badge Variant
// ============================================================================

function LearningBadge({
  isActiveLearner,
  learningStreak,
}: Readonly<{
  isActiveLearner: boolean;
  learningStreak: number;
}>) {
  if (!isActiveLearner && learningStreak === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
              isActiveLearner
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {isActiveLearner ? (
              <>
                <Flame className="h-4 w-4" />
                Active Learner
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" />
                {learningStreak} day streak
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isActiveLearner
              ? 'Actively learning and improving skills'
              : `${learningStreak} day learning streak`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Card Variant
// ============================================================================

function LearningCard({
  isActiveLearner,
  learningStreak,
  recentCompletions,
  skillUpdates,
  lastActivityAt,
}: Readonly<LearningActivityBadgeProps>) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-lg p-2', isActiveLearner ? 'bg-emerald-100' : 'bg-gray-100')}>
            <Flame
              className={cn('h-5 w-5', isActiveLearner ? 'text-emerald-600' : 'text-gray-400')}
            />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">
              {isActiveLearner ? 'Active Learner' : 'Learning Activity'}
            </h4>
            <p className="text-xs text-gray-500">
              {learningStreak > 0 ? `🔥 ${learningStreak} day streak` : 'No active streak'}
            </p>
          </div>
        </div>
        {isActiveLearner && (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
            Active
          </span>
        )}
      </div>

      {/* Recent Completions */}
      {recentCompletions.length > 0 && (
        <div className="mb-4">
          <h5 className="mb-2 text-xs font-medium text-gray-500">Recent Completions</h5>
          <div className="space-y-2">
            {recentCompletions.slice(0, 3).map((completion) => {
              const Icon = completionIcons[completion.type];
              return (
                <div key={completion.id} className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-indigo-500" />
                  <span className="flex-1 truncate text-gray-700">{completion.title}</span>
                  <span className="text-xs text-gray-400">
                    {formatRelativeDate(completion.completedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skill Updates */}
      {skillUpdates.length > 0 && (
        <div>
          <h5 className="mb-2 text-xs font-medium text-gray-500">Recently Improved</h5>
          <div className="flex flex-wrap gap-2">
            {skillUpdates.slice(0, 4).map((update) => (
              <span
                key={`${update.skill}-${update.updatedAt}`}
                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs text-green-700"
              >
                <TrendingUp className="h-3 w-3" />
                {update.skill}
                <span className="text-green-500">+{update.improvement}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentCompletions.length === 0 && skillUpdates.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No recent learning activity</p>
      )}

      {/* Last activity */}
      {lastActivityAt && (
        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
          Last activity: {formatRelativeDate(lastActivityAt)}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Inline Variant
// ============================================================================

function LearningInline({
  isActiveLearner,
  learningStreak,
  recentCompletions,
}: Readonly<
  Pick<LearningActivityBadgeProps, 'isActiveLearner' | 'learningStreak' | 'recentCompletions'>
>) {
  const coursesCount = recentCompletions.filter((c) => c.type === 'course').length;
  const assessmentsCount = recentCompletions.filter((c) => c.type === 'assessment').length;

  return (
    <div className="flex items-center gap-4 text-sm">
      {isActiveLearner && (
        <span className="flex items-center gap-1 text-emerald-600">
          <Flame className="h-4 w-4" />
          Active Learner
        </span>
      )}
      {learningStreak > 0 && (
        <span className="flex items-center gap-1 text-orange-600">
          🔥 {learningStreak} day streak
        </span>
      )}
      {coursesCount > 0 && (
        <span className="flex items-center gap-1 text-gray-600">
          <BookOpen className="h-4 w-4" />
          {coursesCount} courses
        </span>
      )}
      {assessmentsCount > 0 && (
        <span className="flex items-center gap-1 text-gray-600">
          <CheckCircle className="h-4 w-4" />
          {assessmentsCount} assessments
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LearningActivityBadge({
  isActiveLearner,
  learningStreak,
  recentCompletions,
  skillUpdates,
  lastActivityAt,
  variant = 'badge',
  className,
}: Readonly<LearningActivityBadgeProps>) {
  if (variant === 'badge') {
    return (
      <div className={className}>
        <LearningBadge isActiveLearner={isActiveLearner} learningStreak={learningStreak} />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={className}>
        <LearningCard
          isActiveLearner={isActiveLearner}
          lastActivityAt={lastActivityAt}
          learningStreak={learningStreak}
          recentCompletions={recentCompletions}
          skillUpdates={skillUpdates}
          variant="card"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <LearningInline
        isActiveLearner={isActiveLearner}
        learningStreak={learningStreak}
        recentCompletions={recentCompletions}
        skillUpdates={skillUpdates}
        variant="inline"
      />
    </div>
  );
}

export default LearningActivityBadge;
