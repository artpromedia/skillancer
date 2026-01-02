'use client';

/**
 * Code Suggestions Component for SkillPod
 * Sprint M7: AI Work Assistant
 *
 * Displays AI-generated code suggestions and improvements
 */

import { Button, Card, CardContent, CardHeader, ScrollArea, cn } from '@skillancer/ui';
import {
  Sparkles,
  Code,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Lightbulb,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useState, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface CodeSuggestion {
  id: string;
  type: 'refactor' | 'fix' | 'optimize' | 'style' | 'security';
  severity: 'error' | 'warning' | 'info' | 'hint';
  title: string;
  description: string;
  lineStart: number;
  lineEnd: number;
  originalCode: string;
  suggestedCode: string;
  explanation: string;
  impact: 'high' | 'medium' | 'low';
}

interface CodeSuggestionsProps {
  suggestions: CodeSuggestion[];
  onApply: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const TYPE_ICONS: Record<string, typeof Code> = {
  refactor: Sparkles,
  fix: AlertTriangle,
  optimize: Lightbulb,
  style: Code,
  security: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  refactor: 'text-purple-600 bg-purple-50',
  fix: 'text-red-600 bg-red-50',
  optimize: 'text-amber-600 bg-amber-50',
  style: 'text-blue-600 bg-blue-50',
  security: 'text-red-700 bg-red-100',
};

const SEVERITY_COLORS: Record<string, string> = {
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
  hint: 'border-l-gray-400',
};

const IMPACT_BADGES: Record<string, { label: string; color: string }> = {
  high: { label: 'High Impact', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
};

// =============================================================================
// SUGGESTION ITEM
// =============================================================================

function SuggestionItem({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: CodeSuggestion;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const Icon = TYPE_ICONS[suggestion.type] || Code;
  const typeColor = TYPE_COLORS[suggestion.type] || TYPE_COLORS.style;
  const severityColor = SEVERITY_COLORS[suggestion.severity] || SEVERITY_COLORS.info;
  const impactBadge = IMPACT_BADGES[suggestion.impact] || IMPACT_BADGES.low;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(suggestion.suggestedCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [suggestion.suggestedCode]);

  return (
    <Card className={cn('border-l-4 transition-all hover:shadow-md', severityColor)}>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-1 items-start gap-2">
            <div
              className={cn(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md',
                typeColor
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium text-gray-900">{suggestion.title}</h4>
                <span
                  className={cn('rounded-full px-2 py-0.5 text-xs font-medium', impactBadge.color)}
                >
                  {impactBadge.label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Lines {suggestion.lineStart}-{suggestion.lineEnd}
              </p>
            </div>
          </div>

          <Button
            className="h-7 w-7 flex-shrink-0 p-0"
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Description */}
        <p className="mt-2 text-sm text-gray-600">{suggestion.description}</p>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Explanation */}
            <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-800">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{suggestion.explanation}</p>
              </div>
            </div>

            {/* Code Diff */}
            <div className="space-y-2">
              {/* Original */}
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Current Code:</p>
                <pre className="overflow-x-auto rounded bg-red-50 p-2 text-xs text-red-900">
                  <code>{suggestion.originalCode}</code>
                </pre>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>

              {/* Suggested */}
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Suggested Code:</p>
                <div className="relative">
                  <pre className="overflow-x-auto rounded bg-green-50 p-2 pr-10 text-xs text-green-900">
                    <code>{suggestion.suggestedCode}</code>
                  </pre>
                  <Button
                    className="absolute right-1 top-1 h-6 w-6 p-0"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-2">
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-700"
            size="sm"
            onClick={() => onApply(suggestion.id)}
          >
            <Check className="mr-1 h-3 w-3" />
            Apply
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant="outline"
            onClick={() => onDismiss(suggestion.id)}
          >
            <X className="mr-1 h-3 w-3" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CodeSuggestions({
  suggestions,
  onApply,
  onDismiss,
  onRefresh,
  isLoading = false,
  className,
}: CodeSuggestionsProps) {
  // Group suggestions by severity
  const groupedSuggestions = suggestions.reduce(
    (acc, suggestion) => {
      acc[suggestion.severity] = acc[suggestion.severity] || [];
      acc[suggestion.severity].push(suggestion);
      return acc;
    },
    {} as Record<string, CodeSuggestion[]>
  );

  const severityOrder = ['error', 'warning', 'info', 'hint'];

  if (suggestions.length === 0 && !isLoading) {
    return (
      <div className={cn('py-8 text-center', className)}>
        <div className="mb-3 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Check className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <h3 className="font-medium text-gray-900">All Good!</h3>
        <p className="mt-1 text-sm text-gray-500">No suggestions for the current code.</p>
        {onRefresh && (
          <Button className="mt-4" size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Analyze Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Code Suggestions</h3>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            {suggestions.length}
          </span>
        </div>
        {onRefresh && (
          <Button disabled={isLoading} size="sm" variant="ghost" onClick={onRefresh}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        {severityOrder.map((severity) => {
          const count = groupedSuggestions[severity]?.length || 0;
          if (count === 0) return null;

          const colors: Record<string, string> = {
            error: 'bg-red-100 text-red-700',
            warning: 'bg-amber-100 text-amber-700',
            info: 'bg-blue-100 text-blue-700',
            hint: 'bg-gray-100 text-gray-600',
          };

          return (
            <span
              key={severity}
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                colors[severity]
              )}
            >
              {count} {severity}
              {count > 1 ? 's' : ''}
            </span>
          );
        })}
      </div>

      {/* Suggestions List */}
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-3 pr-2">
          {severityOrder.map((severity) =>
            (groupedSuggestions[severity] || []).map((suggestion) => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                onApply={onApply}
                onDismiss={onDismiss}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
