'use client';

/**
 * PaymentMethodSelector Component
 *
 * Combined component for selecting from existing payment methods
 * or adding a new one. Used in checkout/contract flows.
 */

import { Plus, CreditCard } from 'lucide-react';
import { useState, useCallback } from 'react';

import { usePaymentMethods, type PaymentMethod } from '@/hooks/use-payment-methods';

import { AddPaymentMethod } from './AddPaymentMethod';
import { PaymentMethodList } from './PaymentMethodList';

// ============================================================================
// Types
// ============================================================================

interface PaymentMethodSelectorProps {
  onSelect: (paymentMethod: PaymentMethod) => void;
  selectedId?: string;
  required?: boolean;
  label?: string;
  description?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PaymentMethodSelector({
  onSelect,
  selectedId,
  required = false,
  label = 'Payment Method',
  description,
}: PaymentMethodSelectorProps) {
  const { paymentMethods, hasPaymentMethod, isLoading, defaultPaymentMethod } = usePaymentMethods();
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-select default payment method if none selected
  const handlePaymentMethodAdded = useCallback(
    (paymentMethodId: string) => {
      setShowAddForm(false);
      // Find the newly added payment method
      // Note: We need to refetch or use the returned data
      // For now, we'll wait for the list to update
      setTimeout(() => {
        const newMethod = paymentMethods.find((m) => m.stripePaymentMethodId === paymentMethodId);
        if (newMethod) {
          onSelect(newMethod);
        }
      }, 500);
    },
    [paymentMethods, onSelect]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {hasPaymentMethod && !showAddForm && (
          <button
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            type="button"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add New
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <AddPaymentMethod
            setAsDefault={!hasPaymentMethod}
            showCancel={hasPaymentMethod}
            onCancel={() => setShowAddForm(false)}
            onSuccess={handlePaymentMethodAdded}
          />
        </div>
      )}

      {/* Payment Methods List or Empty State */}
      {!showAddForm && (
        <>
          {hasPaymentMethod ? (
            <PaymentMethodList
              compact
              selectedId={selectedId}
              showActions={false}
              onSelect={onSelect}
            />
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-6">
              <div className="text-center">
                <CreditCard className="mx-auto h-10 w-10 text-gray-400" />
                <h3 className="mt-3 text-sm font-medium text-gray-900">Add a payment method</h3>
                <p className="mt-1 text-sm text-gray-500">
                  You need to add a payment method to continue.
                </p>
                <button
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  type="button"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Payment Method
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hidden input for form validation */}
      {required && <input required name="paymentMethodId" type="hidden" value={selectedId ?? ''} />}
    </div>
  );
}

export default PaymentMethodSelector;
