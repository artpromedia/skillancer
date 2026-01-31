/**
 * Error Components
 *
 * Central export for all error-related components.
 *
 * @module components/errors
 */

// Full-page error display
export { ErrorPage } from './ErrorPage';
export type { ErrorPageProps } from './ErrorPage';

// Toast notifications
export {
  ErrorToast,
  showToast,
  showApiErrorToast,
  showNetworkErrorToast,
  showValidationErrorToast,
  showSuccessToast,
  dismissToast,
  dismissAllToasts,
} from './ErrorToast';
export type {
  ShowToastOptions,
  ApiErrorToastOptions,
  ToastType,
  ErrorToastProps,
} from './ErrorToast';

// Form errors
export { FormError, FormFieldError, FormSummaryError, ApiFormError } from './FormError';
export type {
  FormErrorProps,
  FormFieldErrorProps,
  FormSummaryErrorProps,
  ApiFormErrorProps,
  FormErrorVariant,
} from './FormError';
