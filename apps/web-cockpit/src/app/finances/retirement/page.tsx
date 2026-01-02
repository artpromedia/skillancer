'use client';

/**
 * Retirement Savings Page
 * SEP-IRA management, auto-contributions, and tax benefits
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import {
  PiggyBank,
  TrendingUp,
  Settings,
  Plus,
  ExternalLink,
  Check,
  AlertCircle,
  Calendar,
  DollarSign,
  Percent,
  ChevronRight,
  History,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface RetirementAccount {
  id: string;
  provider: 'betterment' | 'wealthfront' | 'vanguard';
  accountType: 'SEP-IRA' | 'Solo 401(k)';
  balance: number;
  ytdContributions: number;
  maxContribution: number;
  connected: boolean;
  lastSync?: string;
}

interface ContributionSettings {
  enabled: boolean;
  percentage: number;
  frequency: 'per_payment' | 'monthly' | 'quarterly';
  nextContributionDate?: string;
  estimatedNextAmount?: number;
}

interface Contribution {
  id: string;
  amount: number;
  date: string;
  source: string;
  status: 'completed' | 'pending' | 'failed';
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockAccount: RetirementAccount = {
  id: '1',
  provider: 'betterment',
  accountType: 'SEP-IRA',
  balance: 45230,
  ytdContributions: 12500,
  maxContribution: 66000, // 2024 SEP-IRA limit
  connected: true,
  lastSync: '2024-01-15T10:30:00Z',
};

const mockSettings: ContributionSettings = {
  enabled: true,
  percentage: 15,
  frequency: 'per_payment',
  nextContributionDate: '2024-01-20',
  estimatedNextAmount: 375,
};

const mockContributions: Contribution[] = [
  { id: '1', amount: 450, date: '2024-01-15', source: 'TechCorp payment', status: 'completed' },
  { id: '2', amount: 375, date: '2024-01-10', source: 'StartupXYZ payment', status: 'completed' },
  { id: '3', amount: 600, date: '2024-01-05', source: 'DesignCo payment', status: 'completed' },
  {
    id: '4',
    amount: 525,
    date: '2023-12-28',
    source: 'ConsultingFirm payment',
    status: 'completed',
  },
];

const PROVIDERS = [
  { id: 'betterment', name: 'Betterment', logo: '📈', description: 'Automated investing' },
  { id: 'wealthfront', name: 'Wealthfront', logo: '💰', description: 'Smart retirement' },
  { id: 'vanguard', name: 'Vanguard', logo: '🏛️', description: 'Low-cost investing' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function AccountOverview({ account }: { account: RetirementAccount }) {
  const contributionProgress = (account.ytdContributions / account.maxContribution) * 100;
  const remainingRoom = account.maxContribution - account.ytdContributions;

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 opacity-80" />
          <span className="text-sm opacity-80">{account.accountType}</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-xs">
          <Check className="h-3 w-3" />
          {account.provider.charAt(0).toUpperCase() + account.provider.slice(1)}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-1 text-4xl font-bold">${account.balance.toLocaleString()}</div>
        <div className="text-sm opacity-80">Total Balance</div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="opacity-80">YTD Contributions</span>
          <span className="font-medium">${account.ytdContributions.toLocaleString()}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${Math.min(100, contributionProgress)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs opacity-70">
          <span>{contributionProgress.toFixed(1)}% of max</span>
          <span>${remainingRoom.toLocaleString()} room remaining</span>
        </div>
      </div>
    </div>
  );
}

function AutoContributionCard({
  settings,
  onUpdate,
}: {
  settings: ContributionSettings;
  onUpdate: (settings: Partial<ContributionSettings>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempPercentage, setTempPercentage] = useState(settings.percentage);

  const handleSave = () => {
    onUpdate({ percentage: tempPercentage });
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <h3 className="font-semibold text-gray-900">Auto-Contribution</h3>
        <button
          className={`relative h-6 w-12 rounded-full transition-colors ${
            settings.enabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
          onClick={() => onUpdate({ enabled: !settings.enabled })}
        >
          <div
            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="p-4">
        {settings.enabled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">Contribution Rate</span>
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    className="w-16 rounded border px-2 py-1 text-right"
                    max={25}
                    min={1}
                    type="number"
                    value={tempPercentage}
                    onChange={(e) => setTempPercentage(Number(e.target.value))}
                  />
                  <span>%</span>
                  <button className="text-sm font-medium text-indigo-600" onClick={handleSave}>
                    Save
                  </button>
                </div>
              ) : (
                <button
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                  onClick={() => setIsEditing(true)}
                >
                  {settings.percentage}%
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">Frequency</span>
              </div>
              <select
                className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm"
                value={settings.frequency}
                onChange={(e) =>
                  onUpdate({ frequency: e.target.value as ContributionSettings['frequency'] })
                }
              >
                <option value="per_payment">Per Payment</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>

            {settings.nextContributionDate && (
              <div className="rounded-lg bg-indigo-50 p-3">
                <div className="text-sm text-indigo-700">Next Contribution</div>
                <div className="font-semibold text-indigo-900">
                  ${settings.estimatedNextAmount?.toLocaleString()} on{' '}
                  {new Date(settings.nextContributionDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-gray-500">
            <p>Auto-contribution is disabled</p>
            <p className="mt-1 text-sm">Enable to automatically save for retirement</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TaxBenefitCard({
  ytdContributions,
  taxRate,
}: {
  ytdContributions: number;
  taxRate: number;
}) {
  const taxSaved = ytdContributions * (taxRate / 100);

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-green-600" />
        <h4 className="font-semibold text-green-900">Tax Benefit</h4>
      </div>
      <div className="mb-1 text-3xl font-bold text-green-700">${taxSaved.toLocaleString()}</div>
      <p className="text-sm text-green-700">
        Saved in taxes this year from ${ytdContributions.toLocaleString()} in contributions at{' '}
        {taxRate}% marginal rate
      </p>
    </div>
  );
}

function ContributionHistory({ contributions }: { contributions: Contribution[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <h3 className="font-semibold text-gray-900">Contribution History</h3>
        <button className="text-sm text-indigo-600 hover:text-indigo-700">View All</button>
      </div>

      <div className="divide-y divide-gray-100">
        {contributions.map((contribution) => (
          <div key={contribution.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-gray-900">
                ${contribution.amount.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">{contribution.source}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-900">
                {new Date(contribution.date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                {contribution.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectAccountCTA({ onConnect }: { onConnect: (provider: string) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-6 text-center">
        <PiggyBank className="mx-auto mb-3 h-12 w-12 text-gray-400" />
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Start Saving for Retirement</h3>
        <p className="text-gray-500">
          Connect a retirement account to automatically contribute a percentage of your earnings
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
            onClick={() => onConnect(provider.id)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{provider.logo}</span>
              <div className="text-left">
                <div className="font-medium text-gray-900">{provider.name}</div>
                <div className="text-sm text-gray-500">{provider.description}</div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-gray-500">
        Don't have an account? We'll help you set one up.
      </p>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RetirementPage() {
  const router = useRouter();
  const [account, setAccount] = useState<RetirementAccount | null>(null);
  const [settings, setSettings] = useState<ContributionSettings | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setAccount(mockAccount);
      setSettings(mockSettings);
      setContributions(mockContributions);
      setLoading(false);
    }, 300);
  }, []);

  const handleConnect = (provider: string) => {
    console.log('Connecting to', provider);
    // In production, initiate OAuth flow
  };

  const handleUpdateSettings = (updates: Partial<ContributionSettings>) => {
    if (settings) {
      setSettings({ ...settings, ...updates });
    }
  };

  const handleManualContribution = () => {
    console.log('Manual contribution');
    // In production, open contribution modal
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
              onClick={() => router.push('/finances')}
            >
              ← Back to Finances
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Retirement Savings</h1>
            <p className="text-gray-500">SEP-IRA auto-contributions and tax benefits</p>
          </div>

          {account?.connected && (
            <button
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
              onClick={handleManualContribution}
            >
              <Plus className="h-5 w-5" />
              Add Contribution
            </button>
          )}
        </div>

        {account?.connected ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column */}
            <div className="space-y-6 lg:col-span-2">
              <AccountOverview account={account} />
              <AutoContributionCard settings={settings!} onUpdate={handleUpdateSettings} />
              <ContributionHistory contributions={contributions} />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <TaxBenefitCard taxRate={30} ytdContributions={account.ytdContributions} />

              {/* Contribution Limits Info */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="mb-3 font-semibold text-gray-900">2024 Contribution Limits</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">SEP-IRA Max</span>
                    <span className="font-medium">$69,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">% of Net SE Income</span>
                    <span className="font-medium">Up to 25%</span>
                  </div>
                </div>
              </div>

              {/* Provider Info */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Connected Account</h4>
                  <a className="text-sm text-indigo-600 hover:text-indigo-700" href="#">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📈</span>
                  <div>
                    <div className="font-medium">Betterment</div>
                    <div className="text-xs text-gray-500">
                      Last sync: {account.lastSync && new Date(account.lastSync).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ConnectAccountCTA onConnect={handleConnect} />
        )}
      </div>
    </div>
  );
}
