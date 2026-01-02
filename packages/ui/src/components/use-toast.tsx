/**
 * useToast hook - Compatibility wrapper for Sonner toast
 *
 * Provides a familiar useToast interface while using Sonner under the hood.
 */

import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info';
  duration?: number;
}

export interface ToastReturn {
  toast: (options: ToastOptions) => void;
  dismiss: (toastId?: string | number) => void;
}

export function useToast(): ToastReturn {
  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'default', duration } = options;
    const message = title || description || '';
    const toastOptions = {
      ...(title && description ? { description } : {}),
      ...(duration !== undefined ? { duration } : {}),
    };

    switch (variant) {
      case 'destructive':
        sonnerToast.error(message, toastOptions);
        break;
      case 'success':
        sonnerToast.success(message, toastOptions);
        break;
      case 'warning':
        sonnerToast.warning(message, toastOptions);
        break;
      case 'info':
        sonnerToast.info(message, toastOptions);
        break;
      default:
        sonnerToast(message, toastOptions);
    }
  };

  const dismiss = (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  };

  return { toast, dismiss };
}

// Re-export the raw toast function for direct usage
export { toast } from 'sonner';
