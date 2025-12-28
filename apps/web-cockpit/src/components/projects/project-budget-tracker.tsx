'use client';

import { cn } from '@skillancer/ui';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Receipt,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

// Helper Functions
function getBudgetStatusColor(isOverBudget: boolean, isNearLimit: boolean): string {
  if (isOverBudget) return 'bg-red-500';
  if (isNearLimit) return 'bg-amber-500';
  return 'bg-green-500';
}

// Types
interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
}

interface Expense {
  id: string;
  categoryId: string;
  description: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt?: string;
}

interface ProjectBudgetTrackerProps {
  projectId: string;
  totalBudget: number;
  hourlyRate?: number;
  budgetType: 'fixed' | 'hourly' | 'retainer';
  categories?: BudgetCategory[];
  expenses?: Expense[];
  hoursLogged?: number;
  className?: string;
}

// Mock data
const mockCategories: BudgetCategory[] = [
  { id: '1', name: 'Development', allocated: 5000, spent: 3200, color: '#3B82F6' },
  { id: '2', name: 'Design', allocated: 2000, spent: 1800, color: '#8B5CF6' },
  { id: '3', name: 'Infrastructure', allocated: 1000, spent: 450, color: '#10B981' },
  { id: '4', name: 'Tools & Services', allocated: 500, spent: 320, color: '#F59E0B' },
  { id: '5', name: 'Miscellaneous', allocated: 500, spent: 180, color: '#6B7280' },
];

const mockExpenses: Expense[] = [
  {
    id: '1',
    categoryId: '1',
    description: 'Senior Developer - Week 1',
    amount: 1600,
    date: '2024-12-16',
    status: 'approved',
  },
  {
    id: '2',
    categoryId: '1',
    description: 'Senior Developer - Week 2',
    amount: 1600,
    date: '2024-12-23',
    status: 'approved',
  },
  {
    id: '3',
    categoryId: '2',
    description: 'UI/UX Design Package',
    amount: 1800,
    date: '2024-12-10',
    status: 'approved',
  },
  {
    id: '4',
    categoryId: '3',
    description: 'AWS Hosting - December',
    amount: 250,
    date: '2024-12-01',
    status: 'approved',
  },
  {
    id: '5',
    categoryId: '3',
    description: 'Domain Registration',
    amount: 50,
    date: '2024-12-05',
    status: 'approved',
  },
  {
    id: '6',
    categoryId: '4',
    description: 'Figma Team License',
    amount: 150,
    date: '2024-12-01',
    status: 'approved',
  },
  {
    id: '7',
    categoryId: '4',
    description: 'GitHub Copilot',
    amount: 20,
    date: '2024-12-01',
    status: 'approved',
  },
  {
    id: '8',
    categoryId: '5',
    description: 'Stock Photos',
    amount: 80,
    date: '2024-12-12',
    status: 'approved',
  },
  {
    id: '9',
    categoryId: '3',
    description: 'SSL Certificate',
    amount: 150,
    date: '2024-12-20',
    status: 'pending',
  },
];

function getBudgetTypeText(budgetType: string, hourlyRate?: number): string {
  if (budgetType === 'fixed') return 'Fixed Price';
  if (budgetType === 'hourly') return `$${hourlyRate}/hr`;
  return 'Monthly Retainer';
}

