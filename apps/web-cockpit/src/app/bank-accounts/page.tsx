'use client';

import { cn } from '@skillancer/ui';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  CreditCard,
  Landmark,
  PiggyBank,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Filter,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type AccountType = 'checking' | 'savings' | 'credit' | 'investment';
type ConnectionStatus = 'connected' | 'needs_attention' | 'disconnected';

interface BankAccount {
  id: string;
  institutionName: string;
  institutionLogo?: string;
  accountName: string;
  accountType: AccountType;
  accountMask: string;
  currentBalance: number;
  availableBalance?: number;
  currency: string;
  connectionStatus: ConnectionStatus;
  lastSynced: string;
  isHidden: boolean;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  pending: boolean;
  accountId: string;
}

const accountTypeConfig: Record<
  AccountType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  checking: { label: 'Checking', icon: Building2 },
  savings: { label: 'Savings', icon: PiggyBank },
  credit: { label: 'Credit Card', icon: CreditCard },
  investment: { label: 'Investment', icon: TrendingUp },
};

const statusConfig: Record<ConnectionStatus, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'bg-green-100 text-green-700' },
  needs_attention: { label: 'Needs Attention', color: 'bg-yellow-100 text-yellow-700' },
  disconnected: { label: 'Disconnected', color: 'bg-red-100 text-red-700' },
};

// Mock data
const mockAccounts: BankAccount[] = [
  {
    id: '1',
    institutionName: 'Chase',
    accountName: 'Business Checking',
    accountType: 'checking',
    accountMask: '4521',
    currentBalance: 24560.78,
    availableBalance: 24110.78,
    currency: 'USD',
    connectionStatus: 'connected',
    lastSynced: '2024-01-15T10:30:00Z',
    isHidden: false,
  },
  {
    id: '2',
    institutionName: 'Chase',
    accountName: 'Business Savings',
    accountType: 'savings',
    accountMask: '8832',
    currentBalance: 15000.0,
    currency: 'USD',
    connectionStatus: 'connected',
    lastSynced: '2024-01-15T10:30:00Z',
    isHidden: false,
  },
  {
    id: '3',
    institutionName: 'American Express',
    accountName: 'Business Platinum',
    accountType: 'credit',
    accountMask: '1004',
    currentBalance: -2340.5,
    currency: 'USD',
    connectionStatus: 'connected',
    lastSynced: '2024-01-15T09:45:00Z',
    isHidden: false,
  },
  {
    id: '4',
    institutionName: 'Mercury',
    accountName: 'Startup Account',
    accountType: 'checking',
    accountMask: '7291',
    currentBalance: 8750.0,
    currency: 'USD',
    connectionStatus: 'needs_attention',
    lastSynced: '2024-01-10T14:20:00Z',
    isHidden: false,
  },
];

const mockTransactions: Transaction[] = [
  {
    id: '1',
    date: '2024-01-15',
    description: 'Stripe Transfer',
    amount: 2500.0,
    category: 'Income',
    pending: false,
    accountId: '1',
  },
  {
    id: '2',
    date: '2024-01-15',
    description: 'Adobe Creative Cloud',
    amount: -54.99,
    category: 'Software',
    pending: false,
    accountId: '1',
  },
  {
    id: '3',
    date: '2024-01-14',
    description: 'AWS Services',
    amount: -127.43,
    category: 'Cloud',
    pending: false,
    accountId: '1',
  },
  {
    id: '4',
    date: '2024-01-14',
    description: 'Client Payment - Acme',
    amount: 4500.0,
    category: 'Income',
    pending: true,
    accountId: '1',
  },
  {
    id: '5',
    date: '2024-01-13',
    description: 'Figma',
    amount: -15.0,
    category: 'Software',
    pending: false,
    accountId: '3',
  },
  {
    id: '6',
    date: '2024-01-13',
    description: 'Uber - Client Meeting',
    amount: -32.0,
    category: 'Travel',
    pending: false,
    accountId: '3',
  },
  {
    id: '7',
    date: '2024-01-12',
    description: 'GitHub Copilot',
    amount: -19.0,
    category: 'Software',
    pending: false,
    accountId: '1',
  },
  {
    id: '8',
    date: '2024-01-12',
    description: 'Starbucks',
    amount: -12.5,
    category: 'Meals',
    pending: false,
    accountId: '3',
  },
];

