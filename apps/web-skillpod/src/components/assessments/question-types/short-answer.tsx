'use client';

import { cn } from '@skillancer/ui';

interface ShortAnswerProps {
  question: {
    id: string;
    text: string;
    maxLength?: number;
    placeholder?: string;
  };
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ShortAnswer({
  question,
  value,
  onChange,
  disabled = false,
}: Readonly<ShortAnswerProps>) {
  const maxLength = question.maxLength || 500;
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  const isNearLimit = charCount > maxLength * 0.8;
  const isAtLimit = charCount >= maxLength;

  return (
    <div className="space-y-4">
      {/* Question Text */}
      <div className="prose prose-sm max-w-none">
        <p className="text-lg text-gray-900">{question.text}</p>
      </div>

      {/* Answer Input */}
      <div className="relative">
        <textarea
          className={cn(
            'min-h-[200px] w-full resize-y rounded-lg border-2 p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500',
            disabled && 'cursor-not-allowed bg-gray-50',
            isAtLimit ? 'border-amber-400' : 'border-gray-200'
          )}
          disabled={disabled}
          placeholder={question.placeholder || 'Type your answer here...'}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) {
              onChange(e.target.value);
            }
          }}
        />

        {/* Character/Word Count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs">
          <span className="text-gray-400">{wordCount} words</span>
          <span
            className={cn(
              (() => {
                if (isAtLimit) return 'font-medium text-amber-600';
                if (isNearLimit) return 'text-amber-500';
                return 'text-gray-400';
              })()
            )}
          >
            {charCount}/{maxLength}
          </span>
        </div>
      </div>

      {/* Formatting Tips */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Tips:</span>
        <span>• Be concise and specific</span>
        <span>• Use examples where helpful</span>
        <span>• Structure your answer clearly</span>
      </div>
    </div>
  );
}

export default ShortAnswer;
