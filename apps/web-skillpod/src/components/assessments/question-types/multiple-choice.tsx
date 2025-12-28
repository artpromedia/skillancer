'use client';

import { cn } from '@skillancer/ui';

interface Option {
  id: string;
  text: string;
}

interface MultipleChoiceProps {
  question: {
    id: string;
    text: string;
    code?: string | null;
    options?: Option[];
    multiple?: boolean;
  };
  value: string | string[];
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
  showCorrect?: {
    correctAnswers: string[];
    showExplanation?: boolean;
  };
}

// Helper function to get selected values from value prop
function getSelectedValues(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}

// Helper function to get indicator style
function getIndicatorStyle(
  isSelected: boolean,
  showCorrect: MultipleChoiceProps['showCorrect'],
  isCorrect: boolean
): string {
  if (!isSelected) return 'border-gray-300';
  if (!showCorrect) return 'border-indigo-500 bg-indigo-500';
  if (isCorrect) return 'border-green-500 bg-green-500';
  return 'border-red-500 bg-red-500';
}

export function MultipleChoice({
  question,
  value,
  onChange,
  disabled = false,
  showCorrect,
}: Readonly<MultipleChoiceProps>) {
  const isMultiple = question.multiple;
  const selectedValues = getSelectedValues(value);

  const handleSelect = (optionId: string) => {
    if (disabled) return;

    if (isMultiple) {
      const newValue = selectedValues.includes(optionId)
        ? selectedValues.filter((v) => v !== optionId)
        : [...selectedValues, optionId];
      onChange(newValue);
    } else {
      onChange(optionId);
    }
  };

  const isSelected = (optionId: string) => selectedValues.includes(optionId);

  const isCorrect = (optionId: string) => showCorrect?.correctAnswers.includes(optionId);

  const getOptionStyle = (optionId: string) => {
    if (showCorrect) {
      if (isCorrect(optionId)) {
        return 'border-green-500 bg-green-50';
      }
      if (isSelected(optionId) && !isCorrect(optionId)) {
        return 'border-red-500 bg-red-50';
      }
    }
    if (isSelected(optionId)) {
      return 'border-indigo-500 bg-indigo-50';
    }
    return 'border-gray-200 hover:border-gray-300';
  };

  return (
    <div className="space-y-4">
      {/* Question Text */}
      <div className="prose prose-sm max-w-none">
        <p className="text-lg text-gray-900">{question.text}</p>
      </div>

      {/* Code Snippet (if any) */}
      {question.code && (
        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 font-mono text-sm text-gray-100">
          <code>{question.code}</code>
        </pre>
      )}

      {/* Selection Type Hint */}
      <p className="text-sm text-gray-500">
        {isMultiple ? 'Select all that apply' : 'Select one answer'}
      </p>

      {/* Options */}
      <div className="space-y-2">
        {question.options?.map((option, idx) => (
          <button
            key={option.id}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
              getOptionStyle(option.id),
              disabled && 'cursor-not-allowed opacity-75'
            )}
            disabled={disabled}
            onClick={() => handleSelect(option.id)}
          >
            {/* Radio/Checkbox indicator */}
            <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2',
                isMultiple ? 'rounded' : 'rounded-full',
                getIndicatorStyle(isSelected(option.id), showCorrect, isCorrect(option.id))
              )}
            >
              {isSelected(option.id) && (
                <span className="text-xs text-white">{isMultiple ? '✓' : '●'}</span>
              )}
            </span>

            {/* Option content */}
            <div className="flex-1">
              <span className="mr-2 text-sm font-medium text-gray-500">
                {String.fromCodePoint(65 + idx)}.
              </span>
              <span
                className={cn(
                  'text-gray-900',
                  showCorrect && isCorrect(option.id) && 'font-medium'
                )}
              >
                {option.text}
              </span>
            </div>

            {/* Correct/Incorrect indicator (review mode) */}
            {showCorrect && (
              <span className="shrink-0">
                {isCorrect(option.id) && (
                  <span className="text-sm font-medium text-green-600">Correct</span>
                )}
                {isSelected(option.id) && !isCorrect(option.id) && (
                  <span className="text-sm font-medium text-red-600">Incorrect</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Clear Selection */}
      {selectedValues.length > 0 && !disabled && !showCorrect && (
        <button
          className="text-sm text-gray-500 hover:text-gray-700"
          onClick={() => onChange(isMultiple ? [] : '')}
        >
          Clear selection
        </button>
      )}
    </div>
  );
}

export default MultipleChoice;
