'use client';

/**
 * Intelligence API Portal - Dashboard Page
 * Sprint M10: Talent Intelligence API
 */

import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@skillancer/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@skillancer/ui/dialog';
import { Input } from '@skillancer/ui/input';
import { Label } from '@skillancer/ui/label';
import { Progress } from '@skillancer/ui/progress';
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  BarChart3,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Mock data
const mockApiKeys = [
  {
    id: 'key_1',
    name: 'Production',
    prefix: 'sk_live_abc1',
    createdAt: '2024-01-10',
    lastUsed: '2024-01-15T10:30:00Z',
    status: 'active',
  },
  {
    id: 'key_2',
    name: 'Development',
    prefix: 'sk_test_xyz2',
    createdAt: '2024-01-05',
    lastUsed: '2024-01-14T15:45:00Z',
    status: 'active',
  },
];

const mockUsageData = {
  currentPeriod: {
    used: 3250,
    limit: 10000,
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
  },
  byEndpoint: [
    { endpoint: '/v1/rates/benchmark', calls: 1250, percentage: 38 },
    { endpoint: '/v1/availability/current', calls: 890, percentage: 27 },
    { endpoint: '/v1/demand/trends', calls: 650, percentage: 20 },
    { endpoint: '/v1/workforce/estimate', calls: 460, percentage: 15 },
  ],
  recentActivity: [
    {
      timestamp: '2024-01-15T10:30:00Z',
      endpoint: '/v1/rates/benchmark',
      status: 200,
      latency: 45,
    },
    {
      timestamp: '2024-01-15T10:29:55Z',
      endpoint: '/v1/availability/current',
      status: 200,
      latency: 38,
    },
    {
      timestamp: '2024-01-15T10:29:50Z',
      endpoint: '/v1/demand/emerging',
      status: 200,
      latency: 52,
    },
    { timestamp: '2024-01-15T10:29:45Z', endpoint: '/v1/rates/compare', status: 400, latency: 12 },
    {
      timestamp: '2024-01-15T10:29:40Z',
      endpoint: '/v1/workforce/estimate',
      status: 200,
      latency: 125,
    },
  ],
};

export default function APIDashboardPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  const handleCopyKey = (keyId: string, prefix: string) => {
    // In production, fetch the full key securely
    navigator.clipboard.writeText(`${prefix}...`);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const usagePercentage =
    (mockUsageData.currentPeriod.used / mockUsageData.currentPeriod.limit) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link className="text-gray-500 hover:text-gray-700" href="/api-portal">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-semibold">API Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/api-portal/docs">
              <Button size="sm" variant="outline">
                Documentation
              </Button>
            </Link>
            <Link href="/api-portal/pricing">
              <Button size="sm">Upgrade Plan</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Overview Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Professional</div>
              <p className="text-sm text-gray-500">$499/month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                API Calls This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockUsageData.currentPeriod.used.toLocaleString()}
              </div>
              <p className="text-sm text-gray-500">
                of {mockUsageData.currentPeriod.limit.toLocaleString()} included
              </p>
              <Progress className="mt-2" value={usagePercentage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">52ms</div>
              <p className="text-sm text-green-600">↓ 12% from last week</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* API Keys Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage your API keys for authentication</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New API Key</DialogTitle>
                      <DialogDescription>
                        Give your key a descriptive name to identify it later.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label htmlFor="keyName">Key Name</Label>
                      <Input
                        className="mt-2"
                        id="keyName"
                        placeholder="e.g., Production, Staging"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button onClick={() => setIsCreatingKey(true)}>
                        {isCreatingKey ? 'Creating...' : 'Create Key'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockApiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <div className="font-medium">{key.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
                            {visibleKeys.has(key.id)
                              ? `${key.prefix}xxxxxxxxxxxxx`
                              : `${key.prefix}...`}
                          </code>
                          <button
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => toggleKeyVisibility(key.id)}
                          >
                            {visibleKeys.has(key.id) ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => handleCopyKey(key.id, key.prefix)}
                          >
                            {copiedKey === key.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Created {key.createdAt} • Last used{' '}
                          {new Date(key.lastUsed).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            key.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {key.status}
                        </span>
                        <Button size="sm" variant="ghost">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          className="text-red-600 hover:text-red-700"
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Usage by Endpoint */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Usage by Endpoint</CardTitle>
                <CardDescription>API calls distribution this month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockUsageData.byEndpoint.map((item) => (
                    <div key={item.endpoint}>
                      <div className="mb-1 flex justify-between text-sm">
                        <code className="text-gray-600">{item.endpoint}</code>
                        <span className="text-gray-500">{item.calls.toLocaleString()} calls</span>
                      </div>
                      <Progress className="h-2" value={item.percentage} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link className="block" href="/api-portal/docs">
                  <Button className="w-full justify-start" variant="outline">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View API Documentation
                  </Button>
                </Link>
                <Link className="block" href="/api-portal/usage">
                  <Button className="w-full justify-start" variant="outline">
                    <Clock className="mr-2 h-4 w-4" />
                    View Usage History
                  </Button>
                </Link>
                <Link className="block" href="/api-portal/billing">
                  <Button className="w-full justify-start" variant="outline">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Manage Billing
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest API requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockUsageData.recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b py-2 text-sm last:border-0"
                    >
                      <div>
                        <code className="text-xs text-gray-600">
                          {activity.endpoint.split('/').slice(-1)[0]}
                        </code>
                        <div className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{activity.latency}ms</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            activity.status === 200
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/api-portal/logs">
                  <Button className="mt-4 w-full text-sm" variant="link">
                    View All Logs →
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm text-yellow-800">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Usage Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-yellow-700">
                  You've used 32.5% of your monthly quota. At this rate, you'll exceed your limit by
                  January 25th.
                </p>
                <Link href="/api-portal/pricing">
                  <Button className="mt-3" size="sm">
                    Upgrade Plan
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
