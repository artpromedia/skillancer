'use client';

import { cn } from '@skillancer/ui';
import {
  Plus,
  Search,
  Download,
  Upload,
  MoreVertical,
  Receipt,
  Calendar,
  Tag,
  DollarSign,
  CreditCard,
  Briefcase,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Car,
  Camera,
  FileText,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useExpenses, useExpenseSummary } from '@/hooks/api/use-expenses';
import type {
  Expense,
  ExpenseStatus as ApiExpenseStatus,
} from '@/lib/api/services/expenses';

// Display category type for UI styling
type DisplayExpenseCategory =
  | 'software'
  | 'hardware'
  | 'cloud'
  | 'professional'
  | 'marketing'
  | 'office'
  | 'travel'
  | 'meals'
  | 'education'
  | 'mileage'
  | 'other';

const categoryConfig: Record<
  DisplayExpenseCategory,
  { label: string; color: string; icon: React.ElementType }
> = {
  software: { label: 'Software & Tools', color: 'bg-blue-100 text-blue-700', icon: FileText },
  hardware: { label: 'Hardware', color: 'bg-purple-100 text-purple-700', icon: CreditCard },
  cloud: { label: 'Cloud & Hosting', color: 'bg-cyan-100 text-cyan-700', icon: Tag },
  professional: {
    label: 'Professional Services',
    color: 'bg-indigo-100 text-indigo-700',
    icon: Briefcase,
  },
  marketing: { label: 'Marketing', color: 'bg-pink-100 text-pink-700', icon: TrendingUp },
  office: { label: 'Office Expenses', color: 'bg-gray-100 text-gray-700', icon: FileText },
  travel: { label: 'Travel', color: 'bg-amber-100 text-amber-700', icon: Car },
  meals: { label: 'Meals & Entertainment', color: 'bg-orange-100 text-orange-700', icon: Receipt },
  education: { label: 'Education', color: 'bg-green-100 text-green-700', icon: FileText },
  mileage: { label: 'Mileage', color: 'bg-teal-100 text-teal-700', icon: Car },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-600', icon: Tag },
};

const statusConfig: Record<
  ApiExpenseStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  reimbursed: { label: 'Reimbursed', color: 'bg-blue-100 text-blue-700', icon: DollarSign },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const tabs = [
  { id: 'all', label: 'All Expenses' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'deductible', label: 'Tax Deductible' },
];

/**
 * Resolve an API expense category to a display category key for styling.
 */
