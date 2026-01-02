'use client';

/**
 * Admin Match Requests Dashboard
 * Review and process executive matching requests
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui';
import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Users, Clock, CheckCircle, XCircle, Eye, Send } from 'lucide-react';
import { useState } from 'react';

// Mock data
const matchRequests = [
  {
    id: '1',
    clientName: 'John Doe',
    clientCompany: 'TechStart Inc',
    executiveType: 'FRACTIONAL_CTO',
    hoursPerWeek: 15,
    status: 'PENDING',
    createdAt: '2024-12-30',
    matchCount: 0,
  },
  {
    id: '2',
    clientName: 'Jane Smith',
    clientCompany: 'Growth Co',
    executiveType: 'FRACTIONAL_CFO',
    hoursPerWeek: 20,
    status: 'MATCHING',
    createdAt: '2024-12-29',
    matchCount: 3,
  },
  {
    id: '3',
    clientName: 'Bob Wilson',
    clientCompany: 'Acme Labs',
    executiveType: 'FRACTIONAL_CMO',
    hoursPerWeek: 10,
    status: 'INTRO_SCHEDULED',
    createdAt: '2024-12-28',
    matchCount: 2,
  },
  {
    id: '4',
    clientName: 'Alice Brown',
    clientCompany: 'DataFlow',
    executiveType: 'FRACTIONAL_CTO',
    hoursPerWeek: 25,
    status: 'COMPLETED',
    createdAt: '2024-12-25',
    matchCount: 1,
  },
];

const stats = {
  pending: 12,
  matching: 8,
  introScheduled: 5,
  completed: 45,
  avgMatchTime: '18 hours',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  MATCHING: 'bg-blue-100 text-blue-800',
  INTRO_SCHEDULED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function AdminMatchRequestsPage() {
  const [filter, setFilter] = useState('all');

  const filteredRequests =
    filter === 'all' ? matchRequests : matchRequests.filter((r) => r.status === filter);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Match Requests</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-500">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.matching}</div>
            <div className="text-sm text-gray-500">Matching</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.introScheduled}</div>
            <div className="text-sm text-gray-500">Intros Scheduled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.avgMatchTime}</div>
            <div className="text-sm text-gray-500">Avg Match Time</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Requests</CardTitle>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
              <TabsTrigger value="MATCHING">Matching</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50 text-sm text-gray-500">
              <tr>
                <th className="p-4 text-left">Client</th>
                <th className="p-4 text-left">Company</th>
                <th className="p-4 text-left">Type</th>
                <th className="p-4 text-left">Hours</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Matches</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium">{r.clientName}</td>
                  <td className="p-4 text-gray-500">{r.clientCompany}</td>
                  <td className="p-4">
                    <Badge variant="outline">{r.executiveType.replace('FRACTIONAL_', '')}</Badge>
                  </td>
                  <td className="p-4">{r.hoursPerWeek}/wk</td>
                  <td className="p-4">
                    <Badge className={statusColors[r.status]}>{r.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="p-4">{r.matchCount}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {r.status === 'PENDING' && (
                        <Button size="sm">
                          <Send className="mr-1 h-4 w-4" />
                          Match
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
