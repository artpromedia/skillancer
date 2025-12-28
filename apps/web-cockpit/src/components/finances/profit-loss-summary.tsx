'use client';

import { cn } from '@skillancer/ui';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  MinusCircle,
  PlusCircle,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import { useState } from 'react';

// Types
interface IncomeCategory {
  id: string;
  name: string;
  amount: number;
  previousAmount?: number;
  subcategories?: { name: string; amount: number }[];
}

interface ExpenseCategory {
  id: string;
  name: string;
  amount: number;
  previousAmount?: number;
  isDeductible: boolean;
}

interface ProfitLossSummaryProps {
  incomeByClient?: IncomeCategory[];
  incomeByType?: IncomeCategory[];
  incomeByPlatform?: IncomeCategory[];
  expenses?: ExpenseCategory[];
  period?: string;
  previousPeriod?: string;
  className?: string;
}

// Mock data
const mockIncomeByClient: IncomeCategory[] = [
  { id: '1', name: 'Acme Corp', amount: 28500, previousAmount: 24000 },
  { id: '2', name: 'TechStart Inc', amount: 22000, previousAmount: 18500 },
  { id: '3', name: 'Design Studio', amount: 15800, previousAmount: 16200 },
  { id: '4', name: 'Global Enterprises', amount: 12400, previousAmount: 10000 },
  { id: '5', name: 'Other Clients', amount: 8750, previousAmount: 7800 },
];

const mockIncomeByType: IncomeCategory[] = [
  { id: '1', name: 'Web Development', amount: 45000, previousAmount: 38000 },
  { id: '2', name: 'Mobile Development', amount: 22500, previousAmount: 20000 },
  { id: '3', name: 'UI/UX Design', amount: 12500, previousAmount: 14000 },
  { id: '4', name: 'Consulting', amount: 7450, previousAmount: 4500 },
];

const mockIncomeByPlatform: IncomeCategory[] = [
  { id: '1', name: 'Skillancer', amount: 32000, previousAmount: 28000 },
  { id: '2', name: 'Upwork', amount: 28500, previousAmount: 25000 },
  { id: '3', name: 'Direct Clients', amount: 18000, previousAmount: 16500 },
  { id: '4', name: 'Fiverr', amount: 8950, previousAmount: 7000 },
];

const mockExpenses: ExpenseCategory[] = [
  { id: '1', name: 'Software & Tools', amount: 2400, previousAmount: 2200, isDeductible: true },
  { id: '2', name: 'Hardware', amount: 1800, previousAmount: 3500, isDeductible: true },
  { id: '3', name: 'Cloud & Hosting', amount: 1200, previousAmount: 1100, isDeductible: true },
  { id: '4', name: 'Professional Services', amount: 850, previousAmount: 600, isDeductible: true },
  { id: '5', name: 'Marketing', amount: 650, previousAmount: 800, isDeductible: true },
  { id: '6', name: 'Office Expenses', amount: 450, previousAmount: 400, isDeductible: true },
  { id: '7', name: 'Travel', amount: 320, previousAmount: 500, isDeductible: true },
  { id: '8', name: 'Education', amount: 280, previousAmount: 200, isDeductible: true },
];

function getIncomeData(
  view: 'client' | 'type' | 'platform',
  incomeByClient: IncomeCategory[],
  incomeByType: IncomeCategory[],
  incomeByPlatform: IncomeCategory[]
): IncomeCategory[] {
  if (view === 'client') return incomeByClient;
  if (view === 'type') return incomeByType;
  return incomeByPlatform;
}

