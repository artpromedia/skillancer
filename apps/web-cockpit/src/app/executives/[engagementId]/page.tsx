/**
 * Client Engagement Detail Page
 *
 * Detailed view of a specific executive engagement from
 * the client's perspective with time approval, milestones,
 * and communication.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@skillancer/ui';
import { Badge } from '@skillancer/ui';
import { Button } from '@skillancer/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Star,
  MessageSquare,
  Settings,
  Phone,
  Mail,
  ExternalLink,
} from 'lucide-react';

// TODO(Sprint-10): Replace with API call to GET /api/cockpit/executives/engagements/:id
const mockEngagement = {
  id: '1',
  executiveId: 'exec-1',
  executiveName: 'Sarah Chen',
  executivePhoto: null,
  executiveTitle: 'Fractional CTO',
  executiveEmail: 'sarah.chen@example.com',
  executivePhone: '+1 (555) 123-4567',
  executiveLinkedIn: 'https://linkedin.com/in/sarahchen',
  role: 'Technical Leadership & Strategy',
  description:
    'Providing strategic technical leadership including roadmap development, team building, and architecture decisions.',
  status: 'ACTIVE',
  startDate: '2024-06-01',
  hoursPerWeek: 20,
  billingModel: 'RETAINER',
  retainerAmount: 15000,
  overageRate: 350,
  objectives: [
    { id: '1', text: 'Establish technical roadmap for next 12 months', completed: true },
    { id: '2', text: 'Build and mentor engineering team', completed: false },
    { id: '3', text: 'Implement CI/CD and DevOps best practices', completed: false },
    { id: '4', text: 'Lead Series A technical due diligence preparation', completed: false },
  ],
  milestones: [
    { id: '1', title: 'Technical Roadmap Complete', dueDate: '2024-07-15', status: 'COMPLETED' },
    { id: '2', title: 'Q3 Tech Review', dueDate: '2024-10-15', status: 'IN_PROGRESS' },
    { id: '3', title: 'DevOps Pipeline', dueDate: '2024-11-01', status: 'NOT_STARTED' },
  ],
  rating: 4.9,
  timeThisMonth: {
    total: 65,
    approved: 45,
    pending: 20,
    rejected: 0,
  },
  financials: {
    monthToDate: 17500,
    yearToDate: 85000,
    budget: 180000,
  },
};

const mockPendingTimeEntries = [
  {
    id: '1',
    date: '2024-10-14',
    hours: 4,
    description: 'Architecture review meeting with engineering team',
    category: 'MEETINGS',
    billable: true,
  },
  {
    id: '2',
    date: '2024-10-15',
    hours: 6,
    description: 'CI/CD pipeline implementation and documentation',
    category: 'EXECUTION',
    billable: true,
  },
  {
    id: '3',
    date: '2024-10-16',
    hours: 5,
    description: 'Sprint planning and backlog refinement',
    category: 'STRATEGY',
    billable: true,
  },
  {
    id: '4',
    date: '2024-10-17',
    hours: 5,
    description: 'Technical interviews for senior engineer role',
    category: 'MEETINGS',
    billable: true,
  },
];

// Status colors
const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

const CATEGORY_COLORS: Record<string, string> = {
  ADVISORY: 'bg-blue-100 text-blue-800',
  STRATEGY: 'bg-purple-100 text-purple-800',
  EXECUTION: 'bg-green-100 text-green-800',
  MEETINGS: 'bg-orange-100 text-orange-800',
  DOCUMENTATION: 'bg-cyan-100 text-cyan-800',
};

// Time Approval Component
function TimeApprovalSection() {
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  const handleSelectAll = () => {
    if (selectedEntries.length === mockPendingTimeEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(mockPendingTimeEntries.map((e) => e.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedEntries((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const totalPendingHours = mockPendingTimeEntries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Time Pending Approval</CardTitle>
            <CardDescription>{totalPendingHours} hours awaiting review</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedEntries.length === mockPendingTimeEntries.length
                ? 'Deselect All'
                : 'Select All'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mockPendingTimeEntries.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <p>All time entries have been reviewed!</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {mockPendingTimeEntries.map((entry) => (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                    selectedEntries.includes(entry.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleSelect(entry.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(entry.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(entry.id)}
                        onChange={() => handleSelect(entry.id)}
                        className="h-4 w-4"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.hours}h</span>
                          <Badge className={CATEGORY_COLORS[entry.category]}>
                            {entry.category}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">{entry.description}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {new Date(entry.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedEntries.length > 0 && (
              <div className="bg-muted mt-4 flex items-center justify-between rounded-lg p-3">
                <span className="text-sm font-medium">
                  {selectedEntries.length} entries selected (
                  {mockPendingTimeEntries
                    .filter((e) => selectedEntries.includes(e.id))
                    .reduce((sum, e) => sum + e.hours, 0)}
                  h)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <XCircle className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                  <Button size="sm">
                    <CheckCircle className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Executive Info Card
function ExecutiveInfoCard() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xl font-bold text-white">
            {mockEngagement.executiveName
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{mockEngagement.executiveName}</h3>
            <p className="text-muted-foreground">{mockEngagement.executiveTitle}</p>
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{mockEngagement.rating}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="text-muted-foreground h-4 w-4" />
            <a
              href={`mailto:${mockEngagement.executiveEmail}`}
              className="text-blue-600 hover:underline"
            >
              {mockEngagement.executiveEmail}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="text-muted-foreground h-4 w-4" />
            <span>{mockEngagement.executivePhone}</span>
          </div>
          <div className="flex items-center gap-2">
            <ExternalLink className="text-muted-foreground h-4 w-4" />
            <a
              href={mockEngagement.executiveLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              LinkedIn Profile
            </a>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1">
            <MessageSquare className="mr-2 h-4 w-4" />
            Message
          </Button>
          <Button variant="outline" className="flex-1">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Engagement Stats Card
function EngagementStatsCard() {
  const budgetUtilization = Math.round(
    (mockEngagement.financials.yearToDate / mockEngagement.financials.budget) * 100
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Engagement Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {mockEngagement.timeThisMonth.total}h
            </p>
            <p className="text-muted-foreground text-xs">This Month</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {mockEngagement.timeThisMonth.approved}h
            </p>
            <p className="text-muted-foreground text-xs">Approved</p>
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Budget Utilization</span>
            <span className="font-medium">{budgetUtilization}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${budgetUtilization}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            ${(mockEngagement.financials.yearToDate / 1000).toFixed(0)}k of $
            {(mockEngagement.financials.budget / 1000).toFixed(0)}k YTD
          </p>
        </div>

        <div className="space-y-2 pt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hours/Week</span>
            <span className="font-medium">{mockEngagement.hoursPerWeek}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Billing Model</span>
            <span className="font-medium">{mockEngagement.billingModel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retainer</span>
            <span className="font-medium">
              ${mockEngagement.retainerAmount.toLocaleString()}/mo
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Overage Rate</span>
            <span className="font-medium">${mockEngagement.overageRate}/hr</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Milestones Card
function MilestonesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Milestones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockEngagement.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">{milestone.title}</p>
                <p className="text-muted-foreground text-xs">
                  Due: {new Date(milestone.dueDate).toLocaleDateString()}
                </p>
              </div>
              <Badge className={STATUS_COLORS[milestone.status]}>
                {milestone.status.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Objectives Card
function ObjectivesCard() {
  const completed = mockEngagement.objectives.filter((o) => o.completed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Objectives</CardTitle>
          <Badge variant="outline">
            {completed}/{mockEngagement.objectives.length} Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {mockEngagement.objectives.map((objective) => (
            <div key={objective.id} className="flex items-start gap-2">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  objective.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {objective.completed ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </div>
              <span
                className={`text-sm ${
                  objective.completed ? 'text-muted-foreground line-through' : ''
                }`}
              >
                {objective.text}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClientEngagementDetailPage() {
  const params = useParams();
  const _engagementId = params.engagementId as string;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/executives">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold">{mockEngagement.role}</h1>
            <p className="text-muted-foreground">with {mockEngagement.executiveName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 px-3 py-1 text-sm text-green-800">
            {mockEngagement.status}
          </Badge>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="time">
            <TabsList>
              <TabsTrigger value="time">Time Approval</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="time" className="mt-6">
              <TimeApprovalSection />
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardContent className="text-muted-foreground p-8 text-center">
                  Activity feed coming soon
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <Card>
                <CardContent className="text-muted-foreground p-8 text-center">
                  Shared documents coming soon
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="mt-6">
              <Card>
                <CardContent className="text-muted-foreground p-8 text-center">
                  Billing history coming soon
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <ExecutiveInfoCard />
          <EngagementStatsCard />
          <MilestonesCard />
          <ObjectivesCard />
        </div>
      </div>
    </div>
  );
}