export function ProjectBudgetTracker({
  projectId: _projectId,
  totalBudget,
  hourlyRate,
  budgetType,
  categories = mockCategories,
  expenses = mockExpenses,
  hoursLogged = 45,
  className,
}: Readonly<ProjectBudgetTrackerProps>) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [_showAddExpense, setShowAddExpense] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'expenses' | 'forecast'>('overview');

  // Calculations
  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  const _totalAllocated = categories.reduce((sum, cat) => sum + cat.allocated, 0);
  const remaining = totalBudget - totalSpent;
  const percentUsed = (totalSpent / totalBudget) * 100;
  const isOverBudget = totalSpent > totalBudget;
  const isNearLimit = percentUsed >= 80 && !isOverBudget;

  // Hourly budget calculations
  const hoursRemaining = hourlyRate ? Math.floor(remaining / hourlyRate) : 0;
  const hourlyBudgetUsed = hourlyRate ? hoursLogged * hourlyRate : 0;

  // Filtered expenses
  const filteredExpenses = selectedCategory
    ? expenses.filter((e) => e.categoryId === selectedCategory)
    : expenses;

  const pendingExpenses = expenses.filter((e) => e.status === 'pending');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Budget Overview Header */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            Total Budget
          </div>
          <div className="text-2xl font-bold text-gray-900">${totalBudget.toLocaleString()}</div>
          <div className="mt-1 text-xs text-gray-500">
            {getBudgetTypeText(budgetType, hourlyRate)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <TrendingDown className="h-4 w-4" />
            Spent
          </div>
          <div
            className={cn('text-2xl font-bold', isOverBudget ? 'text-red-600' : 'text-gray-900')}
          >
            ${totalSpent.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-gray-500">{percentUsed.toFixed(1)}% of budget</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="h-4 w-4" />
            Remaining
          </div>
          <div
            className={cn('text-2xl font-bold', isOverBudget ? 'text-red-600' : 'text-green-600')}
          >
            {isOverBudget ? '-' : ''}${Math.abs(remaining).toLocaleString()}
          </div>
          {budgetType === 'hourly' && hourlyRate && (
            <div className="mt-1 text-xs text-gray-500">~{hoursRemaining} hours left</div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Hours Logged
          </div>
          <div className="text-2xl font-bold text-gray-900">{hoursLogged}h</div>
          {budgetType === 'hourly' && hourlyRate && (
            <div className="mt-1 text-xs text-gray-500">
              ${hourlyBudgetUsed.toLocaleString()} earned
            </div>
          )}
        </div>
      </div>

      {/* Budget Alert */}
      {(isOverBudget || isNearLimit) && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl p-4',
            isOverBudget ? 'border border-red-200 bg-red-50' : 'border border-amber-200 bg-amber-50'
          )}
        >
          <AlertTriangle
            className={cn('h-5 w-5', isOverBudget ? 'text-red-600' : 'text-amber-600')}
          />
          <div>
            <p className={cn('font-medium', isOverBudget ? 'text-red-800' : 'text-amber-800')}>
              {isOverBudget ? 'Budget Exceeded!' : 'Approaching Budget Limit'}
            </p>
            <p className={cn('text-sm', isOverBudget ? 'text-red-600' : 'text-amber-600')}>
              {isOverBudget
                ? `You've exceeded the budget by $${Math.abs(remaining).toLocaleString()}`
                : `Only ${(100 - percentUsed).toFixed(1)}% of budget remaining`}
            </p>
          </div>
        </div>
      )}

      {/* Pending Expenses Alert */}
      {pendingExpenses.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Receipt className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <p className="font-medium text-blue-800">
              {pendingExpenses.length} Pending Expense{pendingExpenses.length > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-blue-600">
              ${pendingExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} awaiting
              approval
            </p>
          </div>
          <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800">
            Review
          </button>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['overview', 'expenses', 'forecast'] as const).map((view) => (
          <button
            key={view}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              viewMode === view
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
            onClick={() => setViewMode(view)}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* View Content */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Progress Bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-900">Budget Usage</h3>
            <div className="mb-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall Progress</span>
                <span
                  className={cn('font-medium', isOverBudget ? 'text-red-600' : 'text-gray-900')}
                >
                  {Math.min(percentUsed, 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    getBudgetStatusColor(isOverBudget, isNearLimit)
                  )}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="space-y-3">
              {categories.map((category) => {
                const catPercent = (category.spent / category.allocated) * 100;
                const isOver = category.spent > category.allocated;
                return (
                  <div key={category.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-700">{category.name}</span>
                      <span
                        className={cn('font-medium', isOver ? 'text-red-600' : 'text-gray-600')}
                      >
                        ${category.spent.toLocaleString()} / ${category.allocated.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${Math.min(catPercent, 100)}%`,
                          backgroundColor: isOver ? '#EF4444' : category.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Pie Chart (simplified) */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-900">Spending by Category</h3>
            <div className="mb-4 flex items-center justify-center">
              <div className="relative h-40 w-40">
                {/* Simple donut chart visualization */}
                <svg className="-rotate-90 transform" viewBox="0 0 100 100">
                  {categories.map((category, index) => {
                    const prevPercent = categories
                      .slice(0, index)
                      .reduce((sum, c) => sum + (c.spent / totalSpent) * 100, 0);
                    const catPercent = (category.spent / totalSpent) * 100;
                    const circumference = 2 * Math.PI * 35;
                    const offset = (prevPercent / 100) * circumference;
                    const length = (catPercent / 100) * circumference;

                    return (
                      <circle
                        key={category.id}
                        className="transition-all duration-300"
                        cx="50"
                        cy="50"
                        fill="none"
                        r="35"
                        stroke={category.color}
                        strokeDasharray={`${length} ${circumference - length}`}
                        strokeDashoffset={-offset}
                        strokeWidth="15"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      ${totalSpent.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">spent</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="truncate text-gray-600">{category.name}</span>
                  <span className="ml-auto text-gray-400">
                    {((category.spent / totalSpent) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'expenses' && (
        <div className="rounded-xl border border-gray-200 bg-white">
          {/* Expense Header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              onClick={() => setShowAddExpense(true)}
            >
              <PlusCircle className="h-4 w-4" />
              Add Expense
            </button>
          </div>

          {/* Expenses List */}
          <div className="divide-y divide-gray-100">
            {filteredExpenses.map((expense) => {
              const category = categories.find((c) => c.id === expense.categoryId);
              return (
                <div key={expense.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div
                    className="h-10 w-2 rounded-full"
                    style={{ backgroundColor: category?.color || '#6B7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{expense.description}</p>
                    <p className="text-sm text-gray-500">
                      {category?.name} • {new Date(expense.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${expense.amount.toLocaleString()}
                    </p>
                    <div className="flex items-center justify-end gap-1">
                      {expense.status === 'approved' && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Approved
                        </span>
                      )}
                      {expense.status === 'pending' && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                      {expense.status === 'rejected' && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredExpenses.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Receipt className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="font-medium">No expenses recorded</p>
              <p className="text-sm">Add your first expense to track spending</p>
            </div>
          )}
        </div>
      )}

      {viewMode === 'forecast' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Burn Rate */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-900">Burn Rate Analysis</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-600">Daily Burn Rate</span>
                <span className="font-semibold text-gray-900">
                  ${(totalSpent / 30).toFixed(0)}/day
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-600">Weekly Burn Rate</span>
                <span className="font-semibold text-gray-900">
                  ${((totalSpent / 30) * 7).toFixed(0)}/week
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-gray-600">Days Until Budget Depleted</span>
                <span
                  className={cn(
                    'font-semibold',
                    remaining / (totalSpent / 30) < 14 ? 'text-red-600' : 'text-green-600'
                  )}
                >
                  {remaining > 0 ? Math.floor(remaining / (totalSpent / 30)) : 0} days
                </span>
              </div>
            </div>
          </div>

          {/* Forecast */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-900">Budget Forecast</h3>
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-blue-700">Projected Total Spend</span>
                  <span className="font-semibold text-blue-900">
                    ${(totalSpent * 1.4).toFixed(0).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-blue-600">Based on current burn rate to project end</p>
              </div>

              <div
                className={cn(
                  'rounded-lg p-3',
                  totalSpent * 1.4 > totalBudget ? 'bg-red-50' : 'bg-green-50'
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'font-medium',
                      totalSpent * 1.4 > totalBudget ? 'text-red-700' : 'text-green-700'
                    )}
                  >
                    {totalSpent * 1.4 > totalBudget ? 'Projected Overage' : 'Projected Savings'}
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      totalSpent * 1.4 > totalBudget ? 'text-red-900' : 'text-green-900'
                    )}
                  >
                    ${Math.abs(totalBudget - totalSpent * 1.4).toFixed(0)}
                  </span>
                </div>
                <p
                  className={cn(
                    'text-xs',
                    totalSpent * 1.4 > totalBudget ? 'text-red-600' : 'text-green-600'
                  )}
                >
                  {totalSpent * 1.4 > totalBudget
                    ? 'Consider reducing scope or increasing budget'
                    : 'On track to complete under budget'}
                </p>
              </div>

              <div className="pt-2">
                <p className="text-xs text-gray-500">
                  * Forecasts are estimates based on current spending patterns and may not reflect
                  actual final costs.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectBudgetTracker;
