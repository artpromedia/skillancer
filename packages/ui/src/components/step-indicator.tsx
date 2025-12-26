/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'compact' | 'numbered';
  size?: 'sm' | 'md' | 'lg';
  onStepClick?: (index: number) => void;
  allowClickOnComplete?: boolean;
  allowClickOnAll?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function StepIndicator({
  steps,
  currentStep,
  orientation = 'horizontal',
  variant = 'default',
  size = 'md',
  onStepClick,
  allowClickOnComplete = true,
  allowClickOnAll = false,
  className,
}: StepIndicatorProps) {
  // Size configurations
  const sizeConfig = {
    sm: {
      circle: 'h-6 w-6 text-xs',
      line: 'h-0.5',
      verticalLine: 'w-0.5',
      gap: 'gap-1',
      textSize: 'text-xs',
    },
    md: {
      circle: 'h-8 w-8 text-sm',
      line: 'h-0.5',
      verticalLine: 'w-0.5',
      gap: 'gap-2',
      textSize: 'text-sm',
    },
    lg: {
      circle: 'h-10 w-10 text-base',
      line: 'h-1',
      verticalLine: 'w-1',
      gap: 'gap-3',
      textSize: 'text-base',
    },
  };

  const config = sizeConfig[size];

  // Handle step click
  const handleClick = (index: number) => {
    if (!onStepClick) return;

    const isComplete = index < currentStep;
    const canClick = allowClickOnAll || (allowClickOnComplete && isComplete);

    if (canClick) {
      onStepClick(index);
    }
  };

  // Render step circle
  const renderStepCircle = (step: Step, index: number) => {
    const isComplete = index < currentStep;
    const isActive = index === currentStep;
    const isClickable = onStepClick && (allowClickOnAll || (allowClickOnComplete && isComplete));

    return (
      <button
        key={step.id}
        aria-current={isActive ? 'step' : undefined}
        className={cn(
          'flex items-center justify-center rounded-full font-medium transition-all',
          config.circle,
          isComplete && 'bg-green-500 text-white',
          isActive && 'bg-primary text-primary-foreground ring-primary/20 ring-4',
          !isComplete && !isActive && 'bg-muted text-muted-foreground',
          isClickable && 'hover:ring-primary/30 cursor-pointer hover:ring-2',
          !isClickable && !isActive && 'cursor-default'
        )}
        disabled={!isClickable}
        type="button"
        onClick={() => handleClick(index)}
      >
        {isComplete ? (
          <Check className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
        ) : step.icon ? (
          step.icon
        ) : variant === 'numbered' || variant === 'default' ? (
          index + 1
        ) : (
          <div
            className={cn(
              'rounded-full',
              size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-2.5 w-2.5' : 'h-3 w-3',
              isActive ? 'bg-current' : 'bg-current/50'
            )}
          />
        )}
      </button>
    );
  };

  // Horizontal layout
  if (orientation === 'horizontal') {
    return (
      <div className={cn('w-full', className)}>
        {/* Compact variant */}
        {variant === 'compact' && (
          <div className="flex items-center justify-center gap-2">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                {renderStepCircle(step, index)}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-8 rounded-full transition-colors',
                      config.line,
                      index < currentStep ? 'bg-green-500' : 'bg-muted'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Default/numbered variant */}
        {(variant === 'default' || variant === 'numbered') && (
          <div className="flex items-start">
            {steps.map((step, index) => (
              <div key={step.id} className={cn('flex flex-1 flex-col items-center', config.gap)}>
                <div className="flex w-full items-center">
                  {index > 0 && (
                    <div
                      className={cn(
                        'flex-1 rounded-full transition-colors',
                        config.line,
                        index <= currentStep ? 'bg-green-500' : 'bg-muted'
                      )}
                    />
                  )}
                  {renderStepCircle(step, index)}
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 rounded-full transition-colors',
                        config.line,
                        index < currentStep ? 'bg-green-500' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'font-medium',
                      config.textSize,
                      index === currentStep
                        ? 'text-foreground'
                        : index < currentStep
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-muted-foreground mt-0.5 text-xs">{step.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Vertical layout
  return (
    <div className={cn('flex flex-col', className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            {renderStepCircle(step, index)}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'my-2 flex-1 rounded-full transition-colors',
                  config.verticalLine,
                  'min-h-[24px]',
                  index < currentStep ? 'bg-green-500' : 'bg-muted'
                )}
              />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-8">
            <p
              className={cn(
                'font-medium',
                config.textSize,
                index === currentStep
                  ? 'text-foreground'
                  : index < currentStep
                    ? 'text-green-600'
                    : 'text-muted-foreground'
              )}
            >
              {step.title}
            </p>
            {step.description && (
              <p className="text-muted-foreground mt-1 text-sm">{step.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
