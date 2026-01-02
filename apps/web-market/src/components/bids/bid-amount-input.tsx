'use client';

/**
 * Bid Amount Input with AI Rate Advisor
 * Sprint M7: AI Work Assistant - Rate Optimization
 */

import { Card, CardContent, Input, Label, Button, cn } from '@skillancer/ui';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  Target,
  Zap,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';

import { useRateAdvisor } from '@/lib/api/ai';

// =============================================================================
// TYPES
// =============================================================================

interface BidAmountInputProps {
  value: number;
  onChange: (value: number) => void;
  jobBudget?: {
    min?: number;
    max?: number;
    type: 'fixed' | 'hourly';
  };
  jobCategory?: string;
  jobSkills?: string[];
  freelancerProfile?: {
    skills: string[];
    experienceLevel: 'entry' | 'intermediate' | 'expert';
    successRate?: number;
    totalEarnings?: number;
  };
  error?: string;
  className?: string;
}

interface RateRecommendation {
  optimalRate: number;
  minRate: number;
  maxRate: number;
  confidence: number;
  reasoning: string;
  marketPosition: 'below' | 'competitive' | 'above';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BidAmountInput({
  value,
  onChange,
  jobBudget,
  jobCategory = 'General',
  jobSkills = [],
  freelancerProfile,
  error,
  className,
}: BidAmountInputProps) {
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString());

  // AI Rate Advisor hook
  const {
    recommendation,
    isLoading: isLoadingRecommendation,
    getRecommendation,
  } = useRateAdvisor();

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      const parsed = parseFloat(newValue);
      if (!isNaN(parsed) && parsed >= 0) {
        onChange(parsed);
      }
    },
    [onChange]
  );

  // Handle blur - ensure valid number
  const handleBlur = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (isNaN(parsed) || parsed < 0) {
      setLocalValue(value.toString());
    } else {
      onChange(parsed);
    }
  }, [localValue, value, onChange]);

  // Fetch AI recommendation
  const handleGetRecommendation = useCallback(async () => {
    if (!jobSkills.length) return;

    await getRecommendation({
      jobCategory,
      jobSkills,
      jobBudget,
      freelancerProfile,
    });
    setShowAdvisor(true);
  }, [getRecommendation, jobCategory, jobSkills, jobBudget, freelancerProfile]);

  // Apply recommended rate
  const applyRecommendation = useCallback(
    (rate: number) => {
      setLocalValue(rate.toString());
      onChange(rate);
    },
    [onChange]
  );

  // Calculate market position
  const marketPosition = useMemo(() => {
    if (!jobBudget?.min && !jobBudget?.max) return null;

    const midpoint = jobBudget.max
      ? (jobBudget.min ?? 0) + (jobBudget.max - (jobBudget.min ?? 0)) / 2
      : (jobBudget.min ?? 0);

    const diff = ((value - midpoint) / midpoint) * 100;

    if (diff < -15) {
      return {
        label: 'Below Market',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: TrendingDown,
        description: 'Your bid is competitive and likely to attract attention',
      };
    }
    if (diff > 15) {
      return {
        label: 'Above Market',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        icon: TrendingUp,
        description: 'Consider if your expertise justifies the premium',
      };
    }
    return {
      label: 'Market Rate',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: Minus,
      description: 'Your bid is within the typical range for this job',
    };
  }, [value, jobBudget]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main Input */}
      <div>
        <Label htmlFor="bid-amount">Your Bid Amount</Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <DollarSign className="h-4 w-4" />
          </span>
          <Input
            className={cn('pl-9 pr-24', error && 'border-red-500 focus:ring-red-500')}
            id="bid-amount"
            min={0}
            placeholder="0.00"
            step={0.01}
            type="number"
            value={localValue}
            onBlur={handleBlur}
            onChange={handleInputChange}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {jobBudget?.type === 'hourly' && <span className="text-xs text-slate-500">/hr</span>}
            <Button
              className="h-7 px-2"
              disabled={isLoadingRecommendation || !jobSkills.length}
              size="sm"
              type="button"
              variant="ghost"
              onClick={handleGetRecommendation}
            >
              {isLoadingRecommendation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4 text-purple-500" />
                  <span className="text-xs">AI</span>
                </>
              )}
            </Button>
          </div>
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>

      {/* Job Budget Reference */}
      {jobBudget && (jobBudget.min || jobBudget.max) && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Info className="h-4 w-4" />
          <span>
            Client budget:{' '}
            {jobBudget.min && jobBudget.max
              ? `$${jobBudget.min.toLocaleString()} - $${jobBudget.max.toLocaleString()}`
              : jobBudget.min
                ? `From $${jobBudget.min.toLocaleString()}`
                : `Up to $${jobBudget.max?.toLocaleString()}`}
            {jobBudget.type === 'hourly' && '/hr'}
          </span>
        </div>
      )}

      {/* Market Position Indicator */}
      {marketPosition && value > 0 && (
        <div
          className={cn('flex items-center gap-2 rounded-lg p-2 text-sm', marketPosition.bgColor)}
        >
          <marketPosition.icon className={cn('h-4 w-4', marketPosition.color)} />
          <span className={cn('font-medium', marketPosition.color)}>{marketPosition.label}</span>
          <span className="text-slate-600">— {marketPosition.description}</span>
        </div>
      )}

      {/* AI Rate Advisor Panel */}
      {showAdvisor && recommendation && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <span className="font-semibold text-purple-900">AI Rate Advisor</span>
              </div>
              <Button
                className="h-7 w-7 p-0"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setShowAdvisor(false)}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>

            {/* Recommended Rate */}
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <button
                className="rounded-lg border border-slate-200 bg-white p-3 text-center transition-colors hover:border-purple-300"
                type="button"
                onClick={() => applyRecommendation(recommendation.minRate)}
              >
                <p className="mb-1 text-xs text-slate-500">Competitive</p>
                <p className="text-lg font-bold text-slate-700">
                  ${recommendation.minRate.toLocaleString()}
                </p>
              </button>
              <button
                className="rounded-lg border-2 border-purple-400 bg-white p-3 text-center ring-2 ring-purple-100 transition-colors hover:border-purple-500"
                type="button"
                onClick={() => applyRecommendation(recommendation.optimalRate)}
              >
                <p className="mb-1 flex items-center justify-center gap-1 text-xs text-purple-600">
                  <Target className="h-3 w-3" /> Optimal
                </p>
                <p className="text-lg font-bold text-purple-700">
                  ${recommendation.optimalRate.toLocaleString()}
                </p>
              </button>
              <button
                className="rounded-lg border border-slate-200 bg-white p-3 text-center transition-colors hover:border-purple-300"
                type="button"
                onClick={() => applyRecommendation(recommendation.maxRate)}
              >
                <p className="mb-1 text-xs text-slate-500">Premium</p>
                <p className="text-lg font-bold text-slate-700">
                  ${recommendation.maxRate.toLocaleString()}
                </p>
              </button>
            </div>

            {/* Reasoning */}
            <div className="rounded-lg bg-white p-3 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <p>{recommendation.reasoning}</p>
              </div>
            </div>

            {/* Confidence */}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>Confidence:</span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${recommendation.confidence * 100}%` }}
                />
              </div>
              <span>{Math.round(recommendation.confidence * 100)}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toggle Advisor Button (when collapsed) */}
      {!showAdvisor && recommendation && (
        <Button
          className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => setShowAdvisor(true)}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Show AI Rate Recommendation
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
