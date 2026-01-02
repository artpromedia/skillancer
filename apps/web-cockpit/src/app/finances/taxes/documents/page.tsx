'use client';

/**
 * Tax Documents Page
 * 1099s, tax summaries, and export options
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import {
  FileText,
  Download,
  Upload,
  ExternalLink,
  Calendar,
  Check,
  AlertCircle,
  ChevronDown,
  Search,
  Filter,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface TaxDocument {
  id: string;
  type: '1099-K' | '1099-NEC' | '1099-MISC' | 'W-9';
  year: number;
  issuer: string;
  amount: number;
  status: 'available' | 'pending' | 'corrected';
  issuedAt?: string;
  downloadUrl?: string;
}

interface TaxSummary {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  estimatedTaxesPaid: number;
  deductionsTotal: number;
}

interface Integration {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSync?: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockDocuments: TaxDocument[] = [
  { id: '1', type: '1099-K', year: 2024, issuer: 'Skillancer', amount: 85000, status: 'pending' },
  {
    id: '2',
    type: '1099-K',
    year: 2023,
    issuer: 'Skillancer',
    amount: 72000,
    status: 'available',
    issuedAt: '2024-01-25',
    downloadUrl: '#',
  },
  {
    id: '3',
    type: '1099-NEC',
    year: 2023,
    issuer: 'Other Platform',
    amount: 15000,
    status: 'available',
    issuedAt: '2024-01-20',
    downloadUrl: '#',
  },
  {
    id: '4',
    type: '1099-K',
    year: 2022,
    issuer: 'Skillancer',
    amount: 58000,
    status: 'available',
    issuedAt: '2023-01-28',
    downloadUrl: '#',
  },
];

const mockSummary: TaxSummary = {
  year: 2024,
  totalIncome: 85000,
  totalExpenses: 12500,
  estimatedTaxesPaid: 16500,
  deductionsTotal: 18200,
};

const mockIntegrations: Integration[] = [
  { id: 'turbotax', name: 'TurboTax', icon: '🧮', connected: false },
  { id: 'hrblock', name: 'H&R Block', icon: '📊', connected: false },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function YearSelector({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const years = [2024, 2023, 2022, 2021];

  return (
    <div className="relative">
      <select
        className="appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2 pr-10 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            Tax Year {y}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
    </div>
  );
}

function DocumentCard({ doc }: { doc: TaxDocument }) {
  const statusColors = {
    available: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    corrected: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-gray-100 p-3">
          <FileText className="h-6 w-6 text-gray-600" />
        </div>
        <div>
          <div className="font-semibold text-gray-900">{doc.type}</div>
          <div className="text-sm text-gray-500">
            {doc.issuer} • {doc.year}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-semibold">${doc.amount.toLocaleString()}</div>
          <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[doc.status]}`}>
            {doc.status === 'pending' ? 'Coming Jan 31' : doc.status}
          </span>
        </div>

        {doc.status === 'available' && (
          <a className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50" href={doc.downloadUrl}>
            <Download className="h-5 w-5" />
          </a>
        )}
      </div>
    </div>
  );
}

function TaxSummaryCard({ summary }: { summary: TaxSummary }) {
  const netIncome = summary.totalIncome - summary.totalExpenses;

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold opacity-90">{summary.year} Tax Summary</h3>
        <Calendar className="h-5 w-5 opacity-70" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm opacity-70">Total Income</div>
          <div className="text-2xl font-bold">${summary.totalIncome.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm opacity-70">Expenses</div>
          <div className="text-2xl font-bold">-${summary.totalExpenses.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm opacity-70">Deductions</div>
          <div className="text-xl font-semibold">${summary.deductionsTotal.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm opacity-70">Est. Taxes Paid</div>
          <div className="text-xl font-semibold">
            ${summary.estimatedTaxesPaid.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({
  integration,
  onConnect,
}: {
  integration: Integration;
  onConnect: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{integration.icon}</span>
        <div>
          <div className="font-medium text-gray-900">{integration.name}</div>
          {integration.connected && integration.lastSync && (
            <div className="text-xs text-gray-500">
              Last sync: {new Date(integration.lastSync).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {integration.connected ? (
        <div className="flex items-center gap-2 text-green-600">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Connected</span>
        </div>
      ) : (
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={onConnect}
        >
          Connect
        </button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function TaxDocumentsPage() {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(2024);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setDocuments(mockDocuments.filter((d) => d.year === selectedYear || selectedYear === 2024));
      setSummary(mockSummary);
      setIntegrations(mockIntegrations);
      setLoading(false);
    }, 300);
  }, [selectedYear]);

  const handleConnect = (integrationId: string) => {
    // In production, initiate OAuth flow
    console.log('Connecting to', integrationId);
  };

  const handleUpload = () => {
    // In production, open file picker
    console.log('Upload 1099');
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Tax Documents</h1>
            <p className="text-gray-500">1099s, tax summaries, and exports</p>
          </div>
          <YearSelector year={selectedYear} onChange={setSelectedYear} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* 1099s Section */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h2 className="font-semibold text-gray-900">1099 Forms</h2>
                <button
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                  onClick={handleUpload}
                >
                  <Upload className="h-4 w-4" />
                  Upload External 1099
                </button>
              </div>

              <div className="space-y-3 p-4">
                {documents.length > 0 ? (
                  documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
                ) : (
                  <div className="py-8 text-center text-gray-500">No documents for this year</div>
                )}
              </div>
            </div>

            {/* Export Options */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 p-4">
                <h2 className="font-semibold text-gray-900">Export Options</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
                <button className="flex flex-col items-center rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                  <Download className="mb-2 h-6 w-6 text-indigo-600" />
                  <span className="font-medium">Tax Package</span>
                  <span className="text-xs text-gray-500">PDF + CSV</span>
                </button>

                <button className="flex flex-col items-center rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                  <FileText className="mb-2 h-6 w-6 text-indigo-600" />
                  <span className="font-medium">Income Summary</span>
                  <span className="text-xs text-gray-500">For accountant</span>
                </button>

                <button className="flex flex-col items-center rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                  <ExternalLink className="mb-2 h-6 w-6 text-indigo-600" />
                  <span className="font-medium">Transaction Detail</span>
                  <span className="text-xs text-gray-500">Full CSV</span>
                </button>
              </div>
            </div>

            {/* Integrations */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 p-4">
                <h2 className="font-semibold text-gray-900">Tax Software Integrations</h2>
              </div>

              <div className="space-y-3 p-4">
                {integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onConnect={() => handleConnect(integration.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <TaxSummaryCard summary={summary!} />

            {/* Pending Notice */}
            {selectedYear === 2024 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <h4 className="font-medium text-amber-900">2024 1099s Coming Soon</h4>
                    <p className="mt-1 text-sm text-amber-700">
                      Your 2024 1099-K will be available by January 31, 2025.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 font-semibold text-gray-900">Quick Links</h3>
              <div className="space-y-2">
                <a
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                  href="#"
                >
                  <ExternalLink className="h-4 w-4" />
                  IRS Self-Employment Tax Guide
                </a>
                <a
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                  href="#"
                >
                  <ExternalLink className="h-4 w-4" />
                  Schedule C Instructions
                </a>
                <a
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                  href="#"
                >
                  <ExternalLink className="h-4 w-4" />
                  Quarterly Payment Calculator
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
