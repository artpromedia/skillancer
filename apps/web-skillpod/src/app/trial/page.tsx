'use client';

/**
 * Trial Dashboard Page
 * Shows trial status, progress, and conversion prompts
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Clock,
  Users,
  Zap,
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  CreditCard,
  MessageSquare,
  TrendingUp,
  Star,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Badge } from '@skillancer/ui/badge';
import { Progress } from '@skillancer/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/dialog';
import { Textarea } from '@skillancer/ui/textarea';
import { useToast } from '@skillancer/ui/use-toast';

// =============================================================================
// TYPES
// =============================================================================

interface TrialInfo {
  id: string;
  status: 'ACTIVE' | 'EXTENDED' | 'CONVERTED' | 'EXPIRED';
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
  usageScore: number;
  conversionLikelihood: 'low' | 'medium' | 'high';
  extensions: number;
  targetPlan: string;
}

interface TrialMetrics {
  totalSessions: number;
  uniqueUsers: number;
  avgSessionDuration: number;
  featuresUsed: string[];
  policiesCreated: number;
  ssoConfigured: boolean;
  usersInvited: number;
  daysActive: number;
}

interface TrialEngagement {
  score: number;
  signals: {
    positive: string[];
    negative: string[];
  };
  recommendations: string[];
}

interface SetupTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  icon: React.ReactNode;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchTrialInfo(): Promise<TrialInfo> {
  const response = await fetch('/api/trial/info');
  if (!response.ok) throw new Error('Failed to fetch trial info');
  return response.json();
}

async function fetchTrialMetrics(): Promise<TrialMetrics> {
  const response = await fetch('/api/trial/metrics');
  if (!response.ok) throw new Error('Failed to fetch metrics');
  return response.json();
}

async function fetchTrialEngagement(): Promise<TrialEngagement> {
  const response = await fetch('/api/trial/engagement');
  if (!response.ok) throw new Error('Failed to fetch engagement');
  return response.json();
}

async function requestExtension(reason: string): Promise<void> {
  const response = await fetch('/api/trial/extend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to request extension');
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

function TrialCountdown({
  daysRemaining,
  expiresAt,
}: {
  daysRemaining: number;
  expiresAt: string;
}) {
  const urgency = daysRemaining <= 3 ? 'urgent' : daysRemaining <= 7 ? 'warning' : 'normal';

  const colors = {
    urgent: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    normal: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className={`rounded-lg border p-6 ${colors[urgency]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8" />
          <div>
            <p className="text-sm font-medium opacity-75">Trial Expires</p>
            <p className="text-2xl font-bold">
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-75">Ends on</p>
          <p className="font-medium">{new Date(expiresAt).toLocaleDateString()}</p>
        </div>
      </div>

      {urgency === 'urgent' && (
        <div className="mt-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Upgrade now to keep your data and configuration
          </span>
        </div>
      )}
    </div>
  );
}

function EngagementScore({
  score,
  signals,
}: {
  score: number;
  signals: TrialEngagement['signals'];
}) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-green-600';
    if (s >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 70) return 'Excellent';
    if (s >= 40) return 'Good';
    return 'Getting Started';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trial Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex items-center gap-6">
          <div className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</div>
          <div>
            <p className={`font-medium ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
            <p className="text-muted-foreground text-sm">Engagement Score</p>
          </div>
        </div>

        <Progress value={score} className="mb-6" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-green-600">What's Working</p>
            <ul className="space-y-1">
              {signals.positive.map((signal, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {signal}
                </li>
              ))}
              {signals.positive.length === 0 && (
                <li className="text-muted-foreground text-sm">Keep exploring!</li>
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-orange-600">Room to Grow</p>
            <ul className="space-y-1">
              {signals.negative.map((signal, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  {signal}
                </li>
              ))}
              {signals.negative.length === 0 && (
                <li className="text-muted-foreground text-sm">Looking good!</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SetupChecklist({ metrics }: { metrics: TrialMetrics }) {
  const tasks: SetupTask[] = [
    {
      id: 'session',
      title: 'Run your first session',
      description: 'Experience the secure desktop environment',
      completed: metrics.totalSessions > 0,
      href: '/sessions/new',
      icon: <Zap className="h-5 w-5" />,
    },
    {
      id: 'users',
      title: 'Invite team members',
      description: 'Add colleagues to test collaboration',
      completed: metrics.usersInvited >= 2,
      href: '/admin/tenant/users',
      icon: <Users className="h-5 w-5" />,
    },
    {
      id: 'policy',
      title: 'Create a security policy',
      description: 'Define access controls and restrictions',
      completed: metrics.policiesCreated > 0,
      href: '/admin/tenant/policies',
      icon: <Shield className="h-5 w-5" />,
    },
    {
      id: 'sso',
      title: 'Configure SSO',
      description: 'Connect your identity provider',
      completed: metrics.ssoConfigured,
      href: '/admin/tenant/sso',
      icon: <Sparkles className="h-5 w-5" />,
    },
  ];

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Setup Checklist</CardTitle>
          <Badge variant="outline">
            {completedCount}/{tasks.length} complete
          </Badge>
        </div>
        <CardDescription>Complete these tasks to get the most out of your trial</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={task.href}
              className={`flex items-center gap-4 rounded-lg border p-3 transition-colors ${
                task.completed ? 'border-green-200 bg-green-50' : 'hover:bg-muted/50 bg-white'
              }`}
            >
              <div
                className={`rounded-full p-2 ${
                  task.completed ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                }`}
              >
                {task.completed ? <CheckCircle2 className="h-5 w-5" /> : task.icon}
              </div>
              <div className="flex-1">
                <p
                  className={`font-medium ${task.completed ? 'text-muted-foreground line-through' : ''}`}
                >
                  {task.title}
                </p>
                <p className="text-muted-foreground text-sm">{task.description}</p>
              </div>
              {!task.completed && <ArrowRight className="text-muted-foreground h-4 w-4" />}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Recommendations({ recommendations }: { recommendations: string[] }) {
  if (recommendations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Recommended Next Steps
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2">
              <ArrowRight className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{rec}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function UpgradePrompt({ trial, metrics }: { trial: TrialInfo; metrics: TrialMetrics }) {
  return (
    <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="mb-2 text-xl font-bold">Ready to upgrade?</h3>
            <p className="mb-4 text-blue-100">
              Keep all your configuration, users, and data by upgrading to a paid plan.
            </p>
            <div className="mb-4 flex items-center gap-2 text-sm text-blue-100">
              <CheckCircle2 className="h-4 w-4" />
              <span>{metrics.usersInvited} users configured</span>
              <span className="mx-2">•</span>
              <CheckCircle2 className="h-4 w-4" />
              <span>{metrics.policiesCreated} policies created</span>
              {metrics.ssoConfigured && (
                <>
                  <span className="mx-2">•</span>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>SSO configured</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button asChild className="bg-white text-blue-600 hover:bg-blue-50">
            <Link href="/admin/tenant/billing">
              <CreditCard className="mr-2 h-4 w-4" />
              View Plans & Upgrade
            </Link>
          </Button>
          <Button variant="outline" asChild className="border-white text-white hover:bg-white/10">
            <Link href="/contact-sales">
              <MessageSquare className="mr-2 h-4 w-4" />
              Talk to Sales
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExtensionDialog({
  open,
  onOpenChange,
  currentExtensions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentExtensions: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => requestExtension(reason),
    onSuccess: () => {
      toast({ title: 'Extension Requested', description: 'Your trial has been extended!' });
      queryClient.invalidateQueries({ queryKey: ['trial-info'] });
      onOpenChange(false);
      setReason('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const remainingExtensions = 2 - currentExtensions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Trial Extension</DialogTitle>
          <DialogDescription>
            {remainingExtensions > 0
              ? `You can request up to ${remainingExtensions} more extension${remainingExtensions > 1 ? 's' : ''}.`
              : 'You have used all available extensions.'}
          </DialogDescription>
        </DialogHeader>

        {remainingExtensions > 0 ? (
          <>
            <div className="space-y-2 py-4">
              <label className="text-sm font-medium">Why do you need more time?</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Still evaluating with the security team..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !reason.trim()}
              >
                {mutation.isPending ? 'Requesting...' : 'Request 7-Day Extension'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button asChild>
              <Link href="/contact-sales">Contact Sales for Custom Extension</Link>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TrialDashboardPage() {
  const [extensionOpen, setExtensionOpen] = useState(false);

  const { data: trial, isLoading: trialLoading } = useQuery({
    queryKey: ['trial-info'],
    queryFn: fetchTrialInfo,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['trial-metrics'],
    queryFn: fetchTrialMetrics,
  });

  const { data: engagement, isLoading: engagementLoading } = useQuery({
    queryKey: ['trial-engagement'],
    queryFn: fetchTrialEngagement,
  });

  const isLoading = trialLoading || metricsLoading || engagementLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
        </div>
      </div>
    );
  }

  if (!trial || !metrics || !engagement) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-lg font-medium">No active trial found</p>
            <p className="text-muted-foreground mb-4">
              You may already have a subscription or your trial has ended.
            </p>
            <Button asChild>
              <Link href="/admin/tenant/billing">View Billing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Your Trial</h1>
        <p className="text-muted-foreground">
          Track your progress and get the most out of your SkillPod trial
        </p>
      </div>

      <div className="space-y-6">
        {/* Trial Countdown */}
        <TrialCountdown daysRemaining={trial.daysRemaining} expiresAt={trial.expiresAt} />

        {/* Upgrade Prompt (show when engagement is good or time is running low) */}
        {(engagement.score >= 50 || trial.daysRemaining <= 5) && (
          <UpgradePrompt trial={trial} metrics={metrics} />
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Engagement Score */}
          <EngagementScore score={engagement.score} signals={engagement.signals} />

          {/* Setup Checklist */}
          <SetupChecklist metrics={metrics} />
        </div>

        {/* Recommendations */}
        <Recommendations recommendations={engagement.recommendations} />

        {/* Usage Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Trial Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-primary text-3xl font-bold">{metrics.totalSessions}</p>
                <p className="text-muted-foreground text-sm">Total Sessions</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-primary text-3xl font-bold">{metrics.uniqueUsers}</p>
                <p className="text-muted-foreground text-sm">Active Users</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-primary text-3xl font-bold">{metrics.avgSessionDuration}m</p>
                <p className="text-muted-foreground text-sm">Avg Session</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-primary text-3xl font-bold">{metrics.daysActive}</p>
                <p className="text-muted-foreground text-sm">Days Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Extension Request */}
        {trial.daysRemaining <= 7 && trial.extensions < 2 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Need more time?</p>
                  <p className="text-muted-foreground text-sm">
                    Request a trial extension if you need more time to evaluate
                  </p>
                </div>
                <Button variant="outline" onClick={() => setExtensionOpen(true)}>
                  Request Extension
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ExtensionDialog
        open={extensionOpen}
        onOpenChange={setExtensionOpen}
        currentExtensions={trial.extensions}
      />
    </div>
  );
}
