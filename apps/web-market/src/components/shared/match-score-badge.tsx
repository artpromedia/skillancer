'use client';

import { cn } from '@skillancer/ui';

interface MatchScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * SmartMatch score badge with circular progress indicator
 * - Green: >80%
 * - Yellow: 60-80%
 * - Gray: <60%
 */
export function MatchScoreBadge({
  score,
  size = 'md',
  showLabel = false,
  className,
}: MatchScoreBadgeProps) {
  // Clamp score between 0-100
  const normalizedScore = Math.max(0, Math.min(100, score));

  // Determine color based on score
  const getColor = (s: number) => {
    if (s >= 80)
      return { text: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', stroke: '#22c55e' };
    if (s >= 60)
      return {
        text: 'text-yellow-600',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        stroke: '#eab308',
      };
    return { text: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', stroke: '#6b7280' };
  };

  const colors = getColor(normalizedScore);

  // Size configurations
  const sizeConfig = {
    sm: { container: 'w-8 h-8', text: 'text-[10px]', strokeWidth: 3, radius: 12 },
    md: { container: 'w-10 h-10', text: 'text-xs', strokeWidth: 3, radius: 16 },
    lg: { container: 'w-14 h-14', text: 'text-sm', strokeWidth: 4, radius: 22 },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className={cn('flex items-center gap-2', className)} title={`${normalizedScore}% match`}>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full',
          colors.bg,
          config.container
        )}
      >
        {/* Background circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          height="100%"
          viewBox={`0 0 ${(config.radius + config.strokeWidth) * 2} ${(config.radius + config.strokeWidth) * 2}`}
          width="100%"
        >
          {/* Track */}
          <circle
            className="text-muted/30"
            cx={config.radius + config.strokeWidth}
            cy={config.radius + config.strokeWidth}
            fill="none"
            r={config.radius}
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress */}
          <circle
            className="transition-all duration-500 ease-out"
            cx={config.radius + config.strokeWidth}
            cy={config.radius + config.strokeWidth}
            fill="none"
            r={config.radius}
            stroke={colors.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            strokeWidth={config.strokeWidth}
          />
        </svg>

        {/* Score text */}
        <span className={cn('z-10 font-semibold', colors.text, config.text)}>
          {normalizedScore}
        </span>
      </div>

      {showLabel && (
        <span className={cn('text-sm font-medium', colors.text)}>
          {normalizedScore >= 80
            ? 'Great match'
            : normalizedScore >= 60
              ? 'Good match'
              : 'Fair match'}
        </span>
      )}
    </div>
  );
}
