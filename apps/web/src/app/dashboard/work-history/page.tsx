'use client';

/**
 * Work History Dashboard Page
 * Central hub for managing portable verified work history
 * Sprint M4: Portable Verified Work History
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Link2,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Award,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';

// Types
interface Platform {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSynced: string | null;
  projectCount: number;
  earnings: number;
  rating: number | null;
}

interface WorkHistoryItem {
  id: string;
  title: string;
  platform: string;
  platformIcon: string;
  client: string;
  startDate: string;
  endDate: string | null;
  earnings: number;
  currency: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';
  verificationLevel:
    | 'SELF_REPORTED'
    | 'PLATFORM_CONNECTED'
    | 'PLATFORM_VERIFIED'
    | 'CRYPTOGRAPHICALLY_SEALED';
  rating: number | null;
  skills: string[];
}

interface ReputationScore {
  overallScore: number;
  tier: string;
  trend: 'rising' | 'stable' | 'declining';
  percentile: number;
}

// Mock data
const mockPlatforms: Platform[] = [
  {
    id: 'upwork',
    name: 'Upwork',
    icon: '💼',
    connected: true,
    lastSynced: '2024-01-15T10:30:00Z',
    projectCount: 42,
    earnings: 87500,
    rating: 4.9,
  },
  {
    id: 'fiverr',
    name: 'Fiverr',
    icon: '🎨',
    connected: true,
    lastSynced: '2024-01-14T15:45:00Z',
    projectCount: 156,
    earnings: 45200,
    rating: 5.0,
  },
  {
    id: 'freelancer',
    name: 'Freelancer.com',
    icon: '🌐',
    connected: false,
    lastSynced: null,
    projectCount: 0,
    earnings: 0,
    rating: null,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '👔',
    connected: false,
    lastSynced: null,
    projectCount: 0,
    earnings: 0,
    rating: null,
  },
];

const mockWorkHistory: WorkHistoryItem[] = [
  {
    id: '1',
    title: 'E-commerce Platform Development',
    platform: 'Upwork',
    platformIcon: '💼',
    client: 'Tech Startup Inc.',
    startDate: '2024-01-01',
    endDate: '2024-01-15',
    earnings: 12500,
    currency: 'USD',
    status: 'COMPLETED',
    verificationLevel: 'PLATFORM_VERIFIED',
    rating: 5,
    skills: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
  },
  {
    id: '2',
    title: 'Mobile App UI/UX Redesign',
    platform: 'Fiverr',
    platformIcon: '🎨',
    client: 'HealthTech Co.',
    startDate: '2023-12-01',
    endDate: '2023-12-20',
    earnings: 3500,
    currency: 'USD',
    status: 'COMPLETED',
    verificationLevel: 'CRYPTOGRAPHICALLY_SEALED',
    rating: 5,
    skills: ['Figma', 'UI Design', 'Mobile Design'],
  },
  {
    id: '3',
    title: 'API Integration Project',
    platform: 'Upwork',
    platformIcon: '💼',
    client: 'Enterprise Corp',
    startDate: '2024-01-10',
    endDate: null,
    earnings: 8000,
    currency: 'USD',
    status: 'IN_PROGRESS',
    verificationLevel: 'PLATFORM_CONNECTED',
    rating: null,
    skills: ['Python', 'REST API', 'AWS'],
  },
];

const mockReputationScore: ReputationScore = {
  overallScore: 87,
  tier: 'expert',
  trend: 'rising',
  percentile: 92,
};

export default function WorkHistoryDashboard() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>(mockPlatforms);
  const [workHistory, setWorkHistory] = useState<WorkHistoryItem[]>(mockWorkHistory);
  const [reputationScore, setReputationScore] = useState<ReputationScore>(mockReputationScore);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all');

  const totalEarnings = platforms.reduce((sum, p) => sum + p.earnings, 0);
  const totalProjects = platforms.reduce((sum, p) => sum + p.projectCount, 0);
  const connectedPlatforms = platforms.filter((p) => p.connected).length;

  const handleConnectPlatform = (platformId: string) => {
    router.push(`/dashboard/work-history/connect/${platformId}`);
  };

  const handleSyncPlatform = async (platformId: string) => {
    setSyncing(platformId);
    // Simulate sync
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSyncing(null);
  };

  const getVerificationBadge = (level: WorkHistoryItem['verificationLevel']) => {
    const badges = {
      SELF_REPORTED: { color: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Self Reported' },
      PLATFORM_CONNECTED: { color: 'bg-blue-100 text-blue-600', icon: Link2, label: 'Connected' },
      PLATFORM_VERIFIED: {
        color: 'bg-green-100 text-green-600',
        icon: CheckCircle2,
        label: 'Verified',
      },
      CRYPTOGRAPHICALLY_SEALED: {
        color: 'bg-purple-100 text-purple-600',
        icon: Shield,
        label: 'Sealed',
      },
    };
    return badges[level];
  };

  const filteredWorkHistory = workHistory.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'verified') return item.verificationLevel !== 'SELF_REPORTED';
    if (filter === 'pending') return item.verificationLevel === 'SELF_REPORTED';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Work History</h1>
              <p className="mt-1 text-sm text-gray-500">
                Your portable, verified professional record
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/work-history/import')}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Entry
              </button>
              <button
                onClick={() => router.push('/dashboard/credentials')}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Export Credentials
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Reputation Score */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
            <div className="mb-4 flex items-center justify-between">
              <Award className="h-8 w-8 opacity-80" />
              {reputationScore.trend === 'rising' && (
                <div className="flex items-center text-sm text-green-200">
                  <TrendingUp className="mr-1 h-4 w-4" />
                  Rising
                </div>
              )}
            </div>
            <div className="mb-1 text-4xl font-bold">{reputationScore.overallScore}</div>
            <div className="text-sm capitalize text-indigo-100">
              {reputationScore.tier} • Top {100 - reputationScore.percentile}%
            </div>
          </div>

          {/* Total Earnings */}
          <div className="rounded-xl border bg-white p-6">
            <div className="mb-1 text-sm text-gray-500">Total Verified Earnings</div>
            <div className="text-3xl font-bold text-gray-900">
              ${totalEarnings.toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-green-600">Across {connectedPlatforms} platforms</div>
          </div>

          {/* Projects */}
          <div className="rounded-xl border bg-white p-6">
            <div className="mb-1 text-sm text-gray-500">Completed Projects</div>
            <div className="text-3xl font-bold text-gray-900">{totalProjects}</div>
            <div className="mt-2 text-sm text-gray-500">
              {workHistory.filter((w) => w.verificationLevel !== 'SELF_REPORTED').length} verified
            </div>
          </div>

          {/* Connected Platforms */}
          <div className="rounded-xl border bg-white p-6">
            <div className="mb-1 text-sm text-gray-500">Connected Platforms</div>
            <div className="text-3xl font-bold text-gray-900">
              {connectedPlatforms}/{platforms.length}
            </div>
            <div className="mt-2 flex -space-x-2">
              {platforms
                .filter((p) => p.connected)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white text-lg shadow-sm"
                    title={p.name}
                  >
                    {p.icon}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Platform Connections */}
        <div className="mb-8 rounded-xl border bg-white">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Platform Connections</h2>
          </div>
          <div className="divide-y">
            {platforms.map((platform) => (
              <div key={platform.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                    {platform.icon}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{platform.name}</div>
                    {platform.connected ? (
                      <div className="text-sm text-gray-500">
                        {platform.projectCount} projects • ${platform.earnings.toLocaleString()}{' '}
                        earned
                        {platform.rating && ` • ${platform.rating}★`}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">Not connected</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {platform.connected ? (
                    <>
                      <div className="text-xs text-gray-400">
                        Synced{' '}
                        {platform.lastSynced
                          ? new Date(platform.lastSynced).toLocaleDateString()
                          : 'never'}
                      </div>
                      <button
                        onClick={() => handleSyncPlatform(platform.id)}
                        disabled={syncing === platform.id}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <RefreshCw
                          className={`h-5 w-5 ${syncing === platform.id ? 'animate-spin' : ''}`}
                        />
                      </button>
                      <div className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-sm text-green-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnectPlatform(platform.id)}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Work History List */}
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Work History</h2>
            <div className="flex items-center gap-2">
              {(['all', 'verified', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y">
            {filteredWorkHistory.map((item) => {
              const badge = getVerificationBadge(item.verificationLevel);
              const BadgeIcon = badge.icon;

              return (
                <div key={item.id} className="px-6 py-4 transition-colors hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
                        {item.platformIcon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{item.title}</h3>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
                          >
                            <BadgeIcon className="h-3 w-3" />
                            {badge.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-sm text-gray-500">
                          {item.client} • {item.platform}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                          <span>
                            {new Date(item.startDate).toLocaleDateString()}
                            {item.endDate
                              ? ` - ${new Date(item.endDate).toLocaleDateString()}`
                              : ' - Present'}
                          </span>
                          {item.rating && (
                            <span className="flex items-center gap-1">⭐ {item.rating}/5</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.skills.slice(0, 4).map((skill) => (
                            <span
                              key={skill}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                              {skill}
                            </span>
                          ))}
                          {item.skills.length > 4 && (
                            <span className="px-2 py-0.5 text-xs text-gray-400">
                              +{item.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          ${item.earnings.toLocaleString()}
                        </div>
                        <div
                          className={`text-sm ${
                            item.status === 'COMPLETED'
                              ? 'text-green-600'
                              : item.status === 'IN_PROGRESS'
                                ? 'text-blue-600'
                                : 'text-gray-500'
                          }`}
                        >
                          {item.status.replace('_', ' ').toLowerCase()}
                        </div>
                      </div>
                      <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredWorkHistory.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              No work history found matching your filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
