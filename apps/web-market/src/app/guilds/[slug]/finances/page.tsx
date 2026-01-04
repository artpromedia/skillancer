'use client';

/**
 * Guild Finances Page
 * Sprint M8: Guild & Agency Accounts
 */

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Download,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface TreasuryData {
  balance: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalDistributed: number;
}

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'DISTRIBUTION' | 'FEE';
  amount: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

interface RevenueSplit {
  id: string;
  projectName: string;
  totalAmount: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DISTRIBUTED';
  members: {
    name: string;
    percentage: number;
    amount: number;
  }[];
  createdAt: string;
}

export default function GuildFinancesPage() {
  const params = useParams();
  const guildId = params.slug as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'splits'>('overview');
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [splits, setSplits] = useState<RevenueSplit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (guildId) {
      fetchFinancialData();
    }
  }, [guildId]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [treasuryRes, txRes, splitsRes] = await Promise.all([
        fetch(`/api/guilds/${guildId}/treasury`),
        fetch(`/api/guilds/${guildId}/treasury/transactions`),
        fetch(`/api/guilds/${guildId}/revenue-splits`),
      ]);

      const treasuryData = await treasuryRes.json();
      const txData = await txRes.json();
      const splitsData = await splitsRes.json();

      setTreasury(treasuryData.data);
      setTransactions(txData.data || []);
      setSplits(splitsData.data || []);
    } catch (error) {
      console.error('Failed to fetch financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !treasury) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guild Finances</h1>
            <p className="mt-1 text-gray-600">Manage treasury, transactions, and revenue splits</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Export
            </button>
            <Link
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              href={`/guilds/${guildId}/finances/withdraw`}
            >
              <DollarSign className="h-4 w-4" />
              Withdraw
            </Link>
          </div>
        </div>

        {/* Treasury Overview Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <BalanceCard
            color="green"
            icon={<DollarSign className="h-5 w-5" />}
            label="Available Balance"
            trend={null}
            value={treasury.balance}
          />
          <BalanceCard
            color="blue"
            icon={<TrendingUp className="h-5 w-5" />}
            label="Total Deposited"
            trend="+12% this month"
            value={treasury.totalDeposited}
          />
          <BalanceCard
            color="orange"
            icon={<TrendingDown className="h-5 w-5" />}
            label="Total Withdrawn"
            trend={null}
            value={treasury.totalWithdrawn}
          />
          <BalanceCard
            color="purple"
            icon={<PieChart className="h-5 w-5" />}
            label="Total Distributed"
            trend={null}
            value={treasury.totalDistributed}
          />
        </div>

        {/* Pending Amounts */}
        {(treasury.pendingDeposits > 0 || treasury.pendingWithdrawals > 0) && (
          <div className="mb-8 flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-center gap-6">
              {treasury.pendingDeposits > 0 && (
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-yellow-600" />
                  <span className="text-yellow-800">
                    ${treasury.pendingDeposits.toLocaleString()} pending deposits
                  </span>
                </div>
              )}
              {treasury.pendingWithdrawals > 0 && (
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-yellow-600" />
                  <span className="text-yellow-800">
                    ${treasury.pendingWithdrawals.toLocaleString()} pending withdrawals
                  </span>
                </div>
              )}
            </div>
            <Link
              className="text-sm text-yellow-700 hover:underline"
              href={`/guilds/${guildId}/finances/pending`}
            >
              View Details →
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-8">
            {(['overview', 'transactions', 'splits'] as const).map((tab) => (
              <button
                key={tab}
                className={`border-b-2 pb-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Recent Transactions */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
                <button
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => setActiveTab('transactions')}
                >
                  View All
                </button>
              </div>
              <TransactionList transactions={transactions.slice(0, 5)} />
            </div>

            {/* Active Revenue Splits */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Active Revenue Splits</h2>
                <Link
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  href={`/guilds/${guildId}/finances/splits/new`}
                >
                  <Plus className="h-4 w-4" />
                  New Split
                </Link>
              </div>
              <SplitList splits={splits.filter((s) => s.status !== 'DISTRIBUTED').slice(0, 3)} />
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">All Transactions</h2>
              <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                <Filter className="h-4 w-4" />
                Filter
              </button>
            </div>
            <TransactionList showAll transactions={transactions} />
          </div>
        )}

        {activeTab === 'splits' && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Revenue Splits</h2>
              <Link
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                href={`/guilds/${guildId}/finances/splits/new`}
              >
                <Plus className="h-4 w-4" />
                Create Split
              </Link>
            </div>
            <SplitList showAll splits={splits} />
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceCard({
  icon,
  label,
  value,
  trend,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend: string | null;
  color: 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div
        className={`h-10 w-10 rounded-lg ${colors[color]} mb-3 flex items-center justify-center`}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">${value.toLocaleString()}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {trend && <div className="mt-1 text-xs text-green-600">{trend}</div>}
    </div>
  );
}

function TransactionList({
  transactions,
  showAll = false,
}: {
  transactions: Transaction[];
  showAll?: boolean;
}) {
  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'DEPOSIT':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'WITHDRAWAL':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'DISTRIBUTION':
        return <PieChart className="h-4 w-4 text-blue-500" />;
      case 'FEE':
        return <DollarSign className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  if (transactions.length === 0) {
    return <div className="py-8 text-center text-gray-500">No transactions yet</div>;
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0"
        >
          <div className="flex items-center gap-3">
            {getTypeIcon(tx.type)}
            <div>
              <p className="text-sm font-medium text-gray-900">{tx.description}</p>
              <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-medium ${
                tx.type === 'DEPOSIT' ? 'text-green-600' : 'text-gray-900'
              }`}
            >
              {tx.type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toLocaleString()}
            </span>
            {getStatusIcon(tx.status)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitList({ splits, showAll = false }: { splits: RevenueSplit[]; showAll?: boolean }) {
  const getStatusColor = (status: RevenueSplit['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700';
      case 'PENDING_APPROVAL':
        return 'bg-yellow-100 text-yellow-700';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-700';
      case 'DISTRIBUTED':
        return 'bg-green-100 text-green-700';
    }
  };

  if (splits.length === 0) {
    return <div className="py-8 text-center text-gray-500">No revenue splits</div>;
  }

  return (
    <div className="space-y-4">
      {splits.map((split) => (
        <div key={split.id} className="rounded-lg border border-gray-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">{split.projectName}</h3>
            <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(split.status)}`}>
              {split.status.replace('_', ' ')}
            </span>
          </div>
          <div className="mb-3 text-lg font-bold text-gray-900">
            ${split.totalAmount.toLocaleString()}
          </div>
          <div className="space-y-1">
            {split.members.slice(0, showAll ? undefined : 2).map((member, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{member.name}</span>
                <span className="text-gray-900">
                  {member.percentage}% (${member.amount.toLocaleString()})
                </span>
              </div>
            ))}
            {!showAll && split.members.length > 2 && (
              <p className="text-xs text-gray-500">+{split.members.length - 2} more members</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
