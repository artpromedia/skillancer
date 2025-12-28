'use client';

import { cn } from '@skillancer/ui';
import {
  Gift,
  Users,
  DollarSign,
  Plus,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
  Star,
  Mail,
} from 'lucide-react';
import { useState } from 'react';

// Types
interface Referral {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerAvatar?: string;
  referredClientId?: string;
  referredClientName?: string;
  referredEmail?: string;
  status: 'pending' | 'contacted' | 'converted' | 'lost';
  source: 'direct' | 'link' | 'email';
  createdAt: string;
  convertedAt?: string;
  rewardStatus?: 'pending' | 'paid' | 'none';
  rewardAmount?: number;
  projectValue?: number;
}

interface ReferralTrackingProps {
  clientId?: string; // Optional - filter by referrer
  referrals?: Referral[];
  referralLink?: string;
  onAddReferral?: () => void;
  className?: string;
}

// Mock data
const mockReferrals: Referral[] = [
  {
    id: '1',
    referrerId: 'c1',
    referrerName: 'Acme Corp',
    referredClientId: 'c5',
    referredClientName: 'Beta Industries',
    status: 'converted',
    source: 'direct',
    createdAt: '2024-11-15T10:00:00Z',
    convertedAt: '2024-11-28T14:00:00Z',
    rewardStatus: 'paid',
    rewardAmount: 500,
    projectValue: 8500,
  },
  {
    id: '2',
    referrerId: 'c2',
    referrerName: 'TechStart Inc',
    referredClientId: 'c6',
    referredClientName: 'Gamma Solutions',
    status: 'converted',
    source: 'email',
    createdAt: '2024-12-01T09:00:00Z',
    convertedAt: '2024-12-18T11:00:00Z',
    rewardStatus: 'pending',
    rewardAmount: 350,
    projectValue: 5200,
  },
  {
    id: '3',
    referrerId: 'c1',
    referrerName: 'Acme Corp',
    referredEmail: 'john@newcompany.com',
    status: 'contacted',
    source: 'link',
    createdAt: '2024-12-20T15:00:00Z',
  },
  {
    id: '4',
    referrerId: 'c3',
    referrerName: 'Design Studio',
    referredEmail: 'hello@startup.io',
    status: 'pending',
    source: 'direct',
    createdAt: '2024-12-24T10:00:00Z',
  },
];

function getReferrerRankingStyle(index: number): string {
  if (index === 0) return 'bg-amber-100 text-amber-700';
  if (index === 1) return 'bg-gray-200 text-gray-600';
  if (index === 2) return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-500';
}

const statusConfig = {
  pending: { label: 'Pending', color: 'text-gray-600 bg-gray-100' },
  contacted: { label: 'Contacted', color: 'text-blue-600 bg-blue-100' },
  converted: { label: 'Converted', color: 'text-green-600 bg-green-100' },
  lost: { label: 'Lost', color: 'text-red-600 bg-red-100' },
};

