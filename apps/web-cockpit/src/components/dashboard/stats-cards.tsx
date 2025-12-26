/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Stats Cards Component
 *
 * Dashboard stat cards with icons, values, trends, and sparklines
 * for visualizing key metrics at a glance.
 *
 * @module components/dashboard/stats-cards
 */

import {
  Clock,
  DollarSign,
  Briefcase,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface StatCardData {
  id: string;
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: number;
    label?: string;
  };
  icon: 'clock' | 'dollar' | 'briefcase' | 'invoice';
  color: 'blue' | 'green' | 'purple' | 'orange';
  sparklineData?: number[];
}

export interface StatsCardsProps {
  stats: StatCardData[];
  isLoading?: boolean;
}

// ============================================================================
// Sparkline Component
// ============================================================================

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const colorMap: Record<string, string> = {
    blue: '#3B82F6',
    green: '#10B981',
    purple: '#8B5CF6',
    orange: '#F59E0B',
  };

  return (
    <svg className="h-12 w-24" preserveAspectRatio="none" viewBox="0 0 100 100">
      <polyline
        fill="none"
        points={points}
        stroke={colorMap[color] || '#3B82F6'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================

function StatCard({ stat }: { stat: StatCardData }) {
  const iconMap: Record<string, typeof Clock> = {
    clock: Clock,
    dollar: DollarSign,
    briefcase: Briefcase,
    invoice: FileText,
  };

  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'text-blue-600 dark:text-blue-400',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/30',
      icon: 'text-green-600 dark:text-green-400',
      text: 'text-green-600 dark:text-green-400',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/30',
      icon: 'text-purple-600 dark:text-purple-400',
      text: 'text-purple-600 dark:text-purple-400',
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      icon: 'text-orange-600 dark:text-orange-400',
      text: 'text-orange-600 dark:text-orange-400',
    },
  };

  const Icon = iconMap[stat.icon] || Clock;
  const colors = colorClasses[stat.color] || colorClasses.blue;

  const TrendIcon =
    stat.trend?.direction === 'up'
      ? TrendingUp
      : stat.trend?.direction === 'down'
        ? TrendingDown
        : Minus;

  const trendColorClass =
    stat.trend?.direction === 'up'
      ? 'text-green-600 dark:text-green-400'
      : stat.trend?.direction === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-500';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${colors.bg}`}>
              <Icon className={`h-5 w-5 ${colors.icon}`} />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {stat.label}
            </span>
          </div>

          <div className="mt-4">
            <p className={`text-3xl font-bold ${colors.text}`}>{stat.value}</p>

            {stat.trend && (
              <div className={`mt-2 flex items-center gap-1 text-sm ${trendColorClass}`}>
                <TrendIcon className="h-4 w-4" />
                <span>
                  {stat.trend.value > 0 ? '+' : ''}
                  {stat.trend.value}%
                </span>
                {stat.trend.label && (
                  <span className="text-gray-400 dark:text-gray-500">{stat.trend.label}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {stat.sparklineData && stat.sparklineData.length > 0 && (
          <div className="ml-4 opacity-75">
            <Sparkline color={stat.color} data={stat.sparklineData} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="mt-4">
          <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Stats Cards Grid Component
// ============================================================================

export function StatsCards({ stats, isLoading = false }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default StatsCards;