const expenseCategories = [
  'Software',
  'Cloud',
  'Hardware',
  'Travel',
  'Meals',
  'Office',
  'Marketing',
  'Professional',
  'Other',
];

export default function BankAccountsPage() {
  const [accounts, _setAccounts] = useState<BankAccount[]>(mockAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHiddenAccounts, setShowHiddenAccounts] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  const visibleAccounts = accounts.filter((a) => showHiddenAccounts || !a.isHidden);
  const totalBalance = visibleAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalCash = visibleAccounts
    .filter((a) => a.accountType === 'checking' || a.accountType === 'savings')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const totalCredit = visibleAccounts
    .filter((a) => a.accountType === 'credit')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const filteredTransactions = transactions.filter((t) => {
    const matchesAccount = selectedAccount === 'all' || t.accountId === selectedAccount;
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAccount && matchesSearch;
  });

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSyncing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatLastSynced = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
              <p className="text-sm text-gray-500">
                Connect your accounts to automatically track transactions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors',
                  isSyncing ? 'cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'
                )}
                disabled={isSyncing}
                onClick={() => void handleSync()}
              >
                <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                {isSyncing ? 'Syncing...' : 'Sync All'}
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                onClick={() => setShowConnectModal(true)}
              >
                <Plus className="h-4 w-4" />
                Connect Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Balance Summary */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-sm text-gray-500">Net Worth</span>
            </div>
            <p
              className={cn(
                'text-2xl font-bold',
                totalBalance >= 0 ? 'text-gray-900' : 'text-red-600'
              )}
            >
              ${Math.abs(totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Landmark className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Cash</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              ${totalCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2">
                <CreditCard className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-sm text-gray-500">Credit Card Balance</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              ${Math.abs(totalCredit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Accounts List */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h2 className="font-semibold text-gray-900">Accounts</h2>
                <button
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => setShowHiddenAccounts(!showHiddenAccounts)}
                >
                  {showHiddenAccounts ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {/* All Accounts Option */}
                <button
                  className={cn(
                    'flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50',
                    selectedAccount === 'all' && 'bg-indigo-50'
                  )}
                  onClick={() => setSelectedAccount('all')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <Building2 className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">All Accounts</p>
                      <p className="text-sm text-gray-500">{visibleAccounts.length} accounts</p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-gray-400',
                      selectedAccount === 'all' && 'text-indigo-600'
                    )}
                  />
                </button>

                {visibleAccounts.map((account) => {
                  const TypeIcon = accountTypeConfig[account.accountType].icon;
                  return (
                    <button
                      key={account.id}
                      className={cn(
                        'flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50',
                        selectedAccount === account.id && 'bg-indigo-50'
                      )}
                      onClick={() => setSelectedAccount(account.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <TypeIcon className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{account.accountName}</p>
                            {account.connectionStatus !== 'connected' && (
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-xs',
                                  statusConfig[account.connectionStatus].color
                                )}
                              >
                                !
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {account.institutionName} ••{account.accountMask}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-medium',
                            account.currentBalance >= 0 ? 'text-gray-900' : 'text-red-600'
                          )}
                        >
                          $
                          {Math.abs(account.currentBalance).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatLastSynced(account.lastSynced)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
                  <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50">
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Search transactions..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 transition-colors hover:bg-gray-50">
                    <Filter className="h-4 w-4" />
                    Filter
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full',
                          transaction.amount > 0 ? 'bg-green-100' : 'bg-gray-100'
                        )}
                      >
                        {transaction.amount > 0 ? (
                          <ArrowDownLeft className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{transaction.description}</p>
                          {transaction.pending && (
                            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {formatDate(transaction.date)}
                          </span>
                          {transaction.category && (
                            <>
                              <span className="text-gray-300">•</span>
                              {editingCategory === transaction.id ? (
                                <select
                                  className="rounded border border-gray-200 px-1 py-0.5 text-sm"
                                  value={transaction.category}
                                  onBlur={() => setEditingCategory(null)}
                                  onChange={(e) => {
                                    setTransactions(
                                      transactions.map((t) =>
                                        t.id === transaction.id
                                          ? { ...t, category: e.target.value }
                                          : t
                                      )
                                    );
                                    setEditingCategory(null);
                                  }}
                                >
                                  {expenseCategories.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  className="text-sm text-indigo-600 hover:underline"
                                  onClick={() => setEditingCategory(transaction.id)}
                                >
                                  {transaction.category}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p
                      className={cn(
                        'font-medium',
                        transaction.amount > 0 ? 'text-green-600' : 'text-gray-900'
                      )}
                    >
                      {transaction.amount > 0 ? '+' : ''}$
                      {Math.abs(transaction.amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                ))}
              </div>

              {filteredTransactions.length === 0 && (
                <div className="py-12 text-center">
                  <div className="mb-4 inline-block rounded-full bg-gray-100 p-4">
                    <Building2 className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="mb-1 text-lg font-medium text-gray-900">No transactions found</h3>
                  <p className="text-sm text-gray-500">
                    {selectedAccount === 'all'
                      ? 'Connect a bank account to see transactions'
                      : 'No transactions match your search'}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-100 p-4 text-center">
                <Link
                  className="text-sm text-indigo-600 hover:underline"
                  href="/bank-accounts/transactions"
                >
                  View all transactions →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connect Account Modal */}
      {showConnectModal && <ConnectBankModal onClose={() => setShowConnectModal(false)} />}
    </div>
  );
}

// Connect Bank Modal
function ConnectBankModal({ onClose }: Readonly<{ onClose: () => void }>) {
  const [step, setStep] = useState<'select' | 'connecting' | 'success'>('select');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  const banks = [
    { id: 'chase', name: 'Chase', logo: '🏦' },
    { id: 'bofa', name: 'Bank of America', logo: '🏛️' },
    { id: 'wells', name: 'Wells Fargo', logo: '🏦' },
    { id: 'citi', name: 'Citibank', logo: '🏛️' },
    { id: 'amex', name: 'American Express', logo: '💳' },
    { id: 'mercury', name: 'Mercury', logo: '🚀' },
    { id: 'relay', name: 'Relay', logo: '⚡' },
    { id: 'other', name: 'Other Bank', logo: '🏦' },
  ];

  const handleConnect = async () => {
    setStep('connecting');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white">
        {step === 'select' && (
          <>
            <div className="border-b border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900">Connect Bank Account</h2>
              <p className="text-sm text-gray-500">Powered by Plaid for secure connections</p>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search banks..."
                  type="text"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      selectedBank === bank.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    onClick={() => setSelectedBank(bank.id)}
                  >
                    <span className="text-2xl">{bank.logo}</span>
                    <span className="text-sm font-medium text-gray-900">{bank.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 p-4">
              <button
                className="rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={cn(
                  'rounded-lg px-4 py-2 transition-colors',
                  selectedBank
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                )}
                disabled={!selectedBank}
                onClick={() => void handleConnect()}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'connecting' && (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">Connecting to your bank...</h3>
            <p className="text-sm text-gray-500">This may take a few moments</p>
          </div>
        )}

        {step === 'success' && (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">Account Connected!</h3>
            <p className="mb-6 text-sm text-gray-500">Your transactions will sync automatically</p>
            <button
              className="rounded-lg bg-indigo-600 px-6 py-2 text-white transition-colors hover:bg-indigo-700"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
