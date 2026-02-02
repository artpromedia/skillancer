'use client';

/**
 * PaymentMethodList Component
 *
 * Displays saved payment methods with options to set default or remove.
 */

import {
  CreditCard,
  Building2,
  Star,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  MoreVertical,
} from 'lucide-react';
import { useState, useCallback } from 'react';

import { usePaymentMethods, type PaymentMethod } from '@/hooks/use-payment-methods';

// ============================================================================
// Types
// ============================================================================

interface PaymentMethodListProps {
  onSelect?: (paymentMethod: PaymentMethod) => void;
  selectedId?: string;
  showActions?: boolean;
  compact?: boolean;
}

interface PaymentMethodItemProps {
  paymentMethod: PaymentMethod;
  isSelected?: boolean;
  onSelect?: () => void;
  onSetDefault: () => Promise<void>;
  onRemove: () => Promise<void>;
  showActions?: boolean;
  compact?: boolean;
}

// ============================================================================
// Card Brand Icons/Colors
// ============================================================================

const cardBrandColors: Record<string, { bg: string; text: string }> = {
  visa: { bg: 'bg-blue-100', text: 'text-blue-700' },
  mastercard: { bg: 'bg-orange-100', text: 'text-orange-700' },
  amex: { bg: 'bg-blue-100', text: 'text-blue-800' },
  discover: { bg: 'bg-orange-100', text: 'text-orange-600' },
  default: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

function getCardBrandStyle(brand: string) {
  return cardBrandColors[brand.toLowerCase()] ?? cardBrandColors.default;
}

function formatCardBrand(brand: string): string {
  const brandNames: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return brandNames[brand.toLowerCase()] ?? brand;
}

// ============================================================================
// PaymentMethodItem Component
// ============================================================================

function PaymentMethodItem({
  paymentMethod,
  isSelected,
  onSelect,
  onSetDefault,
  onRemove,
  showActions = true,
  compact = false,
}: PaymentMethodItemProps) {
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetDefault = async () => {
    setError(null);
    setIsSettingDefault(true);
    try {
      await onSetDefault();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setIsSettingDefault(false);
      setShowMenu(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }
    setError(null);
    setIsRemoving(true);
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setIsRemoving(false);
      setShowMenu(false);
    }
  };

  const isCard = paymentMethod.type === 'card';
  const isBank = paymentMethod.type === 'us_bank_account';

  return (
    <div
      className={`relative rounded-lg border transition-all ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      } ${onSelect ? 'cursor-pointer' : ''} ${compact ? 'p-3' : 'p-4'}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
            isCard ? getCardBrandStyle(paymentMethod.card?.brand ?? '').bg : 'bg-emerald-100'
          }`}
        >
          {isCard ? (
            <CreditCard
              className={`h-5 w-5 ${getCardBrandStyle(paymentMethod.card?.brand ?? '').text}`}
            />
          ) : (
            <Building2 className="h-5 w-5 text-emerald-700" />
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {isCard
                ? formatCardBrand(paymentMethod.card?.brand ?? 'Card')
                : (paymentMethod.bankAccount?.bankName ?? 'Bank Account')}
            </span>
            {paymentMethod.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                <Star className="h-3 w-3" />
                Default
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-sm text-gray-500">
            <span>
              •••• {isCard ? paymentMethod.card?.last4 : paymentMethod.bankAccount?.last4}
            </span>
            {isCard && paymentMethod.card && (
              <span>
                Expires {paymentMethod.card.expMonth.toString().padStart(2, '0')}/
                {paymentMethod.card.expYear.toString().slice(-2)}
              </span>
            )}
          </div>
        </div>

        {/* Selection indicator */}
        {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600" />}

        {/* Actions Menu */}
        {showActions && !isSelected && (
          <div className="relative">
            <button
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                {/* Menu */}
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {!paymentMethod.isDefault && (
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      disabled={isSettingDefault}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSetDefault();
                      }}
                    >
                      {isSettingDefault ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                      Set as Default
                    </button>
                  )}
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isRemoving || paymentMethod.isDefault}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemove();
                    }}
                  >
                    {isRemoving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PaymentMethodList Component
// ============================================================================

export function PaymentMethodList({
  onSelect,
  selectedId,
  showActions = true,
  compact = false,
}: PaymentMethodListProps) {
  const { paymentMethods, isLoading, error, setDefault, removeMethod, hasPaymentMethod } =
    usePaymentMethods();

  const handleSetDefault = useCallback(
    async (paymentMethodId: string) => {
      await setDefault(paymentMethodId);
    },
    [setDefault]
  );

  const handleRemove = useCallback(
    async (paymentMethodId: string) => {
      await removeMethod(paymentMethodId);
    },
    [removeMethod]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-gray-500">Loading payment methods...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
        <p className="mt-2 text-sm text-red-600">Failed to load payment methods: {error.message}</p>
      </div>
    );
  }

  // Empty state
  if (!hasPaymentMethod) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
        <CreditCard className="mx-auto h-10 w-10 text-gray-400" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">No payment methods</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add a payment method to make purchases on Skillancer.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      {paymentMethods.map((method) => (
        <PaymentMethodItem
          key={method.id}
          compact={compact}
          isSelected={selectedId === method.id}
          paymentMethod={method}
          showActions={showActions}
          onRemove={() => handleRemove(method.id)}
          onSelect={onSelect ? () => onSelect(method) : undefined}
          onSetDefault={() => handleSetDefault(method.id)}
        />
      ))}
    </div>
  );
}

export default PaymentMethodList;
