/**
 * Client Executives List Page
 *
 * Shows all executives engaged by the client organization
 * with status, time tracking, and quick actions.
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui';
import { Badge } from '@skillancer/ui';
import { Button } from '@skillancer/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui';
import {
  Users,
  Clock,
  Calendar,
  TrendingUp,
  Plus,
  Star,
  CheckCircle,
  MessageSquare,
  FileText,
} from 'lucide-react';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  PROPOSAL: 'bg-blue-100 text-blue-800',
  NEGOTIATING: 'bg-purple-100 text-purple-800',
  CONTRACT_SENT: 'bg-indigo-100 text-indigo-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

// TODO(Sprint-10): Replace with API call to GET /api/cockpit/executives/engagements
const mockEngagements = [
  {
    id: '1',
    executiveId: 'exec-1',
    executiveName: 'Sarah Chen',
    executivePhoto: null,
    executiveTitle: 'Fractional CTO',
    role: 'Technical Leadership & Strategy',
    status: 'ACTIVE',
    hoursPerWeek: 20,
    hoursThisMonth: 65,
    hoursApproved: 45,
    hoursPending: 20,
    startDate: '2024-06-01',
    rating: 4.9,
    nextMeeting: '2024-10-18T10:00:00',
    lastActivity: '2 hours ago',
  },
  {
    id: '2',
    executiveId: 'exec-2',
    executiveName: 'Michael Rodriguez',
    executivePhoto: null,
    executiveTitle: 'Fractional CFO',
    role: 'Financial Strategy & Fundraising',
    status: 'ACTIVE',
    hoursPerWeek: 15,
    hoursThisMonth: 48,
    hoursApproved: 48,
    hoursPending: 0,
    startDate: '2024-07-15',
    rating: 5.0,
    nextMeeting: '2024-10-20T14:00:00',
    lastActivity: 'Yesterday',
  },
  {
    id: '3',
    executiveId: 'exec-3',
    executiveName: 'Jennifer Walsh',
    executivePhoto: null,
    executiveTitle: 'Fractional CMO',
    role: 'Marketing Strategy',
    status: 'PROPOSAL',
    hoursPerWeek: 10,
    hoursThisMonth: 0,
    hoursApproved: 0,
    hoursPending: 0,
    startDate: null,
    rating: null,
    nextMeeting: null,
    lastActivity: null,
  },
];

const mockSummary = {
  activeExecutives: 2,
  totalHoursThisMonth: 113,
  totalHoursApproved: 93,
  totalHoursPending: 20,
  totalSpendThisMonth: 39550,
  avgRating: 4.95,
};

// Executive Card Component
function ExecutiveCard({ engagement }: { engagement: (typeof mockEngagements)[0] }) {
  const isActive = engagement.status === 'ACTIVE';

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white">
              {engagement.executiveName
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{engagement.executiveName}</h3>
              <p className="text-muted-foreground text-sm">{engagement.executiveTitle}</p>
              {engagement.rating && (
                <div className="mt-1 flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{engagement.rating}</span>
                </div>
              )}
            </div>
          </div>
          <Badge className={STATUS_COLORS[engagement.status]}>{engagement.status}</Badge>
        </div>

        <div className="bg-muted mt-4 rounded-lg p-3">
          <p className="text-sm font-medium">{engagement.role}</p>
          {engagement.startDate && (
            <p className="text-muted-foreground mt-1 text-xs">
              Since {new Date(engagement.startDate).toLocaleDateString()}
            </p>
          )}
        </div>

        {isActive && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Hours/Week</p>
                <p className="font-medium">{engagement.hoursPerWeek}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">This Month</p>
                <p className="font-medium">{engagement.hoursThisMonth}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pending</p>
                <p className="font-medium text-orange-600">{engagement.hoursPending}h</p>
              </div>
            </div>

            {engagement.nextMeeting && (
              <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>
                  Next meeting:{' '}
                  {new Date(engagement.nextMeeting).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button asChild className="flex-1">
                <Link href={`/executives/${engagement.id}`}>View Details</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/executives/${engagement.id}/time`}>
                  <Clock className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {engagement.status === 'PROPOSAL' && (
          <div className="mt-4 flex gap-2">
            <Button className="flex-1">Review Proposal</Button>
            <Button variant="outline" className="flex-1">
              Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Summary Stats Component
function SummaryStats() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">This Month</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="bg-muted rounded-lg p-4 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-blue-600" />
            <p className="text-2xl font-bold">{mockSummary.activeExecutives}</p>
            <p className="text-muted-foreground text-xs">Active Executives</p>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <Clock className="mx-auto mb-2 h-6 w-6 text-green-600" />
            <p className="text-2xl font-bold">{mockSummary.totalHoursThisMonth}h</p>
            <p className="text-muted-foreground text-xs">Total Hours</p>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <CheckCircle className="mx-auto mb-2 h-6 w-6 text-purple-600" />
            <p className="text-2xl font-bold">{mockSummary.totalHoursApproved}h</p>
            <p className="text-muted-foreground text-xs">Approved</p>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <TrendingUp className="mx-auto mb-2 h-6 w-6 text-orange-600" />
            <p className="text-2xl font-bold">
              ${(mockSummary.totalSpendThisMonth / 1000).toFixed(1)}k
            </p>
            <p className="text-muted-foreground text-xs">Total Spend</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClientExecutivesPage() {
  const activeEngagements = mockEngagements.filter(
    (e) => e.status === 'ACTIVE' || e.status === 'PAUSED'
  );
  const pipelineEngagements = mockEngagements.filter((e) =>
    ['PROPOSAL', 'NEGOTIATING', 'CONTRACT_SENT'].includes(e.status)
  );
  const completedEngagements = mockEngagements.filter((e) => e.status === 'COMPLETED');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Executives</h1>
          <p className="text-muted-foreground mt-1">
            Manage your fractional executives and engagements
          </p>
        </div>
        <Button asChild>
          <Link href="/executives/find">
            <Plus className="mr-2 h-4 w-4" />
            Find Executive
          </Link>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="mb-8">
        <SummaryStats />
      </div>

      {/* Pending Approvals Alert */}
      {mockSummary.totalHoursPending > 0 && (
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Time Approval Needed</p>
                <p className="text-muted-foreground text-sm">
                  {mockSummary.totalHoursPending} hours pending your approval
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/time/approve">Review Time</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Engagements Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="active">Active ({activeEngagements.length})</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline ({pipelineEngagements.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({completedEngagements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeEngagements.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">No Active Executives</h3>
              <p className="text-muted-foreground mb-4">
                You don&apos;t have any active executive engagements yet.
              </p>
              <Button asChild>
                <Link href="/executives/find">Find an Executive</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeEngagements.map((engagement) => (
                <ExecutiveCard key={engagement.id} engagement={engagement} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          {pipelineEngagements.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">No Pending Engagements</h3>
              <p className="text-muted-foreground">
                No executive engagements currently in the pipeline.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pipelineEngagements.map((engagement) => (
                <ExecutiveCard key={engagement.id} engagement={engagement} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {completedEngagements.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">No Past Engagements</h3>
              <p className="text-muted-foreground">Completed engagements will appear here.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {completedEngagements.map((engagement) => (
                <ExecutiveCard key={engagement.id} engagement={engagement} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
