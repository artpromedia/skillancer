'use client';

import {
  ShieldCheckIcon,
  AcademicCapIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ComponentType, SVGProps } from 'react';

// Type for Heroicon components
type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Healthcare Dashboard Page
 * Sprint M9: Healthcare Vertical Module
 */

interface ComplianceStatus {
  hipaaTraining: {
    completed: boolean;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
  };
  baaStatus: {
    inPlace: boolean;
    expiresAt: Date | null;
  };
  credentials: {
    total: number;
    verified: number;
    expiringSoon: number;
  };
  exclusionScreening: {
    status: 'CLEAR' | 'PENDING' | 'EXCLUDED';
    lastChecked: Date | null;
  };
}

interface DashboardStats {
  activeJobs: number;
  pendingApplications: number;
  upcomingRenewals: number;
  complianceScore: number;
}

export default function HealthcareDashboardPage() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'compliance' | 'jobs'>('overview');

  // Placeholder data - replace with actual API calls
  const complianceStatus: ComplianceStatus = {
    hipaaTraining: {
      completed: true,
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 180,
    },
    baaStatus: {
      inPlace: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    credentials: {
      total: 5,
      verified: 4,
      expiringSoon: 1,
    },
    exclusionScreening: {
      status: 'CLEAR',
      lastChecked: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  };

  const stats: DashboardStats = {
    activeJobs: 3,
    pendingApplications: 5,
    upcomingRenewals: 2,
    complianceScore: 95,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Healthcare Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your healthcare credentials, compliance, and jobs
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                <CheckCircleIcon className="mr-1.5 h-4 w-4" />
                HIPAA Compliant
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            color="green"
            icon={ShieldCheckIcon}
            title="Compliance Score"
            value={`${stats.complianceScore}%`}
          />
          <StatCard
            color="blue"
            icon={DocumentCheckIcon}
            title="Active Jobs"
            value={stats.activeJobs.toString()}
          />
          <StatCard
            color="yellow"
            icon={ClockIcon}
            title="Pending Applications"
            value={stats.pendingApplications.toString()}
          />
          <StatCard
            color="orange"
            icon={ExclamationTriangleIcon}
            title="Upcoming Renewals"
            value={stats.upcomingRenewals.toString()}
          />
        </div>

        {/* Compliance Overview */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Compliance Status</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* HIPAA Training */}
            <ComplianceCard
              actionHref="/dashboard/healthcare/training"
              actionLabel={
                complianceStatus.hipaaTraining.completed ? 'View Certificate' : 'Complete Training'
              }
              description={
                complianceStatus.hipaaTraining.completed
                  ? `Expires in ${complianceStatus.hipaaTraining.daysUntilExpiry} days`
                  : 'Training required'
              }
              icon={AcademicCapIcon}
              status={complianceStatus.hipaaTraining.completed ? 'complete' : 'incomplete'}
              title="HIPAA Training"
            />

            {/* BAA Status */}
            <ComplianceCard
              actionHref="/dashboard/healthcare/baa"
              actionLabel={complianceStatus.baaStatus.inPlace ? 'View BAA' : 'Sign BAA'}
              description={
                complianceStatus.baaStatus.inPlace ? 'BAA is in place' : 'BAA signature required'
              }
              icon={DocumentCheckIcon}
              status={complianceStatus.baaStatus.inPlace ? 'complete' : 'incomplete'}
              title="Business Associate Agreement"
            />

            {/* Credentials */}
            <ComplianceCard
              actionHref="/dashboard/healthcare/credentials"
              actionLabel="Manage Credentials"
              description={`${complianceStatus.credentials.verified}/${complianceStatus.credentials.total} verified`}
              icon={ShieldCheckIcon}
              status={
                complianceStatus.credentials.verified === complianceStatus.credentials.total
                  ? 'complete'
                  : 'pending'
              }
              title="Medical Credentials"
              warning={
                complianceStatus.credentials.expiringSoon > 0
                  ? `${complianceStatus.credentials.expiringSoon} expiring soon`
                  : undefined
              }
            />

            {/* Exclusion Screening */}
            <ComplianceCard
              actionHref="/dashboard/healthcare/screening"
              actionLabel="View Details"
              description={
                complianceStatus.exclusionScreening.status === 'CLEAR'
                  ? `Last checked ${formatDate(complianceStatus.exclusionScreening.lastChecked)}`
                  : 'Screening in progress'
              }
              icon={ShieldCheckIcon}
              status={
                complianceStatus.exclusionScreening.status === 'CLEAR'
                  ? 'complete'
                  : complianceStatus.exclusionScreening.status === 'PENDING'
                    ? 'pending'
                    : 'error'
              }
              title="Exclusion Screening"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction href="/dashboard/healthcare/credentials/add" title="Add Credential" />
            <QuickAction href="/dashboard/healthcare/jobs" title="Find Healthcare Jobs" />
            <QuickAction href="/dashboard/healthcare/training" title="Complete Training" />
            <QuickAction href="/dashboard/healthcare/compliance" title="View Compliance Report" />
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: HeroIcon;
  color: 'green' | 'blue' | 'yellow' | 'orange';
}) {
  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center">
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ComplianceCard({
  title,
  status,
  description,
  actionLabel,
  actionHref,
  icon: Icon,
  warning,
}: {
  title: string;
  status: 'complete' | 'incomplete' | 'pending' | 'error';
  description: string;
  actionLabel: string;
  actionHref: string;
  icon: HeroIcon;
  warning?: string | undefined;
}) {
  const statusConfig = {
    complete: {
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
      borderColor: 'border-green-200',
    },
    incomplete: {
      bgColor: 'bg-red-50',
      iconColor: 'text-red-500',
      borderColor: 'border-red-200',
    },
    pending: {
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-500',
      borderColor: 'border-yellow-200',
    },
    error: {
      bgColor: 'bg-red-50',
      iconColor: 'text-red-500',
      borderColor: 'border-red-200',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-6`}>
      <div className="flex items-start">
        <Icon className={`h-8 w-8 ${config.iconColor}`} />
        <div className="ml-4 flex-1">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
          {warning && (
            <p className="mt-2 text-sm text-orange-600">
              <ExclamationTriangleIcon className="mr-1 inline h-4 w-4" />
              {warning}
            </p>
          )}
          <a
            className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:text-blue-500"
            href={actionHref}
          >
            {actionLabel} →
          </a>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ title, href }: { title: string; href: string }) {
  return (
    <a
      className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
      href={href}
    >
      {title}
    </a>
  );
}

function formatDate(date: Date | null): string {
  if (!date) return 'Never';
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString();
}
