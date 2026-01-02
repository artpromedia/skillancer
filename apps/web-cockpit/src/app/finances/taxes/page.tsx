'use client';

/**
 * Tax Center Page
 * Tax vault, estimates, quarterly payments, and tax planning
 * Sprint M5: Freelancer Financial Services
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PiggyBank,
  Calculator,
  Calendar,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Check,
  ChevronRight,
  Info,
  Download,
  FileText,
  ExternalLink,
  Settings,
  Plus,
  Minus,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TaxVault {
  balance: number;
  savingsRate: number;
  autoSaveEnabled: boolean;
  totalSavedThisYear: number;
  targetQuarterly: number;
}

interface TaxEstimate {
  year: number;
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  federalTax: number;
  selfEmploymentTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  quarterlyPayment: number;
}

interface QuarterlyPayment {
  quarter: number;
  dueDate: string;
  estimatedAmount: number;
  paidAmount: number;
  status: 'paid' | 'partial' | 'due' | 'overdue' | 'upcoming';
  daysUntilDue: number;
}

interface TaxVaultTransaction {
  id: string;
  type: 'auto_save' | 'manual_deposit' | 'quarterly_payment' | 'withdrawal';
  amount: number;
  description: string;
  createdAt: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockVault: TaxVault = {
  balance: 4125.0,
  savingsRate: 25,
  autoSaveEnabled: true,
  totalSavedThisYear: 8750.0,
  targetQuarterly: 5000.0,
};

const mockEstimate: TaxEstimate = {
  year: 2024,
  grossIncome: 85000,
  totalDeductions: 14600,
  taxableIncome: 70400,
  federalTax: 9852,
  selfEmploymentTax: 11998,
  stateTax: 4230,
  totalTax: 26080,
  effectiveRate: 30.7,
  quarterlyPayment: 6520,
};

const mockQuarterly: QuarterlyPayment[] = [
  {
    quarter: 1,
    dueDate: '2024-04-15',
    estimatedAmount: 6520,
    paidAmount: 6520,
    status: 'paid',
    daysUntilDue: -90,
  },
  {
    quarter: 2,
    dueDate: '2024-06-15',
    estimatedAmount: 6520,
    paidAmount: 0,
    status: 'due',
    daysUntilDue: 14,
  },
  {
    quarter: 3,
    dueDate: '2024-09-15',
    estimatedAmount: 6520,
    paidAmount: 0,
    status: 'upcoming',
    daysUntilDue: 105,
  },
  {
    quarter: 4,
    dueDate: '2025-01-15',
    estimatedAmount: 6520,
    paidAmount: 0,
    status: 'upcoming',
    daysUntilDue: 227,
  },
];

const mockTransactions: TaxVaultTransaction[] = [
  {
    id: '1',
    type: 'auto_save',
    amount: 625,
    description: 'Auto-save from TechCorp payment',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    type: 'auto_save',
    amount: 450,
    description: 'Auto-save from StartupXYZ payment',
    createdAt: '2024-01-10T15:45:00Z',
  },
  {
    id: '3',
    type: 'quarterly_payment',
    amount: -6520,
    description: 'Q1 2024 Estimated Tax Payment',
    createdAt: '2024-04-10T09:00:00Z',
  },
  {
    id: '4',
    type: 'manual_deposit',
    amount: 1000,
    description: 'Manual deposit',
    createdAt: '2024-01-05T14:20:00Z',
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function TaxVaultCard({ vault }: { vault: TaxVault }) {
  const router = useRouter();
  const progress = (vault.balance / vault.targetQuarterly) * 100;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 opacity-80" />
          <span className="text-sm opacity-80">Tax Vault</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-xs">
          {vault.autoSaveEnabled ? (
            <>
              <Check className="h-3 w-3" /> Auto-save {vault.savingsRate}%
            </>
          ) : (
            'Auto-save off'
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-1 text-4xl font-bold">
          ${vault.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-sm opacity-80">Current Balance</div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="opacity-80">Q2 Target Progress</span>
          <span className="font-medium">{Math.min(100, Math.round(progress))}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="mt-1 text-sm opacity-70">
          ${vault.balance.toLocaleString()} of ${vault.targetQuarterly.toLocaleString()} target
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push('/finances/taxes/deposit')}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/20 px-4 py-2 font-medium transition-colors hover:bg-white/30"
        >
          <Plus className="h-4 w-4" />
          Add Funds
        </button>
        <button
          onClick={() => router.push('/finances/taxes/settings')}
          className="rounded-lg bg-white/20 px-4 py-2 transition-colors hover:bg-white/30"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function QuarterlyPayments({
  payments,
  vaultBalance,
}: {
  payments: QuarterlyPayment[];
  vaultBalance: number;
}) {
  const router = useRouter();

  const getStatusColor = (status: QuarterlyPayment['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'partial':
        return 'bg-amber-100 text-amber-700';
      case 'due':
        return 'bg-blue-100 text-blue-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: QuarterlyPayment['status']) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'partial':
        return 'Partial';
      case 'due':
        return 'Due Soon';
      case 'overdue':
        return 'Overdue';
      default:
        return 'Upcoming';
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <h3 className="font-semibold text-gray-900">Quarterly Payments</h3>
        <div className="text-sm text-gray-500">Tax Year 2024</div>
      </div>

      <div className="divide-y divide-gray-100">
        {payments.map((payment) => (
          <div key={payment.quarter} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 font-bold text-gray-700">
                  Q{payment.quarter}
                </div>
                <div>
                  <div className="font-medium text-gray-900">Quarter {payment.quarter}</div>
                  <div className="text-sm text-gray-500">
                    Due{' '}
                    {new Date(payment.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-900">
                  ${payment.estimatedAmount.toLocaleString()}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${getStatusColor(payment.status)}`}
                >
                  {getStatusLabel(payment.status)}
                </span>
              </div>
            </div>

            {payment.status === 'due' && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 p-3">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>Due in {payment.daysUntilDue} days</span>
                </div>
                <button
                  onClick={() => router.push(`/finances/taxes/pay?quarter=${payment.quarter}`)}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Pay Now
                </button>
              </div>
            )}

            {payment.status === 'overdue' && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-red-50 p-3">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>Payment overdue</span>
                </div>
                <button
                  onClick={() => router.push(`/finances/taxes/pay?quarter=${payment.quarter}`)}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Pay Now
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaxEstimateCard({ estimate }: { estimate: TaxEstimate }) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">2024 Tax Estimate</h3>
        </div>
        <button
          onClick={() => router.push('/finances/taxes/calculator')}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          Recalculate
        </button>
      </div>

      <div className="p-4">
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-sm text-gray-600">Gross Income</div>
            <div className="text-lg font-semibold">${estimate.grossIncome.toLocaleString()}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-sm text-gray-600">Deductions</div>
            <div className="text-lg font-semibold text-green-600">
              -${estimate.totalDeductions.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Federal Tax</span>
            <span className="font-medium">${estimate.federalTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Self-Employment Tax</span>
            <span className="font-medium">${estimate.selfEmploymentTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">State Tax</span>
            <span className="font-medium">${estimate.stateTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-3">
            <span className="font-medium text-gray-900">Total Estimated Tax</span>
            <span className="text-lg font-bold">${estimate.totalTax.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-indigo-50 p-3">
          <div>
            <div className="text-sm text-indigo-700">Quarterly Payment</div>
            <div className="text-lg font-bold text-indigo-900">
              ${estimate.quarterlyPayment.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-indigo-700">Effective Rate</div>
            <div className="text-lg font-bold text-indigo-900">{estimate.effectiveRate}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VaultTransactions({ transactions }: { transactions: TaxVaultTransaction[] }) {
  const router = useRouter();

  const getIcon = (type: TaxVaultTransaction['type']) => {
    switch (type) {
      case 'auto_save':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'manual_deposit':
        return <Plus className="h-4 w-4 text-blue-600" />;
      case 'quarterly_payment':
        return <FileText className="h-4 w-4 text-purple-600" />;
      case 'withdrawal':
        return <Minus className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <h3 className="font-semibold text-gray-900">Tax Vault Activity</h3>
        <button
          onClick={() => router.push('/finances/taxes/transactions')}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          View All
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {transactions.slice(0, 5).map((tx) => (
          <div key={tx.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gray-100 p-2">{getIcon(tx.type)}</div>
              <div>
                <div className="font-medium text-gray-900">{tx.description}</div>
                <div className="text-sm text-gray-500">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaxResources() {
  const resources = [
    {
      title: 'IRS EFTPS',
      description: 'Pay federal estimated taxes online',
      url: 'https://www.eftps.gov',
    },
    {
      title: 'IRS Direct Pay',
      description: 'Free IRS payment system',
      url: 'https://www.irs.gov/payments/direct-pay',
    },
    {
      title: 'Form 1040-ES',
      description: 'Estimated tax form and instructions',
      url: 'https://www.irs.gov/forms-pubs/about-form-1040-es',
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <h3 className="font-semibold text-gray-900">Tax Resources</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {resources.map((resource) => (
          <a
            key={resource.title}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div>
              <div className="font-medium text-gray-900">{resource.title}</div>
              <div className="text-sm text-gray-500">{resource.description}</div>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </a>
        ))}
      </div>
    </div>
  );
}

function TaxSavingsRecommendation() {
  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
      <div className="flex gap-3">
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div>
          <h4 className="mb-1 font-medium text-amber-900">Savings Rate Recommendation</h4>
          <p className="mb-3 text-sm text-amber-800">
            Based on your income of $85,000 and effective tax rate of 30.7%, we recommend saving
            <strong> 31%</strong> of your earnings. You're currently saving 25%.
          </p>
          <button className="text-sm font-medium text-amber-700 hover:text-amber-800">
            Update Savings Rate →
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function TaxesPage() {
  const router = useRouter();
  const [vault, setVault] = useState<TaxVault | null>(null);
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [quarterly, setQuarterly] = useState<QuarterlyPayment[]>([]);
  const [transactions, setTransactions] = useState<TaxVaultTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setVault(mockVault);
      setEstimate(mockEstimate);
      setQuarterly(mockQuarterly);
      setTransactions(mockTransactions);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  const nextDuePayment = quarterly.find((q) => q.status === 'due' || q.status === 'overdue');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/finances')}
            className="mb-4 flex items-center gap-1 text-gray-500 hover:text-gray-700"
          >
            ← Back to Finances
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Tax Center</h1>
          <p className="text-gray-500">Manage your tax savings and estimated payments</p>
        </div>

        {/* Alert Banner */}
        {nextDuePayment && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <span className="font-medium text-blue-900">
                  Q{nextDuePayment.quarter} estimated tax payment due in{' '}
                  {nextDuePayment.daysUntilDue} days
                </span>
                <span className="ml-2 text-blue-700">
                  (${nextDuePayment.estimatedAmount.toLocaleString()})
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push(`/finances/taxes/pay?quarter=${nextDuePayment.quarter}`)}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Pay Now
            </button>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            <TaxVaultCard vault={vault!} />
            <TaxSavingsRecommendation />
            <QuarterlyPayments payments={quarterly} vaultBalance={vault!.balance} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <TaxEstimateCard estimate={estimate!} />
            <VaultTransactions transactions={transactions} />
            <TaxResources />
          </div>
        </div>
      </div>
    </div>
  );
}
