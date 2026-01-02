'use client';

/**
 * Tenant Admin Dashboard
 * Overview of tenant status, users, sessions, and security
 */

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Monitor,
  HardDrive,
  Shield,
  AlertTriangle,
  TrendingUp,
  UserPlus,
  FileText,
  Settings,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface DashboardStats {
  activeUsers: number;
  activeSessions: number;
  storageUsedGB: number;
  storageQuotaGB: number;
  securityEvents24h: number;
  criticalAlerts: number;
}

interface TenantInfo {
  id: string;
  companyName: string;
  plan: string;
  status: string;
  limits: {
    maxUsers: number;
    maxConcurrentSessions: number;
    storageQuotaGB: number;
  };
}

interface UsageTrend {
  date: string;
  sessions: number;
  users: number;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/admin/tenant/stats');
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

async function fetchTenantInfo(): Promise<TenantInfo> {
  const response = await fetch('/api/admin/tenant');
  if (!response.ok) throw new Error('Failed to fetch tenant');
  return response.json();
}

async function fetchUsageTrends(): Promise<UsageTrend[]> {
  const response = await fetch('/api/admin/tenant/usage/trends');
  if (!response.ok) throw new Error('Failed to fetch trends');
  return response.json();
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  alert,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-red-500' : ''}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
            {trend && (
              <div
                className={`mt-2 flex items-center text-sm ${
                  trend.positive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                <TrendingUp className={`mr-1 h-4 w-4 ${!trend.positive ? 'rotate-180' : ''}`} />
                {trend.value}% vs last week
              </div>
            )}
          </div>
          <div
            className={`rounded-lg p-3 ${
              alert ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'
            }`}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const actions = [
    { label: 'Invite Users', href: '/admin/tenant/users?action=invite', icon: UserPlus },
    { label: 'Create Policy', href: '/admin/tenant/policies/new', icon: Shield },
    { label: 'View Sessions', href: '/admin/tenant/sessions', icon: Monitor },
    { label: 'Generate Report', href: '/admin/tenant/reports', icon: FileText },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link key={action.label} href={action.href}>
            <Button className="w-full justify-start" variant="outline">
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function StorageUsage({ used, quota }: { used: number; quota: number }) {
  const percentage = quota === -1 ? 0 : Math.round((used / quota) * 100);
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <HardDrive className="mr-2 h-5 w-5" />
          Storage Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold">{used.toFixed(1)} GB</p>
              <p className="text-muted-foreground text-sm">
                of {quota === -1 ? 'Unlimited' : `${quota} GB`}
              </p>
            </div>
            {quota !== -1 && (
              <Badge variant={isCritical ? 'destructive' : isWarning ? 'secondary' : 'outline'}>
                {percentage}%
              </Badge>
            )}
          </div>
          {quota !== -1 && (
            <Progress
              className={isCritical ? 'bg-red-200' : isWarning ? 'bg-yellow-200' : ''}
              value={percentage}
            />
          )}
          {isCritical && (
            <p className="text-sm text-red-600">
              Storage almost full. Consider upgrading your plan.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivity() {
  // Would fetch recent activity from API
  const activities = [
    { id: '1', action: 'User invited', user: 'admin@company.com', time: '5 min ago' },
    { id: '2', action: 'Policy updated', user: 'admin@company.com', time: '1 hour ago' },
    { id: '3', action: 'Session terminated', user: 'admin@company.com', time: '2 hours ago' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Admin actions in the last 24 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{activity.action}</p>
                <p className="text-muted-foreground">{activity.user}</p>
              </div>
              <p className="text-muted-foreground">{activity.time}</p>
            </div>
          ))}
          <Link href="/admin/tenant/audit">
            <Button className="w-full" size="sm" variant="ghost">
              View All Activity
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanSummary({ tenant }: { tenant: TenantInfo }) {
  const planColors: Record<string, string> = {
    STARTER: 'bg-gray-100 text-gray-800',
    PRO: 'bg-blue-100 text-blue-800',
    ENTERPRISE: 'bg-purple-100 text-purple-800',
    TRIAL: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Current Plan</span>
          <Badge className={planColors[tenant.plan] || 'bg-gray-100'}>{tenant.plan}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Users</span>
            <span className="font-medium">
              {tenant.limits.maxUsers === -1 ? 'Unlimited' : tenant.limits.maxUsers}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Concurrent Sessions</span>
            <span className="font-medium">
              {tenant.limits.maxConcurrentSessions === -1
                ? 'Unlimited'
                : tenant.limits.maxConcurrentSessions}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Storage</span>
            <span className="font-medium">
              {tenant.limits.storageQuotaGB === -1
                ? 'Unlimited'
                : `${tenant.limits.storageQuotaGB} GB`}
            </span>
          </div>
          {tenant.plan !== 'ENTERPRISE' && (
            <Link href="/admin/tenant/billing">
              <Button className="mt-4 w-full" variant="outline">
                Upgrade Plan
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TenantAdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['tenant-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: fetchTenantInfo,
  });

  if (statsLoading || tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-12 w-12 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tenant?.companyName}</h1>
          <p className="text-muted-foreground">Admin Dashboard</p>
        </div>
        <Link href="/admin/tenant/settings">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Critical Alerts Banner */}
      {stats?.criticalAlerts && stats.criticalAlerts > 0 && (
        <div className="mb-8 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center">
            <AlertTriangle className="mr-3 h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">
                {stats.criticalAlerts} Critical Security Alert
                {stats.criticalAlerts > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-red-600">Immediate attention required</p>
            </div>
          </div>
          <Link href="/admin/tenant/security">
            <Button size="sm" variant="destructive">
              View Alerts
            </Button>
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          subtitle={
            tenant?.limits.maxUsers === -1 ? 'Unlimited' : `of ${tenant?.limits.maxUsers} allowed`
          }
          title="Active Users"
          trend={{ value: 12, positive: true }}
          value={stats?.activeUsers || 0}
        />
        <StatCard
          icon={Monitor}
          subtitle="Currently connected"
          title="Active Sessions"
          value={stats?.activeSessions || 0}
        />
        <StatCard
          alert={(stats?.securityEvents24h || 0) > 10}
          icon={Shield}
          subtitle="Last 24 hours"
          title="Security Events"
          value={stats?.securityEvents24h || 0}
        />
        <StatCard
          icon={HardDrive}
          subtitle={
            tenant?.limits.storageQuotaGB === -1
              ? 'Unlimited'
              : `of ${tenant?.limits.storageQuotaGB} GB`
          }
          title="Storage Used"
          value={`${stats?.storageUsedGB?.toFixed(1) || 0} GB`}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          <QuickActions />

          {/* Usage Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>Sessions and active users over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/20 flex h-64 items-center justify-center rounded-lg">
                <p className="text-muted-foreground">Usage chart will appear here</p>
              </div>
            </CardContent>
          </Card>

          <RecentActivity />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {tenant && <PlanSummary tenant={tenant} />}
          {stats && (
            <StorageUsage quota={tenant?.limits.storageQuotaGB || 0} used={stats.storageUsedGB} />
          )}

          {/* Support Card */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href="https://docs.skillancer.io/skillpod"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Documentation
                </Button>
              </a>
              <Link href="/admin/tenant/support">
                <Button className="w-full justify-start" variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
