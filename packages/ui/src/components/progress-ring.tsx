'use client';

import { cn } from '../lib/utils';

// ============================================================================
// Progress Ring Component
// ============================================================================

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
  showValue?: boolean;
  label?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const sizeConfig = {
  sm: { size: 48, fontSize: 'text-xs' },
  md: { size: 64, fontSize: 'text-sm' },
  lg: { size: 80, fontSize: 'text-base' },
  xl: { size: 96, fontSize: 'text-lg' },
};

const colorConfig = {
  primary: 'stroke-primary',
  success: 'stroke-emerald-500',
  warning: 'stroke-yellow-500',
  danger: 'stroke-red-500',
};

export function ProgressRing({
  value,
  max = 100,
  size = 'md',
  strokeWidth = 4,
  showValue = true,
  label,
  color = 'primary',
  className,
}: ProgressRingProps) {
  const config = sizeConfig[size];
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const radius = (config.size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg className="-rotate-90 transform" height={config.size} width={config.size}>
        {/* Background circle */}
        <circle
          className="stroke-muted"
          cx={config.size / 2}
          cy={config.size / 2}
          fill="none"
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          className={cn(colorConfig[color], 'transition-all duration-500 ease-out')}
          cx={config.size / 2}
          cy={config.size / 2}
          fill="none"
          r={radius}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-semibold', config.fontSize)}>{Math.round(percentage)}%</span>
          {label && <span className="text-muted-foreground text-xs">{label}</span>}
        </div>
      )}
    </div>
  );
}
