import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button, type ButtonProps } from './button';
import { cn } from '../lib/utils';

export interface SkillancerButtonProps extends ButtonProps {
  /**
   * Show loading spinner and disable button
   */
  isLoading?: boolean;
  /**
   * Icon to show on the left side of the button
   */
  leftIcon?: React.ReactNode;
  /**
   * Icon to show on the right side of the button
   */
  rightIcon?: React.ReactNode;
  /**
   * Text to show when loading (defaults to children)
   */
  loadingText?: string;
}

/**
 * Enhanced button component with loading state and icon support
 *
 * @example
 * <SkillancerButton isLoading>Submitting...</SkillancerButton>
 * <SkillancerButton leftIcon={<Plus />}>Add Item</SkillancerButton>
 */
const SkillancerButton = React.forwardRef<HTMLButtonElement, SkillancerButtonProps>(
  (
    {
      children,
      className,
      isLoading = false,
      leftIcon,
      rightIcon,
      loadingText,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        className={cn('gap-2', className)}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </Button>
    );
  }
);
SkillancerButton.displayName = 'SkillancerButton';

export { SkillancerButton };
