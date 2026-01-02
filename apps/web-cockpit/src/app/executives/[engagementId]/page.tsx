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
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Star,
  MessageSquare,
  FileText,
  Settings,
  TrendingUp,
  DollarSign,
  Milestone,
  User,
  Building2,
  Phone,
  Mail,
  ExternalLink,
} from 'lucide-react';

// Mock data
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedEntries.length === mockPendingTimeEntries.length
                ? 'Deselect All'
                : 'Select All'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mockPendingTimeEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>All time entries have been reviewed!</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {mockPendingTimeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedEntries.includes(entry.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleSelect(entry.id)}
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
                        <p className="text-sm text-muted-foreground mt-1">
                          {entry.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(entry.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedEntries.length > 0 && (
              <div className="mt-4 flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">
                  {selectedEntries.length} entries selected (
                  {mockPendingTimeEntries
                    .filter((e) => selectedEntries.includes(e.id))
                    .reduce((sum, e) => sum + e.hours, 0)}
                  h)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button size="sm">
                    <CheckCircle className="h-4 w-4 mr-1" />
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
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
            {mockEngagement.executiveName.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{mockEngagement.executiveName}</h3>
            <p className="text-muted-foreground">{mockEngagement.executiveTitle}</p>
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{mockEngagement.rating}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${mockEngagement.executiveEmail}`} className="text-blue-600 hover:underline">
              {mockEngagement.executiveEmail}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{mockEngagement.executivePhone}</span>
          </div>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <a href={mockEngagement.executiveLinkedIn} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              LinkedIn Profile
            </a>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button className="flex-1">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
          <Button variant="outline" className="flex-1">
            <Calendar className="h-4 w-4 mr-2" />
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
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-blue-600">
              {mockEngagement.timeThisMonth.total}h
            </p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {mockEngagement.timeThisMonth.approved}h
            </p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Budget Utilization</span>
            <span className="font-medium">{budgetUtilization}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${budgetUtilization}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ${(mockEngagement.financials.yearToDate / 1000).toFixed(0)}k of $
            {(mockEngagement.financials.budget / 1000).toFixed(0)}k YTD
          </p>
        </div>

        <div className="pt-2 space-y-2 text-sm">
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
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div>
                <p className="font-medium text-sm">{milestone.title}</p>
                <p className="text-xs text-muted-foreground">
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
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  objective.completed
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {objective.completed ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
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
  const engagementId = params.engagementId as string;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/executives">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold">{mockEngagement.role}</h1>
            <p className="text-muted-foreground">
              with {mockEngagement.executiveName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
            {mockEngagement.status}
          </Badge>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
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
                <CardContent className="p-8 text-center text-muted-foreground">
                  Activity feed coming soon
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Shared documents coming soon
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="mt-6">
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
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
