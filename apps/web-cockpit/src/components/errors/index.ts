/**
 * Error Components
 *
 * Central export for all error-related components.
 *
 * @module components/errors
 */

export { ErrorPage } from './ErrorPage';
export type { ErrorPageProps } from './ErrorPage';

export {
  ToastProvider,
  useToast,
  showToast,
  showApiErrorToast,
  showNetworkErrorToast,
  showSuccessToast,
  setGlobalToast,
} from './ErrorToast';
export type { Toast, ShowToastOptions, ApiErrorToastOptions, ToastType } from './ErrorToast';

export { FormError, FormFieldError, FormSummaryError, ApiFormError } from './FormError';
export type {
  FormErrorProps,
  FormFieldErrorProps,
  FormSummaryErrorProps,
  ApiFormErrorProps,
  FormErrorVariant,
} from './FormError';
