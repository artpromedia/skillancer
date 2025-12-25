'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

// ============================================================================
// Rating Stars Component
// ============================================================================

export interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function RatingStars({
  rating,
  maxRating = 5,
  size = 'md',
  showValue = false,
  interactive = false,
  onChange,
  className,
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  const displayRating = hoverRating ?? rating;
  const starSize = sizeClasses[size];

  const handleClick = (value: number) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <div className="flex">
        {Array.from({ length: maxRating }, (_, i) => {
          const value = i + 1;
          const isFilled = displayRating >= value;
          const isHalf = !isFilled && displayRating >= value - 0.5;

          return (
            <button
              key={i}
              className={cn(
                'relative',
                interactive && 'cursor-pointer transition-transform hover:scale-110',
                !interactive && 'cursor-default'
              )}
              disabled={!interactive}
              type="button"
              onClick={() => handleClick(value)}
              onMouseEnter={() => interactive && setHoverRating(value)}
              onMouseLeave={() => interactive && setHoverRating(null)}
            >
              {/* Empty star (background) */}
              <svg
                className={cn(starSize, 'text-muted-foreground/30')}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>

              {/* Filled star (overlay) */}
              {(isFilled || isHalf) && (
                <svg
                  className={cn(
                    starSize,
                    'absolute inset-0 text-yellow-400',
                    isHalf && 'clip-path-half'
                  )}
                  fill="currentColor"
                  style={isHalf ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {showValue && (
        <span
          className={cn(
            'font-medium',
            size === 'xs' && 'text-xs',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
