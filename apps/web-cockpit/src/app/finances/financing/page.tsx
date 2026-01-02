'use client';

/**
 * Invoice Financing Page
 * Get advances on unpaid invoices
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import {
  Banknote,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Calendar,
  Info,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface EligibleInvoice {
  id: string;
  clientName: string;
  clientLogo?: string;
  amount: number;
  dueDate: string;
  invoiceAge: number;
  maxAdvancePercent: number;
  feeRate: number;
  riskScore: number;
}

interface ActiveAdvance {
  id: string;
  clientName: string;
  invoiceAmount: number;
  advanceAmount: number;
  feeAmount: number;
  totalOwed: number;
  amountRepaid: number;
  status: 'funded' | 'partially_repaid' | 'overdue';
  expectedRepaymentDate: string;
  fundedAt: string;
}

interface FinancingStats {
  availableCredit: number;
  creditUsed: number;
  creditLimit: number;
  tier: 'new' | 'standard' | 'preferred' | 'premium';
  totalAdvances: number;
  totalFeesPaid: number;
  avgRepaymentDays: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockStats: FinancingStats = {
  availableCredit: 12500,
  creditUsed: 2500,
  creditLimit: 15000,
  tier: 'standard',
  totalAdvances: 8,
  totalFeesPaid: 425,
  avgRepaymentDays: 14,
};

const mockEligibleInvoices: EligibleInvoice[] = [
  {
    id: 'INV-001',
    clientName: 'TechCorp Inc.',
    amount: 5000,
    dueDate: '2024-02-15',
    invoiceAge: 5,
    maxAdvancePercent: 90,
    feeRate: 0.02,
    riskScore: 85,
  },
  {
    id: 'INV-002',
    clientName: 'StartupXYZ',
    amount: 2500,
    dueDate: '2024-02-20',
    invoiceAge: 3,
    maxAdvancePercent: 85,
    feeRate: 0.03,
    riskScore: 72,
  },
  {
    id: 'INV-003',
    clientName: 'DesignAgency',
    amount: 3500,
    dueDate: '2024-02-25',
    invoiceAge: 7,
    maxAdvancePercent: 80,
    feeRate: 0.035,
    riskScore: 65,
  },
];

const mockActiveAdvances: ActiveAdvance[] = [
  {
    id: 'ADV-001',
    clientName: 'MegaCorp',
    invoiceAmount: 3000,
    advanceAmount: 2500,
    feeAmount: 75,
    totalOwed: 2575,
    amountRepaid: 0,
    status: 'funded',
    expectedRepaymentDate: '2024-02-10',
    fundedAt: '2024-01-25',
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function CreditOverview({ stats }: { stats: FinancingStats }) {
  const usagePercent = (stats.creditUsed / stats.creditLimit) * 100;

  const tierColors = {
    new: 'bg-gray-100 text-gray-700',
    standard: 'bg-blue-100 text-blue-700',
    preferred: 'bg-purple-100 text-purple-700',
    premium: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 opacity-80" />
          <span className="text-sm opacity-80">Invoice Financing</span>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${tierColors[stats.tier]}`}>
          {stats.tier.charAt(0).toUpperCase() + stats.tier.slice(1)} Tier
        </span>
      </div>

      <div className="mb-6">
        <div className="mb-1 text-4xl font-bold">${stats.availableCredit.toLocaleString()}</div>
        <div className="text-sm opacity-80">Available Credit</div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="opacity-80">Credit Used</span>
          <span>
            ${stats.creditUsed.toLocaleString()} / ${stats.creditLimit.toLocaleString()}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-white/20 pt-4">
        <div>
          <div className="text-2xl font-bold">{stats.totalAdvances}</div>
          <div className="text-xs opacity-70">Total Advances</div>
        </div>
        <div>
          <div className="text-2xl font-bold">${stats.totalFeesPaid}</div>
          <div className="text-xs opacity-70">Fees Paid</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{stats.avgRepaymentDays}d</div>
          <div className="text-xs opacity-70">Avg Repayment</div>
        </div>
      </div>
    </div>
  );
}

function EligibleInvoiceCard({
  invoice,
  onSelect,
}: {
  invoice: EligibleInvoice;
  onSelect: () => void;
}) {
  const maxAdvance = Math.floor(invoice.amount * (invoice.maxAdvancePercent / 100));
  const estimatedFee = Math.round(maxAdvance * invoice.feeRate * 100) / 100;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-300">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-900">{invoice.clientName}</div>
          <div className="text-sm text-gray-500">Invoice #{invoice.id}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">${invoice.amount.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{invoice.invoiceAge} days old</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <div className="font-medium text-gray-900">{invoice.maxAdvancePercent}%</div>
          <div className="text-xs text-gray-500">Max Advance</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <div className="font-medium text-gray-900">{(invoice.feeRate * 100).toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Fee Rate</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <div className="font-medium text-green-600">${maxAdvance.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Available</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Fee estimate: <span className="font-medium">${estimatedFee.toLocaleString()}</span>
        </div>
        <button
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          onClick={onSelect}
        >
          <Zap className="h-4 w-4" />
          Get Advance
        </button>
      </div>
    </div>
  );
}

function ActiveAdvanceCard({ advance }: { advance: ActiveAdvance }) {
  const progress = (advance.amountRepaid / advance.totalOwed) * 100;
  const remaining = advance.totalOwed - advance.amountRepaid;

  const statusColors = {
    funded: 'bg-blue-100 text-blue-700',
    partially_repaid: 'bg-amber-100 text-amber-700',
    overdue: 'bg-red-100 text-red-700',
  };

  const statusLabels = {
    funded: 'Active',
    partially_repaid: 'Partial',
    overdue: 'Overdue',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-900">{advance.clientName}</div>
          <div className="text-sm text-gray-500">
            Funded {new Date(advance.fundedAt).toLocaleDateString()}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[advance.status]}`}
        >
          {statusLabels[advance.status]}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-500">Advanced</div>
          <div className="font-semibold">${advance.advanceAmount.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Fee</div>
          <div className="font-semibold">${advance.feeAmount.toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-gray-500">Repayment Progress</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-gray-600">
          <Calendar className="h-4 w-4" />
          Due {new Date(advance.expectedRepaymentDate).toLocaleDateString()}
        </div>
        <div className="font-medium text-gray-900">${remaining.toLocaleString()} remaining</div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: '1️⃣', title: 'Select Invoice', desc: 'Choose an eligible unpaid invoice' },
    { icon: '2️⃣', title: 'Get Advance', desc: 'Receive up to 90% instantly' },
    { icon: '3️⃣', title: 'Client Pays', desc: 'When client pays, advance is repaid' },
    { icon: '4️⃣', title: 'Get Remainder', desc: 'Receive the rest minus fee' },
  ];

  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <h3 className="mb-3 font-semibold text-gray-900">How It Works</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {steps.map((step, i) => (
          <div key={i} className="text-center">
            <div className="mb-1 text-2xl">{step.icon}</div>
            <div className="text-sm font-medium text-gray-900">{step.title}</div>
            <div className="text-xs text-gray-500">{step.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function FinancingPage() {
  const router = useRouter();
  const [stats, setStats] = useState<FinancingStats | null>(null);
  const [eligibleInvoices, setEligibleInvoices] = useState<EligibleInvoice[]>([]);
  const [activeAdvances, setActiveAdvances] = useState<ActiveAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setStats(mockStats);
      setEligibleInvoices(mockEligibleInvoices);
      setActiveAdvances(mockActiveAdvances);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            className="mb-4 flex items-center gap-1 text-gray-500 hover:text-gray-700"
            onClick={() => router.push('/finances')}
          >
            ← Back to Finances
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Financing</h1>
          <p className="text-gray-500">Get paid now for your unpaid invoices</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            <CreditOverview stats={stats!} />

            <HowItWorks />

            {/* Eligible Invoices */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Eligible Invoices ({eligibleInvoices.length})
              </h2>
              {eligibleInvoices.length > 0 ? (
                <div className="space-y-4">
                  {eligibleInvoices.map((invoice) => (
                    <EligibleInvoiceCard
                      key={invoice.id}
                      invoice={invoice}
                      onSelect={() =>
                        router.push(`/finances/financing/request?invoice=${invoice.id}`)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                  <Clock className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                  <h3 className="mb-1 font-medium text-gray-900">No Eligible Invoices</h3>
                  <p className="text-sm text-gray-500">
                    Invoices become eligible once sent to verified clients.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Active Advances */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Active Advances ({activeAdvances.length})
              </h2>
              {activeAdvances.length > 0 ? (
                <div className="space-y-4">
                  {activeAdvances.map((advance) => (
                    <ActiveAdvanceCard key={advance.id} advance={advance} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                  <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
                  <div className="text-sm text-gray-600">No active advances</div>
                </div>
              )}
            </div>

            {/* Info Card */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
                <div className="text-sm">
                  <div className="mb-1 font-medium text-blue-900">How fees work</div>
                  <p className="text-blue-800">
                    Fees are based on client payment history and invoice details. Better clients =
                    lower fees. Repayment happens automatically when your client pays.
                  </p>
                </div>
              </div>
            </div>

            {/* History Link */}
            <button
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
              onClick={() => router.push('/finances/financing/history')}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-900">View Financing History</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
