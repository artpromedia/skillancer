/**
 * FormError Component
 *
 * Inline error display for form fields and form-level errors.
 *
 * @module components/errors/FormError
 */

'use client';

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { forwardRef } from 'react';

import type { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type FormErrorVariant = 'error' | 'warning' | 'info';

export interface FormErrorProps {
  message?: string | ReactNode;
  messages?: string[];
  variant?: FormErrorVariant;
  className?: string;
  showIcon?: boolean;
  id?: string;
  'data-testid'?: string;
}

export interface FormFieldErrorProps extends Omit<FormErrorProps, 'messages'> {
  fieldName?: string;
}

export interface FormSummaryErrorProps {
  errors: Record<string, string | string[] | undefined>;
  title?: string;
  className?: string;
}

export interface ApiFormErrorProps {
  error?: Error | null;
  fallbackMessage?: string;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VARIANT_STYLES = {
  error: {
    icon: AlertCircle,
    container: 'text-red-600 dark:text-red-400',
    iconColor: 'text-red-500',
    background: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
  },
  warning: {
    icon: AlertTriangle,
    container: 'text-amber-600 dark:text-amber-400',
    iconColor: 'text-amber-500',
    background: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
  },
  info: {
    icon: Info,
    container: 'text-blue-600 dark:text-blue-400',
    iconColor: 'text-blue-500',
    background: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
  },
};

// ============================================================================
// Components
// ============================================================================

export const FormError = forwardRef<HTMLParagraphElement, FormErrorProps>(function FormError(
  {
    message,
    messages,
    variant = 'error',
    className = '',
    showIcon = true,
    id,
    'data-testid': testId,
  },
  ref
) {
  if (!message && (!messages || messages.length === 0)) {
    return null;
  }

  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  if (message && !messages) {
    return (
      <p
        ref={ref}
        aria-live="polite"
        className={`mt-1.5 flex items-center gap-1.5 text-sm ${styles.container} ${className}`}
        data-testid={testId}
        id={id}
        role="alert"
      >
        {showIcon && <Icon className={`h-4 w-4 flex-shrink-0 ${styles.iconColor}`} />}
        <span>{message}</span>
      </p>
    );
  }

  if (messages && messages.length > 0) {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        aria-live="polite"
        className={`mt-1.5 ${styles.container} ${className}`}
        data-testid={testId}
        id={id}
        role="alert"
      >
        <ul className="space-y-1">
          {messages.map((msg, index) => (
            <li key={index} className="flex items-center gap-1.5 text-sm">
              {showIcon && <Icon className={`h-4 w-4 flex-shrink-0 ${styles.iconColor}`} />}
              <span>{msg}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
});

export function FormFieldError({ fieldName, id, ...props }: FormFieldErrorProps) {
  const errorId = id || (fieldName ? `${fieldName}-error` : undefined);
  return <FormError {...props} id={errorId} />;
}

export function FormSummaryError({
  errors,
  title = 'Please fix the following errors:',
  className = '',
}: FormSummaryErrorProps) {
  const errorEntries = Object.entries(errors).filter(([, value]) => value !== undefined);

  if (errorEntries.length === 0) {
    return null;
  }

  const styles = VARIANT_STYLES.error;

  return (
    <div
      aria-live="polite"
      className={`rounded-lg border p-4 ${styles.background} ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className={`h-5 w-5 flex-shrink-0 ${styles.iconColor}`} />
        <div className="flex-1">
          <h3 className={`font-medium ${styles.container}`}>{title}</h3>
          <ul className={`mt-2 list-inside list-disc space-y-1 text-sm ${styles.container}`}>
            {errorEntries.map(([field, value]) => {
              const messages = Array.isArray(value) ? value : [value];
              return messages.map((msg, index) => (
                <li key={`${field}-${index}`}>
                  <span className="font-medium capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  : {msg}
                </li>
              ));
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ApiFormError({
  error,
  fallbackMessage = 'An error occurred. Please try again.',
  className = '',
}: ApiFormErrorProps) {
  if (!error) {
    return null;
  }

  const styles = VARIANT_STYLES.error;

  return (
    <div
      aria-live="polite"
      className={`rounded-lg border p-4 ${styles.background} ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className={`h-5 w-5 flex-shrink-0 ${styles.iconColor}`} />
        <p className={`text-sm ${styles.container}`}>{error.message || fallbackMessage}</p>
      </div>
    </div>
  );
}

export default FormError;
