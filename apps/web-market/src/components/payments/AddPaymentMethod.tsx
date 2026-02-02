'use client';

/**
 * AddPaymentMethod Component
 *
 * Stripe Elements-based form for securely collecting payment method details.
 * Supports cards and bank accounts with SetupIntent flow.
 */

import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Loader2, CheckCircle, AlertCircle, Lock, Shield } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

import { usePaymentMethods, type PaymentMethodType } from '@/hooks/use-payment-methods';

import { StripeProvider } from './StripeProvider';

// ============================================================================
// Types
// ============================================================================

interface AddPaymentMethodProps {
  onSuccess?: (paymentMethodId: string) => void;
  onCancel?: () => void;
  defaultType?: PaymentMethodType;
  setAsDefault?: boolean;
  showCancel?: boolean;
  submitLabel?: string;
}

interface AddPaymentMethodFormProps extends AddPaymentMethodProps {
  clientSecret: string;
}

// ============================================================================
// Inner Form Component (requires Stripe context)
// ============================================================================

function AddPaymentMethodForm({
  clientSecret,
  onSuccess,
  onCancel,
  setAsDefault = true,
  showCancel = true,
  submitLabel = 'Add Payment Method',
}: AddPaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { addMethod, isAdding } = usePaymentMethods();

  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!stripe || !elements) {
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        // Confirm the SetupIntent
        const { setupIntent, error: confirmError } = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/settings/payment-methods`,
          },
          redirect: 'if_required',
        });

        if (confirmError) {
          throw new Error(confirmError.message ?? 'Failed to confirm payment method');
        }

        if (!setupIntent?.payment_method) {
          throw new Error('Payment method not created');
        }

        // Get the payment method ID
        const paymentMethodId =
          typeof setupIntent.payment_method === 'string'
            ? setupIntent.payment_method
            : setupIntent.payment_method.id;

        // Add to our system
        await addMethod(paymentMethodId, setAsDefault);

        setSuccess(true);
        onSuccess?.(paymentMethodId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [stripe, elements, addMethod, setAsDefault, onSuccess]
  );

  // Show success state
  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-4 text-lg font-semibold text-green-800">Payment Method Added</h3>
        <p className="mt-2 text-sm text-green-700">Your payment method has been securely saved.</p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Payment Element */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <PaymentElement
          options={{
            layout: 'tabs',
            business: { name: 'Skillancer' },
          }}
          onReady={() => setIsReady(true)}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">Payment Error</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Lock className="h-3 w-3" />
        <span>Your payment information is encrypted and secure</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {showCancel && (
          <button
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isProcessing}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!stripe || !elements || !isReady || isProcessing || isAdding}
          type="submit"
        >
          {isProcessing || isAdding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Main Component (handles SetupIntent creation)
// ============================================================================

export function AddPaymentMethod({
  onSuccess,
  onCancel,
  defaultType = 'card',
  setAsDefault = true,
  showCancel = true,
  submitLabel,
}: AddPaymentMethodProps) {
  const { getSetupIntent, isCreatingSetupIntent } = usePaymentMethods();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create SetupIntent on mount
  useEffect(() => {
    const initSetupIntent = async () => {
      try {
        const { clientSecret: secret } = await getSetupIntent(defaultType);
        setClientSecret(secret);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize payment form';
        setError(message);
      }
    };

    void initSetupIntent();
  }, [getSetupIntent, defaultType]);

  // Loading state
  if (isCreatingSetupIntent || (!clientSecret && !error)) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-4 text-sm text-gray-500">Preparing secure payment form...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-semibold text-red-800">Unable to Load Payment Form</h3>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <button
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
          <CreditCard className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Add Payment Method</h3>
          <p className="text-sm text-gray-500">Securely add a card or bank account</p>
        </div>
      </div>

      {/* Stripe Provider with SetupIntent */}
      <StripeProvider options={{ clientSecret: clientSecret }}>
        <AddPaymentMethodForm
          clientSecret={clientSecret}
          setAsDefault={setAsDefault}
          showCancel={showCancel}
          submitLabel={submitLabel}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />
      </StripeProvider>

      {/* Security badges */}
      <div className="flex items-center justify-center gap-6 border-t border-gray-200 pt-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Shield className="h-4 w-4" />
          <span>PCI Compliant</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="h-4 w-4" />
          <span>256-bit SSL</span>
        </div>
        <img
          alt="Powered by Stripe"
          className="h-6"
          src="https://cdn.brandfolder.io/KGT2DTA4/at/8vbr8k4mr5k9w5vbptbrf6h/Powered_by_Stripe_-_blurple.svg"
        />
      </div>
    </div>
  );
}

export default AddPaymentMethod;
