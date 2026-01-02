'use client';

/**
 * Deductions Tracker Page
 * Expense categorization, mileage log, and tax impact
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import {
  Receipt,
  Car,
  Home,
  Laptop,
  BookOpen,
  Plane,
  Coffee,
  Heart,
  Plus,
  TrendingUp,
  DollarSign,
  Calendar,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface DeductionCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  ytdTotal: number;
  lastYearTotal: number;
  count: number;
}

interface Deduction {
  id: string;
  categoryId: string;
  description: string;
  amount: number;
  date: string;
  hasReceipt: boolean;
}

interface MileageEntry {
  id: string;
  date: string;
  purpose: string;
  startLocation: string;
  endLocation: string;
  miles: number;
  deduction: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const IRS_MILEAGE_RATE_2024 = 0.67; // $0.67/mile for 2024

const mockCategories: DeductionCategory[] = [
  {
    id: 'software',
    name: 'Software & Tools',
    icon: <Laptop className="h-5 w-5" />,
    color: 'bg-blue-500',
    ytdTotal: 2400,
    lastYearTotal: 1800,
    count: 24,
  },
  {
    id: 'equipment',
    name: 'Hardware & Equipment',
    icon: <Laptop className="h-5 w-5" />,
    color: 'bg-purple-500',
    ytdTotal: 3500,
    lastYearTotal: 2000,
    count: 8,
  },
  {
    id: 'home_office',
    name: 'Home Office',
    icon: <Home className="h-5 w-5" />,
    color: 'bg-green-500',
    ytdTotal: 4800,
    lastYearTotal: 4200,
    count: 12,
  },
  {
    id: 'education',
    name: 'Professional Development',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-amber-500',
    ytdTotal: 1200,
    lastYearTotal: 800,
    count: 6,
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: <Plane className="h-5 w-5" />,
    color: 'bg-sky-500',
    ytdTotal: 2800,
    lastYearTotal: 3500,
    count: 15,
  },
  {
    id: 'meals',
    name: 'Meals (50%)',
    icon: <Coffee className="h-5 w-5" />,
    color: 'bg-orange-500',
    ytdTotal: 600,
    lastYearTotal: 450,
    count: 42,
  },
  {
    id: 'health',
    name: 'Health Insurance',
    icon: <Heart className="h-5 w-5" />,
    color: 'bg-red-500',
    ytdTotal: 7200,
    lastYearTotal: 6800,
    count: 12,
  },
  {
    id: 'mileage',
    name: 'Mileage',
    icon: <Car className="h-5 w-5" />,
    color: 'bg-gray-500',
    ytdTotal: 1340,
    lastYearTotal: 980,
    count: 45,
  },
];

const mockDeductions: Deduction[] = [
  {
    id: '1',
    categoryId: 'software',
    description: 'Figma Pro Annual',
    amount: 144,
    date: '2024-01-15',
    hasReceipt: true,
  },
  {
    id: '2',
    categoryId: 'software',
    description: 'GitHub Copilot',
    amount: 19,
    date: '2024-01-10',
    hasReceipt: true,
  },
  {
    id: '3',
    categoryId: 'equipment',
    description: 'MacBook Pro M3',
    amount: 2499,
    date: '2024-01-05',
    hasReceipt: true,
  },
  {
    id: '4',
    categoryId: 'meals',
    description: 'Client lunch - TechCorp',
    amount: 85,
    date: '2024-01-08',
    hasReceipt: true,
  },
];

const mockMileage: MileageEntry[] = [
  {
    id: '1',
    date: '2024-01-15',
    purpose: 'Client meeting',
    startLocation: 'Home',
    endLocation: 'TechCorp HQ',
    miles: 25,
    deduction: 16.75,
  },
  {
    id: '2',
    date: '2024-01-12',
    purpose: 'Conference',
    startLocation: 'Home',
    endLocation: 'Convention Center',
    miles: 40,
    deduction: 26.8,
  },
  {
    id: '3',
    date: '2024-01-08',
    purpose: 'Coworking space',
    startLocation: 'Home',
    endLocation: 'WeWork',
    miles: 8,
    deduction: 5.36,
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function CategoryCard({ category }: { category: DeductionCategory }) {
  const change = ((category.ytdTotal - category.lastYearTotal) / category.lastYearTotal) * 100;

  return (
    <div className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
      <div className="mb-3 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${category.color} text-white`}>{category.icon}</div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">{category.name}</div>
          <div className="text-xs text-gray-500">{category.count} expenses</div>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold">${category.ytdTotal.toLocaleString()}</div>
          <div className="text-xs text-gray-500">YTD</div>
        </div>
        <div className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}
          {change.toFixed(0)}% vs last year
        </div>
      </div>
    </div>
  );
}

function RecentExpense({ expense, categoryName }: { expense: Deduction; categoryName: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full ${expense.hasReceipt ? 'bg-green-500' : 'bg-amber-500'}`}
        />
        <div>
          <div className="font-medium text-gray-900">{expense.description}</div>
          <div className="text-sm text-gray-500">
            {categoryName} • {new Date(expense.date).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="font-semibold">${expense.amount.toLocaleString()}</div>
    </div>
  );
}

function MileageLog({ entries, onAddTrip }: { entries: MileageEntry[]; onAddTrip: () => void }) {
  const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);
  const totalDeduction = entries.reduce((sum, e) => sum + e.deduction, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Mileage Log</h3>
        </div>
        <button
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          onClick={onAddTrip}
        >
          <Plus className="h-4 w-4" />
          Add Trip
        </button>
      </div>

      <div className="border-b border-gray-100 bg-gray-50 p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalMiles}</div>
            <div className="text-xs text-gray-500">Total Miles</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">${totalDeduction.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Deduction</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">${IRS_MILEAGE_RATE_2024}</div>
            <div className="text-xs text-gray-500">Per Mile</div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {entries.slice(0, 5).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-gray-900">{entry.purpose}</div>
              <div className="text-sm text-gray-500">
                {entry.startLocation} → {entry.endLocation} •{' '}
                {new Date(entry.date).toLocaleDateString()}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{entry.miles} mi</div>
              <div className="text-sm text-green-600">${entry.deduction.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 p-4">
        <button className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700">
          View All Trips →
        </button>
      </div>
    </div>
  );
}

function TaxImpactCard({
  totalDeductions,
  estimatedTaxRate,
}: {
  totalDeductions: number;
  estimatedTaxRate: number;
}) {
  const taxSavings = totalDeductions * (estimatedTaxRate / 100);

  return (
    <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 opacity-80" />
        <span className="text-sm opacity-80">Tax Impact</span>
      </div>

      <div className="mb-4">
        <div className="text-3xl font-bold">${taxSavings.toLocaleString()}</div>
        <div className="text-sm opacity-80">Estimated Tax Savings</div>
      </div>

      <div className="rounded-lg bg-white/20 p-3">
        <div className="text-sm opacity-90">
          Your ${totalDeductions.toLocaleString()} in deductions at a {estimatedTaxRate}% tax rate
          saves you approximately ${taxSavings.toLocaleString()} in taxes.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DeductionsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<DeductionCategory[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Deduction[]>([]);
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setCategories(mockCategories);
      setRecentExpenses(mockDeductions);
      setMileageEntries(mockMileage);
      setLoading(false);
    }, 300);
  }, []);

  const totalDeductions = categories.reduce((sum, c) => sum + c.ytdTotal, 0);
  const estimatedTaxRate = 30; // Simplified

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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button
              className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              onClick={() => router.push('/finances/taxes')}
            >
              ← Back to Tax Center
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Deductions Tracker</h1>
            <p className="text-gray-500">Track expenses and maximize your deductions</p>
          </div>

          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            onClick={() => setShowAddExpense(true)}
          >
            <Plus className="h-5 w-5" />
            Add Expense
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Categories */}
          <div className="space-y-6 lg:col-span-2">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Total Deductions</div>
                <div className="text-2xl font-bold text-gray-900">
                  ${totalDeductions.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Categories</div>
                <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Total Expenses</div>
                <div className="text-2xl font-bold text-gray-900">
                  {categories.reduce((sum, c) => sum + c.count, 0)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Est. Tax Savings</div>
                <div className="text-2xl font-bold text-green-600">
                  ${(totalDeductions * 0.3).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Categories Grid */}
            <div>
              <h2 className="mb-4 font-semibold text-gray-900">Deduction Categories</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {categories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900">Recent Expenses</h3>
                <button className="text-sm text-indigo-600 hover:text-indigo-700">View All</button>
              </div>
              <div className="p-4">
                {recentExpenses.map((expense) => (
                  <RecentExpense
                    key={expense.id}
                    categoryName={categories.find((c) => c.id === expense.categoryId)?.name || ''}
                    expense={expense}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <TaxImpactCard estimatedTaxRate={estimatedTaxRate} totalDeductions={totalDeductions} />
            <MileageLog entries={mileageEntries} onAddTrip={() => console.log('Add trip')} />
          </div>
        </div>
      </div>
    </div>
  );
}
