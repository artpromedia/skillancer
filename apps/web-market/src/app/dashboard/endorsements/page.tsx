/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Heart,
  Inbox,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Helper Functions
// ============================================================================

type RequestAction = 'accept' | 'decline';
type RequestStatus = 'pending' | 'accepted' | 'declined';

function getStatusFromAction(action: RequestAction): RequestStatus {
  if (action === 'accept') return 'accepted';
  return 'declined';
}

// ============================================================================
// Types
// ============================================================================

interface Endorsement {
  id: string;
  skill: {
    id: string;
    name: string;
    category: string;
  };
  endorser: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
    company?: string;
  };
  relationship: 'client' | 'colleague' | 'manager' | 'mentor' | 'collaborator';
  endorsementText?: string;
  projectContext?: {
    id: string;
    title: string;
  };
  createdAt: string;
  featured: boolean;
}

interface EndorsementRequest {
  id: string;
  type: 'incoming' | 'outgoing';
  skill: {
    id: string;
    name: string;
  };
  person: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
  };
  message?: string;
  projectContext?: {
    id: string;
    title: string;
  };
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt?: string;
}

interface SkillEndorsementSummary {
  skillId: string;
  skillName: string;
  category: string;
  totalEndorsements: number;
  recentEndorsements: number;
  topEndorsers: Array<{
    id: string;
    name: string;
    avatar?: string;
    title?: string;
  }>;
  percentile?: number;
}

interface EndorsementSettings {
  allowPublicEndorsements: boolean;
  requireApproval: boolean;
  showOnProfile: boolean;
  emailNotifications: boolean;
  endorsementVisibility: 'public' | 'connections' | 'private';
}

// ============================================================================
// Mock Data
// ============================================================================

const mockEndorsements: Endorsement[] = [
  {
    id: '1',
    skill: { id: 's1', name: 'React', category: 'Frontend Development' },
    endorser: {
      id: 'u1',
      name: 'Sarah Chen',
      avatar: '/avatars/sarah.jpg',
      title: 'Engineering Manager',
      company: 'TechCorp',
    },
    relationship: 'client',
    endorsementText:
      'Outstanding React developer. Built our entire dashboard from scratch with excellent performance and clean code. Highly recommend for any frontend project.',
    projectContext: { id: 'p1', title: 'Enterprise Dashboard Redesign' },
    createdAt: '2024-01-15T10:00:00Z',
    featured: true,
  },
  {
    id: '2',
    skill: { id: 's2', name: 'TypeScript', category: 'Programming Languages' },
    endorser: {
      id: 'u2',
      name: 'Michael Park',
      avatar: '/avatars/michael.jpg',
      title: 'Senior Developer',
      company: 'StartupXYZ',
    },
    relationship: 'colleague',
    endorsementText:
      'Exceptional TypeScript skills. Helped establish our type system and best practices.',
    createdAt: '2024-01-10T14:30:00Z',
    featured: true,
  },
  {
    id: '3',
    skill: { id: 's1', name: 'React', category: 'Frontend Development' },
    endorser: {
      id: 'u3',
      name: 'Emily Watson',
      avatar: '/avatars/emily.jpg',
      title: 'Product Manager',
      company: 'InnovateCo',
    },
    relationship: 'client',
    createdAt: '2024-01-05T09:15:00Z',
    featured: false,
  },
  {
    id: '4',
    skill: { id: 's3', name: 'Node.js', category: 'Backend Development' },
    endorser: {
      id: 'u4',
      name: 'David Kim',
      avatar: '/avatars/david.jpg',
      title: 'CTO',
      company: 'DevAgency',
    },
    relationship: 'collaborator',
    endorsementText: 'Built robust APIs that handled millions of requests. Great problem solver.',
    projectContext: { id: 'p2', title: 'API Gateway Project' },
    createdAt: '2023-12-20T16:00:00Z',
    featured: false,
  },
];

