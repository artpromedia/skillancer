'use client';

import { cn } from '@skillancer/ui';
import { Flag, Check, ChevronLeft, ChevronRight } from 'lucide-react';

type QuestionStatus = 'not-visited' | 'visited' | 'answered' | 'flagged' | 'current';

interface Question {
  id: string;
  type: string;
  text: string;
}

interface QuestionNavigatorProps {
  questions: Question[];
  currentIndex: number;
  getQuestionStatus: (questionId: string) => QuestionStatus;
  onNavigate: (index: number) => void;
  answeredCount: number;
  flaggedCount: number;
  orientation?: 'horizontal' | 'vertical';
  showLegend?: boolean;
  compact?: boolean;
}

export function QuestionNavigator({
  questions,
  currentIndex,
  getQuestionStatus,
  onNavigate,
  answeredCount,
  flaggedCount,
  orientation = 'horizontal',
  showLegend = true,
  compact = false,
}: Readonly<QuestionNavigatorProps>) {
  const getStatusStyles = (status: QuestionStatus) => {
    switch (status) {
      case 'current':
        return 'bg-indigo-600 text-white ring-2 ring-indigo-300';
      case 'answered':
        return 'bg-green-500 text-white';
      case 'flagged':
        return 'bg-amber-500 text-white';
      case 'visited':
        return 'bg-gray-200 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-400 hover:bg-gray-200';
    }
  };

  const getStatusIcon = (status: QuestionStatus) => {
    switch (status) {
      case 'answered':
        return <Check className="h-3 w-3" />;
      case 'flagged':
        return <Flag className="h-3 w-3" />;
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentIndex === 0}
          onClick={() => onNavigate(currentIndex - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[60px] text-center text-sm font-medium text-gray-600">
          {currentIndex + 1} / {questions.length}
        </span>
        <button
          className="rounded-lg p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentIndex === questions.length - 1}
          onClick={() => onNavigate(currentIndex + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const isVertical = orientation === 'vertical';

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-4', isVertical && 'w-64')}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Questions</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-medium text-green-600">
            {answeredCount}/{questions.length}
          </span>
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <Flag className="h-3 w-3" />
              {flaggedCount}
            </span>
          )}
        </div>
      </div>

      {/* Question Grid */}
      <div
        className={cn('gap-2', isVertical ? 'flex flex-col' : 'grid grid-cols-5 sm:grid-cols-10')}
      >
        {questions.map((question, idx) => {
          const status = getQuestionStatus(question.id);
          const icon = getStatusIcon(status);

          return (
            <button
              key={question.id}
              className={cn(
                'relative flex items-center justify-center transition-all',
                isVertical
                  ? 'w-full rounded-lg px-3 py-2 text-left'
                  : 'h-8 w-8 rounded-lg text-sm font-medium',
                getStatusStyles(status)
              )}
              onClick={() => onNavigate(idx)}
            >
              {isVertical ? (
                <>
                  <span className="flex-1 truncate">
                    <span className="font-medium">{idx + 1}.</span>{' '}
                    <span className="truncate text-sm opacity-80">
                      {question.type.replace('-', ' ')}
                    </span>
                  </span>
                  {icon && <span className="ml-2">{icon}</span>}
                </>
              ) : (
                <>
                  {idx + 1}
                  {icon && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      {icon}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div
          className={cn(
            'mt-4 border-t border-gray-100 pt-3',
            isVertical ? 'space-y-2' : 'flex flex-wrap gap-3'
          )}
        >
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-3 w-3 rounded bg-indigo-600" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-3 w-3 rounded bg-green-500" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-3 w-3 rounded bg-amber-500" />
            <span>Flagged</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-3 w-3 rounded bg-gray-200" />
            <span>Visited</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-3 w-3 rounded border border-gray-300 bg-gray-100" />
            <span>Not visited</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Mini navigator for mobile/compact views
export function MiniNavigator({
  currentIndex,
  totalQuestions,
  answeredCount,
  onPrev,
  onNext,
}: Readonly<{
  currentIndex: number;
  totalQuestions: number;
  answeredCount: number;
  onPrev: () => void;
  onNext: () => void;
}>) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
      <button
        className="rounded-lg p-2 hover:bg-gray-200 disabled:opacity-50"
        disabled={currentIndex === 0}
        onClick={onPrev}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="text-center">
        <div className="font-medium text-gray-900">
          Question {currentIndex + 1} of {totalQuestions}
        </div>
        <div className="text-xs text-gray-500">{answeredCount} answered</div>
      </div>

      <button
        className="rounded-lg p-2 hover:bg-gray-200 disabled:opacity-50"
        disabled={currentIndex === totalQuestions - 1}
        onClick={onNext}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export default QuestionNavigator;
