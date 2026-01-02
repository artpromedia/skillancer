/**
 * Executive Client Workspace Page
 *
 * Per-client workspace with customizable widgets, quick actions,
 * time tracking, and SkillPod integration.
 */

'use client';

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
  ArrowLeft,
  Clock,
  Calendar,
  FileText,
  MessageSquare,
  Settings,
  Play,
  Pin,
  Link as LinkIcon,
  Milestone,
  TrendingUp,
  Users,
  Code,
  ChevronRight,
  Plus,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { SkillPodLauncher } from '@/components/executive/workspace/skillpod-launcher';
import { TimeEntryForm } from '@/components/executive/workspace/time-entry-form';
import { WidgetGrid } from '@/components/executive/workspace/widget-grid';

// Mock engagement data
const mockEngagement = {
  id: '1',
  title: 'Technical Leadership & Strategy',
  clientName: 'TechStart Inc',
  clientLogo: null,
  role: 'FRACTIONAL_CTO',
  status: 'ACTIVE',
  hoursPerWeek: 20,
  hoursThisWeek: 12,
  hoursThisMonth: 65,
  startDate: '2024-06-01',
  objectives: [
    'Establish technical roadmap for next 12 months',
    'Build and mentor engineering team',
    'Implement CI/CD and DevOps best practices',
    'Lead Series A technical due diligence preparation',
  ],
  milestones: [
    { id: '1', title: 'Q3 Tech Roadmap Review', dueDate: '2024-10-15', status: 'IN_PROGRESS' },
    { id: '2', title: 'DevOps Pipeline Complete', dueDate: '2024-11-01', status: 'NOT_STARTED' },
    { id: '3', title: 'Team Hiring Plan', dueDate: '2024-09-30', status: 'COMPLETED' },
  ],
  pinnedDocuments: [
    { id: '1', name: 'Technical Roadmap 2024', type: 'doc', url: '#' },
    { id: '2', name: 'Architecture Diagram', type: 'image', url: '#' },
    { id: '3', name: 'Team OKRs Q4', type: 'spreadsheet', url: '#' },
  ],
  pinnedLinks: [
    { id: '1', name: 'Slack Channel', url: '#' },
    { id: '2', name: 'GitHub Org', url: '#' },
    { id: '3', name: 'Notion Wiki', url: '#' },
  ],
  recentActivity: [
    { id: '1', type: 'time', message: 'Logged 3 hours - Architecture review', time: '2 hours ago' },
    {
      id: '2',
      type: 'milestone',
      message: 'Completed milestone: Team Hiring Plan',
      time: 'Yesterday',
    },
    { id: '3', type: 'meeting', message: 'Joined standup meeting', time: '2 days ago' },
  ],
  skillpodEnabled: true,
  skillpodConfig: {
    accessLevel: 'ADMIN',
  },
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

// Quick Stats Component
function QuickStats() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">This Week</p>
              <p className="text-xl font-bold">
                {mockEngagement.hoursThisWeek}/{mockEngagement.hoursPerWeek}h
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">This Month</p>
              <p className="text-xl font-bold">{mockEngagement.hoursThisMonth}h</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Milestone className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Milestones</p>
              <p className="text-xl font-bold">
                {mockEngagement.milestones.filter((m) => m.status === 'COMPLETED').length}/
                {mockEngagement.milestones.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Engagement</p>
              <p className="text-xl font-bold">4mo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Quick Access Panel Component
function QuickAccessPanel() {
  const [showTimeEntry, setShowTimeEntry] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="justify-start"
            variant="outline"
            onClick={() => setShowTimeEntry(true)}
          >
            <Clock className="mr-2 h-4 w-4" />
            Log Time
          </Button>
          <Button className="justify-start" variant="outline">
            <MessageSquare className="mr-2 h-4 w-4" />
            Message
          </Button>
          <Button className="justify-start" variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Notes
          </Button>
          <Button className="justify-start" variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
        </div>

        {/* Pinned Documents */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-sm font-medium">
              <Pin className="h-4 w-4" />
              Pinned Documents
            </h4>
            <Button size="sm" variant="ghost">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {mockEngagement.pinnedDocuments.map((doc) => (
              <a
                key={doc.id}
                className="hover:bg-muted flex items-center gap-2 rounded-md p-2 text-sm"
                href={doc.url}
              >
                <FileText className="text-muted-foreground h-4 w-4" />
                <span className="truncate">{doc.name}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Pinned Links */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-sm font-medium">
              <LinkIcon className="h-4 w-4" />
              Pinned Links
            </h4>
            <Button size="sm" variant="ghost">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {mockEngagement.pinnedLinks.map((link) => (
              <a
                key={link.id}
                className="hover:bg-muted flex items-center gap-2 rounded-md p-2 text-sm"
                href={link.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <LinkIcon className="text-muted-foreground h-4 w-4" />
                <span className="truncate">{link.name}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Time Entry Modal */}
        {showTimeEntry && (
          <TimeEntryForm
            engagementId={mockEngagement.id}
            onClose={() => setShowTimeEntry(false)}
            onSubmit={(entry) => {
              console.log('Time entry submitted:', entry);
              setShowTimeEntry(false);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// Milestones Panel Component
function MilestonesPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Milestones</CardTitle>
          <Button size="sm" variant="ghost">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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
        <Button className="mt-3 p-0" variant="link">
          View all milestones
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// Activity Feed Component
function ActivityFeed() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockEngagement.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm">{activity.message}</p>
                <p className="text-muted-foreground text-xs">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Objectives Panel Component
function ObjectivesPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Engagement Objectives</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {mockEngagement.objectives.map((objective, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-700">
                {i + 1}
              </span>
              {objective}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function ExecutiveWorkspacePage() {
  const params = useParams();
  const engagementId = params.engagementId as string;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild size="sm" variant="ghost">
                <Link href="/executive/clients">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to Clients
                </Link>
              </Button>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white">
                  {mockEngagement.clientName.charAt(0)}
                </div>
                <div>
                  <h1 className="font-semibold">{mockEngagement.clientName}</h1>
                  <p className="text-muted-foreground text-sm">{mockEngagement.title}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mockEngagement.skillpodEnabled && (
                <SkillPodLauncher
                  accessLevel={mockEngagement.skillpodConfig.accessLevel}
                  engagementId={mockEngagement.id}
                />
              )}
              <Button size="sm" variant="outline">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="mb-6">
          <QuickStats />
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Widget Grid */}
          <div className="space-y-6 lg:col-span-2">
            <Tabs defaultValue="dashboard">
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="time">Time Tracking</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent className="mt-6" value="dashboard">
                <WidgetGrid
                  enabledWidgets={['milestones', 'recent-activity', 'tech-health']}
                  engagementId={mockEngagement.id}
                />
              </TabsContent>

              <TabsContent className="mt-6" value="time">
                <Card>
                  <CardHeader>
                    <CardTitle>Time Entries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Time tracking interface</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent className="mt-6" value="documents">
                <Card>
                  <CardHeader>
                    <CardTitle>Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Document management</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent className="mt-6" value="notes">
                <Card>
                  <CardHeader>
                    <CardTitle>Executive Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Private notes for this engagement</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            <QuickAccessPanel />
            <MilestonesPanel />
            <ObjectivesPanel />
            <ActivityFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