export function ProfitLossSummary({
  incomeByClient = mockIncomeByClient,
  incomeByType = mockIncomeByType,
  incomeByPlatform = mockIncomeByPlatform,
  expenses = mockExpenses,
  period = 'December 2024',
  _previousPeriod = 'December 2023',
  className,
}: Readonly<ProfitLossSummaryProps>) {
  const [incomeView, setIncomeView] = useState<'client' | 'type' | 'platform'>('client');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['income', 'expenses'])
  );

  // Calculations
  const incomeData = getIncomeData(incomeView, incomeByClient, incomeByType, incomeByPlatform);
  const totalIncome = incomeData.reduce((sum, c) => sum + c.amount, 0);
  const previousIncome = incomeData.reduce((sum, c) => sum + (c.previousAmount || 0), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const previousExpenses = expenses.reduce((sum, e) => sum + (e.previousAmount || 0), 0);
  const deductibleExpenses = expenses
    .filter((e) => e.isDeductible)
    .reduce((sum, e) => sum + e.amount, 0);

  const netProfit = totalIncome - totalExpenses;
  const previousProfit = previousIncome - previousExpenses;
  const profitMargin = (netProfit / totalIncome) * 100;
  const previousMargin = previousIncome > 0 ? (previousProfit / previousIncome) * 100 : 0;

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatChange = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return (
      <span
        className={cn(
          'flex items-center gap-1 text-xs',
          change >= 0 ? 'text-green-600' : 'text-red-600'
        )}
      >
        {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div>
          <h3 className="font-semibold text-gray-900">Profit & Loss Summary</h3>
          <p className="text-sm text-gray-500">{period}</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 border-b border-gray-100 bg-gray-50 p-4 md:grid-cols-4">
        <div>
          <div className="mb-1 text-sm text-gray-500">Total Income</div>
          <div className="text-xl font-bold text-green-600">${totalIncome.toLocaleString()}</div>
          {formatChange(totalIncome, previousIncome)}
        </div>
        <div>
          <div className="mb-1 text-sm text-gray-500">Total Expenses</div>
          <div className="text-xl font-bold text-red-600">${totalExpenses.toLocaleString()}</div>
          {formatChange(totalExpenses, previousExpenses)}
        </div>
        <div>
          <div className="mb-1 text-sm text-gray-500">Net Profit</div>
          <div
            className={cn('text-xl font-bold', netProfit >= 0 ? 'text-gray-900' : 'text-red-600')}
          >
            ${netProfit.toLocaleString()}
          </div>
          {formatChange(netProfit, previousProfit)}
        </div>
        <div>
          <div className="mb-1 text-sm text-gray-500">Profit Margin</div>
          <div className="text-xl font-bold text-gray-900">{profitMargin.toFixed(1)}%</div>
          {previousMargin > 0 && (
            <span
              className={cn(
                'text-xs',
                profitMargin >= previousMargin ? 'text-green-600' : 'text-red-600'
              )}
            >
              {profitMargin >= previousMargin ? '↑' : '↓'}{' '}
              {Math.abs(profitMargin - previousMargin).toFixed(1)}pp
            </span>
          )}
        </div>
      </div>

      {/* Income Section */}
      <div className="border-b border-gray-100">
        <button
          className="flex w-full items-center justify-between p-4 hover:bg-gray-50"
          onClick={() => toggleSection('income')}
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-gray-900">Income</span>
            <span className="font-semibold text-green-600">${totalIncome.toLocaleString()}</span>
          </div>
          {expandedSections.has('income') ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('income') && (
          <div className="px-4 pb-4">
            {/* Income View Toggle */}
            <div className="mb-4 flex gap-2">
              {(
                [
                  { id: 'client', label: 'By Client' },
                  { id: 'type', label: 'By Type' },
                  { id: 'platform', label: 'By Platform' },
                ] as const
              ).map((view) => (
                <button
                  key={view.id}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    incomeView === view.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  onClick={() => setIncomeView(view.id)}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {/* Income List */}
            <div className="space-y-2">
              {incomeData.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
                >
                  <span className="text-gray-700">{item.name}</span>
                  <div className="flex items-center gap-4">
                    {item.previousAmount && (
                      <span className="text-sm text-gray-400">
                        ${item.previousAmount.toLocaleString()}
                      </span>
                    )}
                    <span className="font-medium text-gray-900">
                      ${item.amount.toLocaleString()}
                    </span>
                    {formatChange(item.amount, item.previousAmount || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expenses Section */}
      <div>
        <button
          className="flex w-full items-center justify-between p-4 hover:bg-gray-50"
          onClick={() => toggleSection('expenses')}
        >
          <div className="flex items-center gap-2">
            <MinusCircle className="h-5 w-5 text-red-500" />
            <span className="font-medium text-gray-900">Expenses</span>
            <span className="font-semibold text-red-600">${totalExpenses.toLocaleString()}</span>
          </div>
          {expandedSections.has('expenses') ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('expenses') && (
          <div className="px-4 pb-4">
            <div className="mb-3 text-xs text-gray-500">
              Tax Deductible: ${deductibleExpenses.toLocaleString()}
            </div>
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">{expense.name}</span>
                    {expense.isDeductible && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                        Deductible
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {expense.previousAmount && (
                      <span className="text-sm text-gray-400">
                        ${expense.previousAmount.toLocaleString()}
                      </span>
                    )}
                    <span className="font-medium text-gray-900">
                      ${expense.amount.toLocaleString()}
                    </span>
                    {formatChange(expense.amount, expense.previousAmount || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Net Profit Bar */}
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-600" />
            <span className="font-semibold text-gray-900">Net Profit</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">${previousProfit.toLocaleString()}</span>
            <span
              className={cn(
                'text-xl font-bold',
                netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              ${netProfit.toLocaleString()}
            </span>
            {formatChange(netProfit, previousProfit)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfitLossSummary;