const mockRequests: EndorsementRequest[] = [
  {
    id: 'r1',
    type: 'incoming',
    skill: { id: 's1', name: 'React' },
    person: {
      id: 'u5',
      name: 'Alex Thompson',
      avatar: '/avatars/alex.jpg',
      title: 'Freelance Developer',
    },
    message:
      'We worked together on the e-commerce platform last month. Would you endorse my React skills?',
    projectContext: { id: 'p3', title: 'E-commerce Platform' },
    status: 'pending',
    createdAt: '2024-01-18T11:00:00Z',
    expiresAt: '2024-02-18T11:00:00Z',
  },
  {
    id: 'r2',
    type: 'outgoing',
    skill: { id: 's4', name: 'GraphQL' },
    person: {
      id: 'u6',
      name: 'Jessica Liu',
      avatar: '/avatars/jessica.jpg',
      title: 'Senior Engineer at Meta',
    },
    message: 'Would appreciate an endorsement for our work on the GraphQL API optimization.',
    status: 'pending',
    createdAt: '2024-01-16T09:30:00Z',
  },
];

const mockSkillSummaries: SkillEndorsementSummary[] = [
  {
    skillId: 's1',
    skillName: 'React',
    category: 'Frontend Development',
    totalEndorsements: 24,
    recentEndorsements: 5,
    topEndorsers: [
      { id: 'u1', name: 'Sarah Chen', avatar: '/avatars/sarah.jpg', title: 'Engineering Manager' },
      { id: 'u3', name: 'Emily Watson', avatar: '/avatars/emily.jpg', title: 'Product Manager' },
      { id: 'u7', name: 'James Lee', avatar: '/avatars/james.jpg', title: 'Tech Lead' },
    ],
    percentile: 95,
  },
  {
    skillId: 's2',
    skillName: 'TypeScript',
    category: 'Programming Languages',
    totalEndorsements: 18,
    recentEndorsements: 3,
    topEndorsers: [
      { id: 'u2', name: 'Michael Park', avatar: '/avatars/michael.jpg', title: 'Senior Developer' },
      { id: 'u8', name: 'Anna Brown', avatar: '/avatars/anna.jpg', title: 'Staff Engineer' },
    ],
    percentile: 88,
  },
  {
    skillId: 's3',
    skillName: 'Node.js',
    category: 'Backend Development',
    totalEndorsements: 12,
    recentEndorsements: 2,
    topEndorsers: [{ id: 'u4', name: 'David Kim', avatar: '/avatars/david.jpg', title: 'CTO' }],
    percentile: 75,
  },
];

const mockSettings: EndorsementSettings = {
  allowPublicEndorsements: true,
  requireApproval: false,
  showOnProfile: true,
  emailNotifications: true,
  endorsementVisibility: 'public',
};

// ============================================================================
// Helper Components
// ============================================================================

const relationshipLabels: Record<Endorsement['relationship'], string> = {
  client: 'Client',
  colleague: 'Colleague',
  manager: 'Manager',
  mentor: 'Mentor',
  collaborator: 'Collaborator',
};

