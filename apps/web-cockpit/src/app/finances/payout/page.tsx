'use client';

/**
 * Instant Payout Page
 * Request instant or standard payouts to bank or Skillancer card
 * Sprint M5: Freelancer Financial Services
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Clock,
  CreditCard,
  Building,
  ChevronRight,
  Check,
  AlertCircle,
  Info,
  ArrowRight,
  Shield,
  Wallet,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PayoutOption {
  id: string;
  type: 'instant_card' | 'instant_bank' | 'standard';
  label: string;
  description: string;
  speed: string;
  feePercent: number;
  feeFixed: number;
  icon: React.ElementType;
  available: boolean;
}

interface PayoutDestination {
  id: string;
  type: 'skillancer_card' | 'debit_card' | 'bank_account';
  label: string;
  last4: string;
  brand?: string;
}

interface Balance {
  available: number;
  pending: number;
  currency: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockBalance: Balance = {
  available: 12847.52,
  pending: 3200.0,
  currency: 'USD',
};

const mockDestinations: PayoutDestination[] = [
  { id: '1', type: 'skillancer_card', label: 'Skillancer Card', last4: '4242', brand: 'Visa' },
  { id: '2', type: 'debit_card', label: 'Personal Debit', last4: '8888', brand: 'Mastercard' },
  { id: '3', type: 'bank_account', label: 'Chase Checking', last4: '1234' },
];

const payoutOptions: PayoutOption[] = [
  {
    id: 'instant_card',
    type: 'instant_card',
    label: 'Instant to Skillancer Card',
    description: 'Funds arrive in seconds',
    speed: 'Seconds',
    feePercent: 1.0,
    feeFixed: 0,
    icon: CreditCard,
    available: true,
  },
  {
    id: 'instant_bank',
    type: 'instant_bank',
    label: 'Instant to Bank',
    description: 'Funds arrive in minutes',
    speed: '< 30 min',
    feePercent: 1.5,
    feeFixed: 0,
    icon: Zap,
    available: true,
  },
  {
    id: 'standard',
    type: 'standard',
    label: 'Standard Transfer',
    description: 'Free transfer to any account',
    speed: '1-2 business days',
    feePercent: 0,
    feeFixed: 0,
    icon: Clock,
    available: true,
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function BalanceDisplay({ balance }: { balance: Balance }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-5 w-5 opacity-80" />
        <span className="text-sm opacity-80">Available for Payout</span>
      </div>
      <div className="mb-2 text-4xl font-bold">
        ${balance.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
      <div className="text-sm opacity-70">${balance.pending.toLocaleString()} pending</div>
    </div>
  );
}

function AmountInput({
  amount,
  onChange,
  maxAmount,
  fee,
}: {
  amount: string;
  onChange: (value: string) => void;
  maxAmount: number;
  fee: number;
}) {
  const numericAmount = parseFloat(amount) || 0;
  const netAmount = numericAmount - fee;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <label className="mb-2 block text-sm font-medium text-gray-700">Amount to withdraw</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">$</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          min="5"
          max={maxAmount}
          step="0.01"
          className="w-full border-0 py-4 pl-10 pr-4 text-4xl font-bold placeholder-gray-300 focus:ring-0"
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          onClick={() => onChange(maxAmount.toString())}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Withdraw Max (${maxAmount.toLocaleString()})
        </button>
        <div className="text-sm text-gray-500">Min: $5.00</div>
      </div>

      {fee > 0 && numericAmount > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Transfer fee</span>
            <span className="text-gray-900">-${fee.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm font-medium">
            <span className="text-gray-900">You'll receive</span>
            <span className="text-green-600">${netAmount.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PayoutMethodSelector({
  options,
  selected,
  onSelect,
}: {
  options: PayoutOption[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Payout Speed</label>
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id)}
          disabled={!option.available}
          className={`flex w-full items-center justify-between rounded-xl border-2 p-4 transition-all ${
            selected === option.id
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          } ${!option.available ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`rounded-lg p-2 ${
                selected === option.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <option.icon className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-500">{option.description}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {option.feePercent === 0 ? 'Free' : `${option.feePercent}% fee`}
            </div>
            <div className="text-xs text-gray-500">{option.speed}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function DestinationSelector({
  destinations,
  selected,
  onSelect,
  payoutType,
}: {
  destinations: PayoutDestination[];
  selected: string | null;
  onSelect: (id: string) => void;
  payoutType: string | null;
}) {
  const filteredDestinations = destinations.filter((d) => {
    if (payoutType === 'instant_card') {
      return d.type === 'skillancer_card' || d.type === 'debit_card';
    }
    if (payoutType === 'instant_bank') {
      return d.type === 'debit_card';
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Send to</label>
      {filteredDestinations.map((dest) => (
        <button
          key={dest.id}
          onClick={() => onSelect(dest.id)}
          className={`flex w-full items-center justify-between rounded-xl border-2 p-4 transition-all ${
            selected === dest.id
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`rounded-lg p-2 ${
                dest.type === 'skillancer_card'
                  ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {dest.type === 'bank_account' ? (
                <Building className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900">{dest.label}</div>
              <div className="text-sm text-gray-500">
                {dest.brand && `${dest.brand} `}•••• {dest.last4}
              </div>
            </div>
          </div>
          {selected === dest.id && <Check className="h-5 w-5 text-indigo-600" />}
        </button>
      ))}
    </div>
  );
}

function PayoutSummary({
  amount,
  fee,
  destination,
  payoutOption,
  onSubmit,
  loading,
}: {
  amount: number;
  fee: number;
  destination: PayoutDestination | null;
  payoutOption: PayoutOption | null;
  onSubmit: () => void;
  loading: boolean;
}) {
  const netAmount = amount - fee;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 font-semibold text-gray-900">Payout Summary</h3>

      <div className="mb-6 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount</span>
          <span className="font-medium">${amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Fee</span>
          <span className="text-gray-900">-${fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3">
          <span className="font-medium text-gray-900">You receive</span>
          <span className="font-bold text-green-600">${netAmount.toFixed(2)}</span>
        </div>
      </div>

      {destination && payoutOption && (
        <div className="mb-6 space-y-2 rounded-lg bg-gray-50 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">To</span>
            <span className="text-gray-900">
              {destination.label} •••• {destination.last4}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Speed</span>
            <span className="text-gray-900">{payoutOption.speed}</span>
          </div>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={!destination || !payoutOption || amount < 5 || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
        ) : (
          <>
            <Zap className="h-5 w-5" />
            Confirm Payout
          </>
        )}
      </button>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
        <Shield className="h-3 w-3" />
        Secure, encrypted transfer
      </div>
    </div>
  );
}

function SuccessModal({
  amount,
  destination,
  payoutOption,
  onClose,
}: {
  amount: number;
  destination: PayoutDestination;
  payoutOption: PayoutOption;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>

        <h2 className="mb-2 text-2xl font-bold text-gray-900">Payout Initiated!</h2>

        <p className="mb-6 text-gray-600">
          ${amount.toFixed(2)} is on its way to your {destination.label}
        </p>

        <div className="mb-6 rounded-xl bg-gray-50 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-600">Destination</span>
            <span className="font-medium">•••• {destination.last4}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Expected arrival</span>
            <span className="font-medium text-green-600">{payoutOption.speed}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function PayoutPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>('instant_card');
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const payoutOption = payoutOptions.find((o) => o.id === selectedMethod) || null;
  const destination = mockDestinations.find((d) => d.id === selectedDestination) || null;

  const fee = payoutOption
    ? numericAmount * (payoutOption.feePercent / 100) + payoutOption.feeFixed
    : 0;

  // Auto-select first matching destination when method changes
  useEffect(() => {
    if (selectedMethod === 'instant_card') {
      const skillancerCard = mockDestinations.find((d) => d.type === 'skillancer_card');
      if (skillancerCard) setSelectedDestination(skillancerCard.id);
    }
  }, [selectedMethod]);

  const handleSubmit = async () => {
    if (!destination || !payoutOption || numericAmount < 5) return;

    setLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setLoading(false);
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.push('/finances');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-1 text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Get Paid</h1>
          <p className="text-gray-500">Transfer funds to your bank or card</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Left Column - Form */}
          <div className="space-y-6 lg:col-span-3">
            <BalanceDisplay balance={mockBalance} />

            <AmountInput
              amount={amount}
              onChange={setAmount}
              maxAmount={mockBalance.available}
              fee={fee}
            />

            <PayoutMethodSelector
              options={payoutOptions}
              selected={selectedMethod}
              onSelect={setSelectedMethod}
            />

            <DestinationSelector
              destinations={mockDestinations}
              selected={selectedDestination}
              onSelect={setSelectedDestination}
              payoutType={selectedMethod}
            />
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-8">
              <PayoutSummary
                amount={numericAmount}
                fee={fee}
                destination={destination}
                payoutOption={payoutOption}
                onSubmit={handleSubmit}
                loading={loading}
              />

              {/* Info Box */}
              <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex gap-3">
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="text-sm text-blue-800">
                    <p className="mb-1 font-medium">Instant payouts</p>
                    <p className="text-blue-700">
                      Instant payouts to your Skillancer Card have the lowest fees at just 1%.
                      Standard transfers are always free but take 1-2 business days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && destination && payoutOption && (
        <SuccessModal
          amount={numericAmount - fee}
          destination={destination}
          payoutOption={payoutOption}
          onClose={handleSuccessClose}
        />
      )}
    </div>
  );
}
