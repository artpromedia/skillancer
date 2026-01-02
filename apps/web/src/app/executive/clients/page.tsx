/**
 * Executive Clients (Engagements) List Page
 *
 * Shows all client engagements for the logged-in executive with
 * filtering, status management, and quick actions.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  Building2,
  Clock,
  Calendar,
  TrendingUp,
  Plus,
  MoreVertical,
  Users,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  PROPOSAL: 'bg-blue-100 text-blue-800',
  NEGOTIATING: 'bg-purple-100 text-purple-800',
  CONTRACT_SENT: 'bg-indigo-100 text-indigo-800',
  CONTRACT_SIGNED: 'bg-cyan-100 text-cyan-800',
  ONBOARDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  RENEWAL: 'bg-pink-100 text-pink-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  TERMINATED: 'bg-red-100 text-red-800',
};

// Mock data - replace with API call
const mockEngagements = [
  {
    id: '1',
    title: 'Technical Leadership & Strategy',
    clientName: 'TechStart Inc',
    clientLogo: '/clients/techstart.png',
    role: 'FRACTIONAL_CTO',
    status: 'ACTIVE',
    hoursPerWeek: 20,
    hoursThisMonth: 65,
    startDate: '2024-06-01',
    nextMilestone: 'Q3 Tech Roadmap Review',
    nextMilestoneDate: '2024-10-15',
    billingModel: 'RETAINER',
    retainerAmount: 15000,
  },
  {
    id: '2',
    title: 'Financial Strategy & Fundraising',
    clientName: 'GrowthCo',
    clientLogo: '/clients/growthco.png',
    role: 'FRACTIONAL_CFO',
    status: 'ACTIVE',
    hoursPerWeek: 15,
    hoursThisMonth: 45,
    startDate: '2024-07-15',
    nextMilestone: 'Series A Preparation',
    nextMilestoneDate: '2024-11-01',
    billingModel: 'HOURLY',
    hourlyRate: 350,
  },
  {
    id: '3',
    title: 'Platform Migration Advisory',
    clientName: 'LegacyCorp',
    clientLogo: '/clients/legacycorp.png',
    role: 'FRACTIONAL_CTO',
    status: 'PROPOSAL',
    hoursPerWeek: 10,
    hoursThisMonth: 0,
    startDate: null,
    nextMilestone: null,
    nextMilestoneDate: null,
    billingModel: 'PROJECT',
    retainerAmount: 50000,
  },
];

const mockCapacity = {
  activeClients: 2,
  maxClients: 3,
  weeklyCommitted: 35,
  weeklyAvailable: 45,
};

// Engagement Card Component
function EngagementCard({ engagement }: { engagement: (typeof mockEngagements)[0] }) {
  const formatRole = (role: string) => {
    return role.replace('FRACTIONAL_', 'Fractional ').replace('_', ' ');
  };

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white">
              {engagement.clientName.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{engagement.clientName}</h3>
              <p className="text-muted-foreground text-sm">{engagement.title}</p>
            </div>
          </div>
          <Badge className={STATUS_COLORS[engagement.status]}>
            {engagement.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Role</p>
            <p className="font-medium">{formatRole(engagement.role)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hours/Week</p>
            <p className="font-medium">{engagement.hoursPerWeek}h</p>
          </div>
          <div>
            <p className="text-muted-foreground">This Month</p>
            <p className="font-medium">{engagement.hoursThisMonth}h logged</p>
          </div>
        </div>

        {engagement.nextMilestone && (
          <div className="bg-muted mt-4 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">Next Milestone</p>
            <p className="text-sm font-medium">{engagement.nextMilestone}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Due: {new Date(engagement.nextMilestoneDate).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button asChild className="flex-1">
            <Link href={`/executive/clients/${engagement.id}/workspace`}>Open Workspace</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/executive/clients/${engagement.id}/time`}>
              <Clock className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="icon" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Capacity Overview Component
function CapacityOverview() {
  const utilizationPercent = Math.round(
    (mockCapacity.weeklyCommitted / mockCapacity.weeklyAvailable) * 100
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Capacity Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="bg-muted rounded-lg p-4 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-blue-600" />
            <p className="text-2xl font-bold">
              {mockCapacity.activeClients}/{mockCapacity.maxClients}
            </p>
            <p className="text-muted-foreground text-xs">Active Clients</p>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <Clock className="mx-auto mb-2 h-6 w-6 text-green-600" />
            <p className="text-2xl font-bold">{mockCapacity.weeklyCommitted}h</p>
            <p className="text-muted-foreground text-xs">Weekly Committed</p>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <TrendingUp className="mx-auto mb-2 h-6 w-6 text-purple-600" />
            <p className="text-2xl font-bold">{utilizationPercent}%</p>
            <p className="text-muted-foreground text-xs">Utilization</p>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <Briefcase className="mx-auto mb-2 h-6 w-6 text-orange-600" />
            <p className="text-2xl font-bold">
              {mockCapacity.weeklyAvailable - mockCapacity.weeklyCommitted}h
            </p>
            <p className="text-muted-foreground text-xs">Available</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExecutiveClientsPage() {
  const activeEngagements = mockEngagements.filter(
    (e) => e.status === 'ACTIVE' || e.status === 'PAUSED' || e.status === 'ONBOARDING'
  );
  const pipelineEngagements = mockEngagements.filter((e) =>
    ['PROPOSAL', 'NEGOTIATING', 'CONTRACT_SENT', 'CONTRACT_SIGNED'].includes(e.status)
  );
  const completedEngagements = mockEngagements.filter(
    (e) => e.status === 'COMPLETED' || e.status === 'TERMINATED'
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage your client engagements and workspaces
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Engagement
        </Button>
      </div>

      {/* Capacity Overview */}
      <div className="mb-8">
        <CapacityOverview />
      </div>

      {/* Engagements Tabs */}
      <Tabs className="w-full" defaultValue="active">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="active">Active ({activeEngagements.length})</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline ({pipelineEngagements.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedEngagements.length})</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="active">
          {activeEngagements.length === 0 ? (
            <Card className="p-8 text-center">
              <Building2 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">No Active Engagements</h3>
              <p className="text-muted-foreground mb-4">
                You don&apos;t have any active client engagements yet.
              </p>
              <Button>Find Opportunities</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeEngagements.map((engagement) => (
                <EngagementCard key={engagement.id} engagement={engagement} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-6" value="pipeline">
          {pipelineEngagements.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">No Pipeline Engagements</h3>
              <p className="text-muted-foreground">
                No engagements currently in the proposal or contracting stage.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pipelineEngagements.map((engagement) => (
                <EngagementCard key={engagement.id} engagement={engagement} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-6" value="completed">
          {completedEngagements.length === 0 ? (
            <Card className="p-8 text-center">
              <DollarSign className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">No Completed Engagements</h3>
              <p className="text-muted-foreground">Completed engagements will appear here.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {completedEngagements.map((engagement) => (
                <EngagementCard key={engagement.id} engagement={engagement} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