export function ReferralTracking({
  clientId,
  referrals = mockReferrals,
  referralLink = 'https://skillancer.com/ref/abc123',
  onAddReferral,
  className,
}: Readonly<ReferralTrackingProps>) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'contacted' | 'converted'>('all');
  const [copied, setCopied] = useState(false);

  // Filter referrals
  const filteredReferrals = referrals.filter((r) => {
    if (clientId && r.referrerId !== clientId) return false;
    if (filter === 'all') return true;
    return r.status === filter;
  });

  // Stats
  const totalReferrals = referrals.length;
  const convertedCount = referrals.filter((r) => r.status === 'converted').length;
  const conversionRate =
    totalReferrals > 0 ? ((convertedCount / totalReferrals) * 100).toFixed(0) : 0;
  const totalValue = referrals
    .filter((r) => r.status === 'converted')
    .reduce((sum, r) => sum + (r.projectValue || 0), 0);
  const totalRewards = referrals
    .filter((r) => r.rewardStatus === 'paid')
    .reduce((sum, r) => sum + (r.rewardAmount || 0), 0);

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group referrals by referrer for summary view
  const referrerStats = referrals.reduce(
    (acc, r) => {
      acc[r.referrerId] ??= {
        name: r.referrerName,
        total: 0,
        converted: 0,
        value: 0,
        rewards: 0,
      };
      acc[r.referrerId].total++;
      if (r.status === 'converted') {
        acc[r.referrerId].converted++;
        acc[r.referrerId].value += r.projectValue || 0;
      }
      if (r.rewardStatus === 'paid') {
        acc[r.referrerId].rewards += r.rewardAmount || 0;
      }
      return acc;
    },
    {} as Record<
      string,
      { name: string; total: number; converted: number; value: number; rewards: number }
    >
  );

  const topReferrers = Object.entries(referrerStats)
    .sort(([, a], [, b]) => b.converted - a.converted)
    .slice(0, 5);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            Total Referrals
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalReferrals}</div>
          <div className="text-xs text-gray-500">{convertedCount} converted</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="h-4 w-4" />
            Conversion Rate
          </div>
          <div className="text-2xl font-bold text-green-600">{conversionRate}%</div>
          <div className="text-xs text-gray-500">referrals converted</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            Revenue from Referrals
          </div>
          <div className="text-2xl font-bold text-gray-900">${totalValue.toLocaleString()}</div>
          <div className="text-xs text-gray-500">project value</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Gift className="h-4 w-4" />
            Rewards Paid
          </div>
          <div className="text-2xl font-bold text-purple-600">${totalRewards.toLocaleString()}</div>
          <div className="text-xs text-gray-500">to referrers</div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h3 className="mb-1 font-semibold text-gray-900">Your Referral Link</h3>
            <p className="text-sm text-gray-600">
              Share this link with clients to track referrals automatically
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <code className="max-w-[200px] truncate text-sm text-gray-700">{referralLink}</code>
            </div>
            <button
              className={cn(
                'flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              )}
              onClick={handleCopyLink}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Top Referrers */}
      {!clientId && topReferrers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900">Top Referrers</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {topReferrers.map(([id, stats], index) => (
              <div key={id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                      getReferrerRankingStyle(index)
                    )}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{stats.name}</div>
                    <div className="text-sm text-gray-500">
                      {stats.converted} of {stats.total} converted
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${stats.value.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">revenue</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referrals List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900">All Referrals</h3>
          <button
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
            onClick={onAddReferral}
          >
            <Plus className="h-4 w-4" />
            Add Referral
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b border-gray-100 p-4">
          {(['all', 'pending', 'contacted', 'converted'] as const).map((f) => (
            <button
              key={f}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="divide-y divide-gray-100">
          {filteredReferrals.map((referral) => {
            const status = statusConfig[referral.status];
            return (
              <div key={referral.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <Gift className="h-5 w-5 text-purple-600" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {referral.referredClientName || referral.referredEmail}
                    </span>
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.color)}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                    <span>Referred by {referral.referrerName}</span>
                    <span>•</span>
                    <span>{new Date(referral.createdAt).toLocaleDateString()}</span>
                    {referral.source === 'link' && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Via link
                        </span>
                      </>
                    )}
                    {referral.source === 'email' && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Via email
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {referral.status === 'converted' && (
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${referral.projectValue?.toLocaleString()}
                    </div>
                    {referral.rewardStatus && referral.rewardAmount && (
                      <div
                        className={cn(
                          'text-sm',
                          referral.rewardStatus === 'paid' ? 'text-green-600' : 'text-amber-600'
                        )}
                      >
                        ${referral.rewardAmount} reward{' '}
                        {referral.rewardStatus === 'pending' ? '(pending)' : '(paid)'}
                      </div>
                    )}
                  </div>
                )}

                <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            );
          })}
        </div>

        {filteredReferrals.length === 0 && (
          <div className="py-12 text-center">
            <Gift className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 font-medium text-gray-900">No referrals yet</h3>
            <p className="mb-4 text-sm text-gray-500">
              Start tracking referrals from your happy clients
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              onClick={onAddReferral}
            >
              <Plus className="h-4 w-4" />
              Add First Referral
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReferralTracking;