function getDisplayCategoryKey(expense: Expense): DisplayExpenseCategory {
  const name = (expense.category?.name ?? '').toLowerCase();
  if (name.includes('software') || name.includes('tool')) return 'software';
  if (name.includes('hardware')) return 'hardware';
  if (name.includes('cloud') || name.includes('hosting')) return 'cloud';
  if (name.includes('professional')) return 'professional';
  if (name.includes('marketing')) return 'marketing';
  if (name.includes('office')) return 'office';
  if (name.includes('travel')) return 'travel';
  if (name.includes('meal') || name.includes('entertainment')) return 'meals';
  if (name.includes('education')) return 'education';
  if (name.includes('mileage')) return 'mileage';
  return 'other';
}

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DisplayExpenseCategory | 'all'>('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: expensesResponse, isLoading, error } = useExpenses();
  const { data: summaryResponse } = useExpenseSummary();

  const expenses: Expense[] = expensesResponse?.data ?? [];
  const summary = summaryResponse?.data;

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    const matchesTab =
      activeTab === 'all' ||
      expense.status === activeTab ||
      (activeTab === 'deductible' && expense.taxDeductible);
    const matchesSearch =
      expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || getDisplayCategoryKey(expense) === selectedCategory;
    return matchesTab && matchesSearch && matchesCategory;
  });

  // Stats from API summary
  const totalExpenses = summary?.totalAmount ?? 0;
  const thisMonthExpenses = summary?.byMonth?.[summary.byMonth.length - 1]?.amount ?? totalExpenses;
  const deductibleAmount = summary?.taxDeductibleAmount ?? 0;
  const pendingCount = summary?.byStatus?.pending?.count ?? 0;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <h3 className="text-lg font-medium text-red-800">Failed to load expenses</h3>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500">Track and manage your business expenses</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50">
            <Camera className="h-5 w-5" />
            Scan Receipt
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-5 w-5" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            This Month
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${thisMonthExpenses.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-green-600">
            <TrendingDown className="h-3 w-3" />
            12% less than last month
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Receipt className="h-4 w-4" />
            YTD Total
          </div>
          <div className="text-2xl font-bold text-gray-900">${totalExpenses.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Tag className="h-4 w-4" />
            Tax Deductible
          </div>
          <div className="text-2xl font-bold text-green-600">
            ${deductibleAmount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Pending Review
          </div>
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search expenses..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DisplayExpenseCategory | 'all')}
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Receipt
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredExpenses.map((expense) => {
              const displayCategoryKey = getDisplayCategoryKey(expense);
              const catConfig = categoryConfig[displayCategoryKey];
              const CategoryIcon = catConfig.icon;
              const expenseStatusEntry = statusConfig[expense.status] ?? statusConfig.pending;
              const StatusIcon = expenseStatusEntry.icon;
              const hasReceipt = (expense.receipts?.length ?? 0) > 0;

              return (
                <tr key={expense.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{formatDate(expense.date)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{expense.description}</div>
                      <div className="text-sm text-gray-500">{expense.vendor}</div>
                      {expense.projectId && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600">
                          <Briefcase className="h-3 w-3" />
                          {expense.projectId}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        catConfig.color
                      )}
                    >
                      <CategoryIcon className="h-3.5 w-3.5" />
                      {expense.category?.name ?? catConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-900">
                      ${expense.amount.toLocaleString()}
                    </div>
                    {expense.taxDeductible && (
                      <span className="text-xs text-green-600">Tax Deductible</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        expenseStatusEntry.color
                      )}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {expenseStatusEntry.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {hasReceipt ? (
                      <button className="rounded-full bg-green-50 p-1.5 text-green-600 transition-colors hover:bg-green-100">
                        <Receipt className="h-4 w-4" />
                      </button>
                    ) : (
                      <button className="rounded-full bg-gray-50 p-1.5 text-gray-400 transition-colors hover:bg-gray-100">
                        <Upload className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative">
                      <button
                        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                        onClick={() => setActiveMenu(activeMenu === expense.id ? null : expense.id)}
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>

                      {activeMenu === expense.id && (
                        <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Eye className="h-4 w-4" />
                            View Details
                          </button>
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Receipt className="h-4 w-4" />
                            {hasReceipt ? 'View Receipt' : 'Attach Receipt'}
                          </button>
                          <hr className="my-1 border-gray-100" />
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredExpenses.length === 0 && (
          <div className="p-12 text-center">
            <Receipt className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No expenses found</h3>
            <p className="mb-4 text-gray-500">
              {searchQuery ? 'Try adjusting your search' : 'Start tracking your business expenses'}
            </p>
            {!searchQuery && (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-5 w-5" />
                Add Expense
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-300"
          href="/expenses/receipts"
        >
          <div className="rounded-lg bg-amber-100 p-3">
            <Camera className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Receipt Scanner</div>
            <div className="text-sm text-gray-500">Auto-extract expense data</div>
          </div>
        </Link>
        <Link
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-300"
          href="/expenses/mileage"
        >
          <div className="rounded-lg bg-teal-100 p-3">
            <Car className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Mileage Tracker</div>
            <div className="text-sm text-gray-500">Log business miles</div>
          </div>
        </Link>
        <Link
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-300"
          href="/finances/reports"
        >
          <div className="rounded-lg bg-indigo-100 p-3">
            <FileText className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Expense Reports</div>
            <div className="text-sm text-gray-500">Generate summaries</div>
          </div>
        </Link>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Expense</h2>
              <button
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-gray-500">Expense form coming soon...</p>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                onClick={() => setShowAddModal(false)}
              >
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
