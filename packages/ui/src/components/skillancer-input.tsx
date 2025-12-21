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
  ({ label, error, helperText, wrapperClassName, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        {label && (
          <Label className={cn(error && 'text-destructive')} htmlFor={inputId}>
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          aria-invalid={!!error}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          id={inputId}
          {...props}
        />
        {error && (
          <p className="text-destructive text-sm" id={`${inputId}-error`} role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-muted-foreground text-sm" id={`${inputId}-helper`}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
SkillancerInput.displayName = 'SkillancerInput';

export { SkillancerInput };