const relationshipColors: Record<Endorsement['relationship'], string> = {
  client: 'bg-blue-100 text-blue-700',
  colleague: 'bg-green-100 text-green-700',
  manager: 'bg-purple-100 text-purple-700',
  mentor: 'bg-amber-100 text-amber-700',
  collaborator: 'bg-teal-100 text-teal-700',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ============================================================================
// Stats Cards Component
// ============================================================================

function EndorsementStats() {
  const stats = {
    totalReceived: 54,
    totalGiven: 23,
    pendingRequests: 2,
    thisMonth: 8,
    profileViews: 156,
    endorsementRate: 78,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Received</p>
              <p className="text-3xl font-bold">{stats.totalReceived}</p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <ThumbsUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            <span className="font-medium text-green-600">+{stats.thisMonth}</span> this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Given</p>
              <p className="text-3xl font-bold">{stats.totalGiven}</p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <Heart className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">Helping others build trust</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold">{stats.pendingRequests}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-3">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">Requests awaiting response</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Endorsement Rate</p>
              <p className="text-3xl font-bold">{stats.endorsementRate}%</p>
            </div>
            <div className="rounded-full bg-purple-100 p-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <Progress className="mt-2" value={stats.endorsementRate} />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Skill Summary Component
// ============================================================================

function SkillEndorsementCard({ summary }: Readonly<{ summary: SkillEndorsementSummary }>) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{summary.skillName}</h3>
              {summary.percentile && summary.percentile >= 90 && (
                <Badge className="bg-amber-100 text-amber-700" variant="secondary">
                  <Star className="mr-1 h-3 w-3" />
                  Top {100 - summary.percentile}%
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{summary.category}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{summary.totalEndorsements}</p>
            <p className="text-muted-foreground text-xs">endorsements</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {summary.topEndorsers.slice(0, 5).map((endorser) => (
              <TooltipProvider key={endorser.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8 border-2 border-white">
                      <AvatarImage alt={endorser.name} src={endorser.avatar} />
                      <AvatarFallback className="text-xs">
                        {endorser.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{endorser.name}</p>
                    {endorser.title && (
                      <p className="text-muted-foreground text-xs">{endorser.title}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {summary.totalEndorsements > 5 && (
              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-medium">
                +{summary.totalEndorsements - 5}
              </div>
            )}
          </div>

          {summary.recentEndorsements > 0 && (
            <Badge className="bg-green-100 text-green-700" variant="secondary">
              <Sparkles className="mr-1 h-3 w-3" />+{summary.recentEndorsements} recent
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Endorsement Card Component
// ============================================================================

function EndorsementCard({
  endorsement,
  onToggleFeatured,
}: Readonly<{
  endorsement: Endorsement;
  onToggleFeatured: (id: string) => void;
}>) {
  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        endorsement.featured && 'ring-2 ring-amber-200'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage alt={endorsement.endorser.name} src={endorsement.endorser.avatar} />
            <AvatarFallback>
              {endorsement.endorser.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    className="font-semibold hover:underline"
                    href={`/freelancers/${endorsement.endorser.id}`}
                  >
                    {endorsement.endorser.name}
                  </Link>
                  <Badge
                    className={relationshipColors[endorsement.relationship]}
                    variant="secondary"
                  >
                    {relationshipLabels[endorsement.relationship]}
                  </Badge>
                </div>
                {endorsement.endorser.title && (
                  <p className="text-muted-foreground text-sm">
                    {endorsement.endorser.title}
                    {endorsement.endorser.company && ` at ${endorsement.endorser.company}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className={cn('h-8 w-8 p-0', endorsement.featured && 'text-amber-500')}
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleFeatured(endorsement.id)}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={endorsement.featured ? 'currentColor' : 'none'}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {endorsement.featured ? 'Remove from featured' : 'Feature on profile'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="mt-2">
              <Badge className="font-normal" variant="outline">
                {endorsement.skill.name}
              </Badge>
              {endorsement.projectContext && (
                <Link
                  className="text-muted-foreground ml-2 inline-flex items-center text-xs hover:underline"
                  href={`/contracts/${endorsement.projectContext.id}`}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  {endorsement.projectContext.title}
                </Link>
              )}
            </div>

            {endorsement.endorsementText && (
              <p className="text-muted-foreground mt-3 text-sm italic">
                &quot;{endorsement.endorsementText}&quot;
              </p>
            )}

            <p className="text-muted-foreground mt-2 text-xs">
              {formatTimeAgo(endorsement.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Request Card Component
// ============================================================================

function RequestCard({
  request,
  onRespond,
}: Readonly<{
  request: EndorsementRequest;
  onRespond: (id: string, action: 'accept' | 'decline') => void;
}>) {
  const isIncoming = request.type === 'incoming';

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage alt={request.person.name} src={request.person.avatar} />
            <AvatarFallback>
              {request.person.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{request.person.name}</p>
                  <Badge
                    className={
                      isIncoming ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }
                    variant="secondary"
                  >
                    {isIncoming ? 'Incoming' : 'Sent'}
                  </Badge>
                  {request.status === 'pending' && (
                    <Badge className="bg-amber-100 text-amber-700" variant="secondary">
                      <Clock className="mr-1 h-3 w-3" />
                      Pending
                    </Badge>
                  )}
                </div>
                {request.person.title && (
                  <p className="text-muted-foreground text-sm">{request.person.title}</p>
                )}
              </div>

              <p className="text-muted-foreground text-xs">{formatTimeAgo(request.createdAt)}</p>
            </div>

            <div className="mt-2">
              <p className="text-sm">
                {isIncoming ? 'Wants your endorsement for' : 'Requested endorsement for'}:{' '}
                <span className="font-medium">{request.skill.name}</span>
              </p>
            </div>

            {request.message && (
              <p className="text-muted-foreground mt-2 text-sm">&quot;{request.message}&quot;</p>
            )}

            {request.projectContext && (
              <p className="text-muted-foreground mt-1 text-xs">
                Related to: {request.projectContext.title}
              </p>
            )}

            {isIncoming && request.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => onRespond(request.id, 'accept')}>
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  Endorse
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRespond(request.id, 'decline')}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Decline
                </Button>
              </div>
            )}

            {!isIncoming && request.status === 'pending' && request.expiresAt && (
              <p className="text-muted-foreground mt-2 text-xs">
                Expires in{' '}
                {Math.ceil(
                  (new Date(request.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )}{' '}
                days
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Request Endorsement Modal
// ============================================================================

function RequestEndorsementModal({
  open,
  onOpenChange,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [message, setMessage] = useState('');

  const connections = [
    { id: 'c1', name: 'Sarah Chen', title: 'Engineering Manager at TechCorp' },
    { id: 'c2', name: 'Michael Park', title: 'Senior Developer at StartupXYZ' },
    { id: 'c3', name: 'David Kim', title: 'CTO at DevAgency' },
  ];

  const skills = [
    { id: 's1', name: 'React' },
    { id: 's2', name: 'TypeScript' },
    { id: 's3', name: 'Node.js' },
    { id: 's4', name: 'GraphQL' },
    { id: 's5', name: 'PostgreSQL' },
  ];

  const handleSubmit = () => {
    // Feature: Call API to send endorsement request - not yet implemented
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Endorsement</DialogTitle>
          <DialogDescription>
            Ask a past client or colleague to endorse your skills.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="skill-select">
              Skill to Endorse
            </label>
            <Select value={selectedSkill} onValueChange={setSelectedSkill}>
              <SelectTrigger id="skill-select">
                <SelectValue placeholder="Select a skill" />
              </SelectTrigger>
              <SelectContent>
                {skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="connection-select">
              From
            </label>
            <Select value={selectedConnection} onValueChange={setSelectedConnection}>
              <SelectTrigger id="connection-select">
                <SelectValue placeholder="Select a connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    <div>
                      <p>{connection.name}</p>
                      <p className="text-muted-foreground text-xs">{connection.title}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="endorsement-message">
              Message <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              id="endorsement-message"
              placeholder="Add context about the project or work you did together..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selectedSkill || !selectedConnection} onClick={handleSubmit}>
            <Send className="mr-2 h-4 w-4" />
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Settings Panel
// ============================================================================

function SettingsPanel({ settings }: Readonly<{ settings: EndorsementSettings }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Endorsement Settings
        </CardTitle>
        <CardDescription>Control how endorsements work on your profile</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Allow Public Endorsements</p>
            <p className="text-muted-foreground text-sm">
              Let anyone endorse your skills without prior connection
            </p>
          </div>
          <input
            className="h-5 w-5"
            defaultChecked={settings.allowPublicEndorsements}
            type="checkbox"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Require Approval</p>
            <p className="text-muted-foreground text-sm">
              Review endorsements before they appear on your profile
            </p>
          </div>
          <input className="h-5 w-5" defaultChecked={settings.requireApproval} type="checkbox" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Show on Profile</p>
            <p className="text-muted-foreground text-sm">
              Display endorsements on your public profile
            </p>
          </div>
          <input className="h-5 w-5" defaultChecked={settings.showOnProfile} type="checkbox" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Email Notifications</p>
            <p className="text-muted-foreground text-sm">
              Receive emails when you get new endorsements
            </p>
          </div>
          <input className="h-5 w-5" defaultChecked={settings.emailNotifications} type="checkbox" />
        </div>

        <div className="space-y-2">
          <label className="font-medium" htmlFor="visibility-select">
            Visibility
          </label>
          <Select defaultValue={settings.endorsementVisibility}>
            <SelectTrigger id="visibility-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public - Visible to everyone</SelectItem>
              <SelectItem value="connections">Connections Only</SelectItem>
              <SelectItem value="private">Private - Only visible to you</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function EndorsementsPage() {
  const [activeTab, setActiveTab] = useState('received');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [endorsements, setEndorsements] = useState(mockEndorsements);
  const [requests, setRequests] = useState(mockRequests);
  const [filterSkill, setFilterSkill] = useState<string>('all');

  const handleToggleFeatured = (id: string) => {
    setEndorsements((prev) => prev.map((e) => (e.id === id ? { ...e, featured: !e.featured } : e)));
  };

  const handleRespondToRequest = (id: string, action: 'accept' | 'decline') => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: getStatusFromAction(action) } : r))
    );
  };

  const pendingIncoming = requests.filter((r) => r.type === 'incoming' && r.status === 'pending');
  const pendingOutgoing = requests.filter((r) => r.type === 'outgoing' && r.status === 'pending');

  const filteredEndorsements =
    filterSkill === 'all' ? endorsements : endorsements.filter((e) => e.skill.id === filterSkill);

  const uniqueSkills = Array.from(new Map(endorsements.map((e) => [e.skill.id, e.skill])).values());

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Endorsements</h1>
            <p className="text-muted-foreground mt-1">
              Manage endorsements from clients and colleagues
            </p>
          </div>
          <Button onClick={() => setShowRequestModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request Endorsement
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <EndorsementStats />
        </div>

        {/* Alert for pending requests */}
        {pendingIncoming.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-amber-100 p-2">
                <Inbox className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  You have {pendingIncoming.length} pending endorsement{' '}
                  {pendingIncoming.length === 1 ? 'request' : 'requests'}
                </p>
                <p className="text-muted-foreground text-sm">
                  Help your connections by endorsing their skills
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('requests')}>
                View Requests
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs className="space-y-6" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger className="gap-2" value="received">
              <ThumbsUp className="h-4 w-4" />
              Received
            </TabsTrigger>
            <TabsTrigger className="gap-2" value="given">
              <Heart className="h-4 w-4" />
              Given
            </TabsTrigger>
            <TabsTrigger className="gap-2" value="requests">
              <MessageSquare className="h-4 w-4" />
              Requests
              {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
                <Badge className="ml-1 bg-red-100 text-red-700" variant="secondary">
                  {pendingIncoming.length + pendingOutgoing.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger className="gap-2" value="settings">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Received Tab */}
          <TabsContent className="space-y-6" value="received">
            {/* Skill Summary Cards */}
            <div>
              <h2 className="mb-4 font-semibold">Endorsements by Skill</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mockSkillSummaries.map((summary) => (
                  <SkillEndorsementCard key={summary.skillId} summary={summary} />
                ))}
              </div>
            </div>

            {/* All Endorsements */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">All Endorsements</h2>
                <Select value={filterSkill} onValueChange={setFilterSkill}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filter by skill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Skills</SelectItem>
                    {uniqueSkills.map((skill) => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {filteredEndorsements.map((endorsement) => (
                  <EndorsementCard
                    key={endorsement.id}
                    endorsement={endorsement}
                    onToggleFeatured={handleToggleFeatured}
                  />
                ))}

                {filteredEndorsements.length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center py-12">
                      <ThumbsUp className="text-muted-foreground mb-4 h-12 w-12" />
                      <p className="text-muted-foreground text-center">
                        No endorsements found for this filter.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Given Tab */}
          <TabsContent className="space-y-4" value="given">
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Heart className="text-muted-foreground mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">Endorsements You&apos;ve Given</h3>
                <p className="text-muted-foreground mb-4 text-center">
                  View and manage endorsements you&apos;ve given to others.
                </p>
                <Button variant="outline">
                  <Search className="mr-2 h-4 w-4" />
                  Find Connections to Endorse
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent className="space-y-6" value="requests">
            {/* Incoming Requests */}
            <div>
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Inbox className="h-5 w-5" />
                Incoming Requests
              </h2>
              {pendingIncoming.length > 0 ? (
                <div className="space-y-4">
                  {pendingIncoming.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onRespond={handleRespondToRequest}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No pending incoming requests</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Outgoing Requests */}
            <div>
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Send className="h-5 w-5" />
                Sent Requests
              </h2>
              {pendingOutgoing.length > 0 ? (
                <div className="space-y-4">
                  {pendingOutgoing.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onRespond={handleRespondToRequest}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No pending sent requests</p>
                    <Button
                      className="mt-2"
                      variant="link"
                      onClick={() => setShowRequestModal(true)}
                    >
                      Request an endorsement
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsPanel settings={mockSettings} />
          </TabsContent>
        </Tabs>

        {/* Request Modal */}
        <RequestEndorsementModal open={showRequestModal} onOpenChange={setShowRequestModal} />
      </div>
    </main>
  );
}
