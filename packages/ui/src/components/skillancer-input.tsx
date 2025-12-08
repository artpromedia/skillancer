import * as React from 'react';

import { Input, type InputProps } from './input';
import { Label } from './label';
import { cn } from '../lib/utils';

export interface SkillancerInputProps extends InputProps {
  /**
   * Label text shown above the input
   */
  label?: string;
  /**
   * Error message shown below the input
   */
  error?: string;
  /**
   * Helper text shown below the input (hidden when error is shown)
   */
  helperText?: string;
  /**
   * Additional class for the wrapper div
   */
  wrapperClassName?: string;
}

/**
 * Form input with integrated label and error handling
 * 
 * @example
 * <SkillancerInput
 *   label="Email"
 *   placeholder="Enter your email"
 *   error={errors.email?.message}
 *   helperText="We'll never share your email"
 * />
 */
const SkillancerInput = React.forwardRef<HTMLInputElement, SkillancerInputProps>(
  (
    {
      label,
      error,
      helperText,
      wrapperClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId();

    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        {label && (
          <Label
            htmlFor={inputId}
            className={cn(error && 'text-destructive')}
          >
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          id={inputId}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-helper`
                : undefined
          }
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
SkillancerInput.displayName = 'SkillancerInput';

export { SkillancerInput };
