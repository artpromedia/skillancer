'use client';

/**
 * Admin Subscriptions Dashboard
 * Overview of executive subscriptions and revenue
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui';
import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { CreditCard, TrendingUp, Users, DollarSign, AlertCircle, BarChart3 } from 'lucide-react';

// Mock data
const stats = {
  totalSubscriptions: 156,
  activeSubscriptions: 142,
  mrr: 89450,
  arr: 1073400,
  churnRate: 2.3,
  trialConversions: 78,
};

const tierBreakdown = [
  { tier: 'BASIC', count: 45, mrr: 8955, percentage: 29 },
  { tier: 'PRO', count: 87, mrr: 43413, percentage: 56 },
  { tier: 'ENTERPRISE', count: 10, mrr: 37082, percentage: 6 },
];

const recentSubscriptions = [
  {
    id: '1',
    executive: 'Sarah Chen',
    tier: 'PRO',
    status: 'ACTIVE',
    startDate: '2024-12-28',
    mrr: 499,
  },
  {
    id: '2',
    executive: 'Michael Rodriguez',
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    startDate: '2024-12-27',
    mrr: 2500,
  },
  {
    id: '3',
    executive: 'Jennifer Walsh',
    tier: 'BASIC',
    status: 'TRIALING',
    startDate: '2024-12-26',
    mrr: 199,
  },
  {
    id: '4',
    executive: 'David Kim',
    tier: 'PRO',
    status: 'ACTIVE',
    startDate: '2024-12-25',
    mrr: 499,
  },
];

const atRiskSubscriptions = [
  { id: '1', executive: 'John Smith', tier: 'PRO', reason: 'Payment failed', daysOverdue: 5 },
  {
    id: '2',
    executive: 'Emily Johnson',
    tier: 'BASIC',
    reason: 'Cancellation requested',
    daysUntilEnd: 12,
  },
];

const tierColors = {
  BASIC: 'bg-gray-100 text-gray-800',
  PRO: 'bg-purple-100 text-purple-800',
  ENTERPRISE: 'bg-amber-100 text-amber-800',
};
const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  TRIALING: 'bg-blue-100 text-blue-800',
  PAST_DUE: 'bg-red-100 text-red-800',
};

export default function AdminSubscriptionsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subscription Management</h1>
        <Button variant="outline">
          <BarChart3 className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
                <div className="text-sm text-gray-500">Active Subscriptions</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">${(stats.mrr / 1000).toFixed(1)}k</div>
                <div className="text-sm text-gray-500">MRR</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">${(stats.arr / 1000).toFixed(0)}k</div>
                <div className="text-sm text-gray-500">ARR</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.churnRate}%</div>
                <div className="text-sm text-gray-500">Churn Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tierBreakdown.map((t) => (
              <div key={t.tier} className="flex items-center gap-4">
                <Badge className={tierColors[t.tier as keyof typeof tierColors]}>{t.tier}</Badge>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full bg-purple-500" style={{ width: `${t.percentage}%` }} />
                </div>
                <div className="w-24 text-right text-sm">{t.count} subs</div>
                <div className="w-24 text-right text-sm font-medium">
                  ${t.mrr.toLocaleString()}/mo
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="atrisk">At Risk ({atRiskSubscriptions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="recent">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 text-sm text-gray-500">
                  <tr>
                    <th className="p-4 text-left">Executive</th>
                    <th className="p-4 text-left">Tier</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Start Date</th>
                    <th className="p-4 text-right">MRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentSubscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium">{s.executive}</td>
                      <td className="p-4">
                        <Badge className={tierColors[s.tier as keyof typeof tierColors]}>
                          {s.tier}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge className={statusColors[s.status as keyof typeof statusColors]}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-gray-500">{s.startDate}</td>
                      <td className="p-4 text-right font-medium">${s.mrr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="atrisk">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 text-sm text-gray-500">
                  <tr>
                    <th className="p-4 text-left">Executive</th>
                    <th className="p-4 text-left">Tier</th>
                    <th className="p-4 text-left">Issue</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {atRiskSubscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium">{s.executive}</td>
                      <td className="p-4">
                        <Badge className={tierColors[s.tier as keyof typeof tierColors]}>
                          {s.tier}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          {s.reason}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button size="sm">View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
