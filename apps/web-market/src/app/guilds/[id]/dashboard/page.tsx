'use client';

/**
 * Guild Dashboard Page
 * Sprint M8: Guild & Agency Accounts
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  Star,
  Settings,
  UserPlus,
  FileText,
  PieChart,
  Bell,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface GuildDashboardData {
  guild: {
    id: string;
    name: string;
    logo: string | null;
    combinedRating: number;
    totalReviews: number;
    memberCount: number;
    verificationLevel: number;
  };
  stats: {
    activeProjects: number;
    pendingProposals: number;
    completedProjects: number;
    totalRevenue: number;
    treasuryBalance: number;
    pendingPayouts: number;
  };
  recentActivity: {
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }[];
  pendingActions: {
    invitations: number;
    splitApprovals: number;
    proposalReviews: number;
  };
}

export default function GuildDashboardPage() {
  const params = useParams();
  const guildId = params.id as string;

  const [data, setData] = useState<GuildDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (guildId) {
      fetchDashboardData();
    }
  }, [guildId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // In a real app, this would be a single API call
      const res = await fetch(`/api/guilds/${guildId}/dashboard`);
      const result = await res.json();
      setData(result.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.guild.name} Dashboard</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-current text-yellow-400" />
                {data.guild.combinedRating.toFixed(1)} ({data.guild.totalReviews} reviews)
              </span>
              <span>{data.guild.memberCount} members</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/guilds/${guildId}/settings`}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <Link
              href={`/guilds/${guildId}/members/invite`}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Link>
          </div>
        </div>

        {/* Pending Actions */}
        {(data.pendingActions.invitations > 0 ||
          data.pendingActions.splitApprovals > 0 ||
          data.pendingActions.proposalReviews > 0) && (
          <div className="mb-8 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Bell className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Actions Required</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {data.pendingActions.invitations > 0 && (
                <Link
                  href={`/guilds/${guildId}/invitations`}
                  className="text-yellow-700 hover:underline"
                >
                  {data.pendingActions.invitations} pending invitations
                </Link>
              )}
              {data.pendingActions.splitApprovals > 0 && (
                <Link
                  href={`/guilds/${guildId}/finances/splits`}
                  className="text-yellow-700 hover:underline"
                >
                  {data.pendingActions.splitApprovals} splits awaiting approval
                </Link>
              )}
              {data.pendingActions.proposalReviews > 0 && (
                <Link
                  href={`/guilds/${guildId}/proposals`}
                  className="text-yellow-700 hover:underline"
                >
                  {data.pendingActions.proposalReviews} proposals to review
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Briefcase className="h-5 w-5" />}
            label="Active Projects"
            value={data.stats.activeProjects}
            color="blue"
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label="Pending Proposals"
            value={data.stats.pendingProposals}
            color="purple"
          />
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Treasury Balance"
            value={`$${data.stats.treasuryBalance.toLocaleString()}`}
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Total Revenue"
            value={`$${data.stats.totalRevenue.toLocaleString()}`}
            color="teal"
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Quick Actions */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <QuickActionButton
                  icon={<Plus className="h-5 w-5" />}
                  label="New Proposal"
                  href={`/guilds/${guildId}/proposals/new`}
                />
                <QuickActionButton
                  icon={<Users className="h-5 w-5" />}
                  label="Manage Team"
                  href={`/guilds/${guildId}/members`}
                />
                <QuickActionButton
                  icon={<PieChart className="h-5 w-5" />}
                  label="Revenue Splits"
                  href={`/guilds/${guildId}/finances/splits`}
                />
                <QuickActionButton
                  icon={<DollarSign className="h-5 w-5" />}
                  label="Treasury"
                  href={`/guilds/${guildId}/finances/treasury`}
                />
              </div>
            </div>

            {/* Active Projects */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Active Projects</h2>
                <Link
                  href={`/guilds/${guildId}/projects`}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  View All <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              {/* Project list would go here */}
              <div className="py-8 text-center text-gray-500">
                {data.stats.activeProjects === 0 ? 'No active projects' : 'Loading projects...'}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h2>
            <div className="space-y-4">
              {data.recentActivity.length > 0 ? (
                data.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <p className="text-gray-700">{activity.message}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500">No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'teal';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    teal: 'bg-teal-50 text-teal-600',
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div
        className={`h-10 w-10 rounded-lg ${colors[color]} mb-3 flex items-center justify-center`}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100"
    >
      <div className="mb-2 text-gray-600">{icon}</div>
      <span className="text-center text-sm text-gray-700">{label}</span>
    </Link>
  );
}
