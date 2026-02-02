'use client';

/**
 * StripeProvider Component
 *
 * Provides Stripe context for payment components.
 * Must wrap any component that uses Stripe Elements.
 */

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { type ReactNode, useMemo } from 'react';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

// ============================================================================
// Types
// ============================================================================

interface StripeProviderProps {
  children: ReactNode;
  options?: {
    clientSecret?: string;
    appearance?: {
      theme?: 'stripe' | 'night' | 'flat';
      variables?: Record<string, string>;
      rules?: Record<string, Record<string, string>>;
    };
  };
}

// ============================================================================
// Default Appearance
// ============================================================================

const defaultAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#4f46e5',
    colorBackground: '#ffffff',
    colorText: '#1f2937',
    colorDanger: '#ef4444',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      borderColor: '#d1d5db',
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    },
    '.Input:focus': {
      borderColor: '#4f46e5',
      boxShadow: '0 0 0 3px rgb(79 70 229 / 0.1)',
    },
    '.Input--invalid': {
      borderColor: '#ef4444',
    },
    '.Label': {
      fontWeight: '500',
      marginBottom: '4px',
    },
  },
};

// ============================================================================
// Component
// ============================================================================

export function StripeProvider({ children, options }: StripeProviderProps) {
  const elementsOptions = useMemo(
    () => ({
      ...(options?.clientSecret && { clientSecret: options.clientSecret }),
      appearance: options?.appearance ?? defaultAppearance,
      loader: 'auto' as const,
    }),
    [options?.clientSecret, options?.appearance]
  );

  return (
    <Elements options={elementsOptions} stripe={stripePromise}>
      {children}
    </Elements>
  );
}

// ============================================================================
// Re-export Stripe hooks for convenience
// ============================================================================

export { useStripe, useElements } from '@stripe/react-stripe-js';
export type { Stripe, StripeElements } from '@stripe/stripe-js';
