import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Size of the spinner
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Text to show below the spinner
   */
  text?: string;
  /**
   * Whether to show as fullscreen overlay
   */
  fullscreen?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

/**
 * Branded loading spinner component
 * 
 * @example
 * <LoadingSpinner size="lg" text="Loading..." />
 * <LoadingSpinner fullscreen />
 */
const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ size = 'md', text, fullscreen = false, className, ...props }, ref) => {
    const content = (
      <div
        ref={ref}
        aria-label={text || 'Loading'}
        className={cn(
          'flex flex-col items-center justify-center gap-2',
          fullscreen && 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
          className
        )}
        role="status"
        {...props}
      >
        <Loader2
          className={cn(
            'animate-spin text-primary',
            sizeClasses[size]
          )}
        />
        {text && (
          <span className="text-sm text-muted-foreground">{text}</span>
        )}
        <span className="sr-only">{text || 'Loading...'}</span>
      </div>
    );

    return content;
  }
);
LoadingSpinner.displayName = 'LoadingSpinner';

export { LoadingSpinner };
