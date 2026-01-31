/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises */
'use client';

/**
 * Violation Investigation Page
 *
 * Comprehensive investigation interface with evidence panel,
 * timeline, user profile, and resolution workflow.
 *
 * @module app/violations/[violationId]/investigate/page
 */

import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Clock,
  User,
  MessageSquare,
  Link2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Download,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { EvidenceViewer } from '@/components/violations/evidence-viewer';
import { UserViolationHistory } from '@/components/violations/user-violation-history';
import { ViolationWorkflow } from '@/components/violations/violation-workflow';

// ============================================================================
// Types
// ============================================================================

interface Violation {
  id: string;
  type: string;
  subtype?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'investigating' | 'pending_action' | 'resolved' | 'dismissed';
  timestamp: Date;
  sessionId: string;
  recordingId: string;
  recordingTimestamp: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  userEmail: string;
  podId: string;
  podName: string;
  contractId?: string;
  contractName?: string;
  description: string;
  details: Record<string, unknown>;
  evidence: Evidence[];
  relatedViolations: string[];
  assignedTo?: string;
  notes: ViolationNote[];
  resolution?: ViolationResolution;
  createdAt: Date;
  updatedAt: Date;
}

interface Evidence {
  id: string;
  type: 'recording_clip' | 'screenshot' | 'log' | 'system_state';
  title: string;
  description: string;
  url?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  capturedAt: number; // Seconds from session start
}

interface ViolationNote {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  attachments?: string[];
}

interface ViolationResolution {
  action: 'dismissed' | 'warned' | 'acknowledged' | 'suspended' | 'banned' | 'escalated';
  reason: string;
  resolvedBy: string;
  resolvedAt: Date;
}

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: Date;
  relativeToViolation: number; // Seconds relative to violation timestamp
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  joinedAt: Date;
  trustScore: number;
  trustScoreTrend: 'up' | 'down' | 'stable';
  totalViolations: number;
  violationsByType: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  lastViolationAt?: Date;
  previousActions: PreviousAction[];
}

interface PreviousAction {
  id: string;
  violationId: string;
  action: string;
  date: Date;
  resolvedBy: string;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG = {
  critical: {
    color: 'red',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500',
  },
  high: {
    color: 'orange',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500',
  },
  medium: {
    color: 'yellow',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-500',
  },
  low: {
    color: 'blue',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500',
  },
};

const STATUS_CONFIG = {
  new: { label: 'New', bg: 'bg-red-100', text: 'text-red-700' },
  investigating: { label: 'Investigating', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  pending_action: { label: 'Pending Action', bg: 'bg-orange-100', text: 'text-orange-700' },
  resolved: { label: 'Resolved', bg: 'bg-green-100', text: 'text-green-700' },
  dismissed: { label: 'Dismissed', bg: 'bg-gray-100', text: 'text-gray-700' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRelativeTime(seconds: number): string {
  const abs = Math.abs(seconds);
  const sign = seconds < 0 ? '-' : '+';

  if (abs < 60) return `${sign}${abs}s`;
  if (abs < 3600) return `${sign}${Math.floor(abs / 60)}m ${abs % 60}s`;
  return `${sign}${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function ViolationHeader({
  violation,
  onBack,
}: Readonly<{ violation: Violation; onBack: () => void }>) {
  const severityConfig = SEVERITY_CONFIG[violation.severity];
  const statusConfig = STATUS_CONFIG[violation.status];

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <button
          className="mb-4 flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Violations
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`rounded-lg p-3 ${severityConfig.bg}`}>
              <AlertTriangle className={`h-6 w-6 ${severityConfig.text}`} />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {violation.type.replaceAll('_', ' ')}
                </h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityConfig.bg} ${severityConfig.text}`}
                >
                  {violation.severity}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                >
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">{violation.description}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDate(violation.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {violation.userName}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {violation.podName}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityTimeline({
  events,
  violationTimestamp,
  onEventClick,
}: Readonly<{
  events: TimelineEvent[];
  violationTimestamp: number;
  onEventClick: (event: TimelineEvent) => void;
}>) {
  const [expanded, setExpanded] = useState(true);

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.relativeToViolation - b.relativeToViolation);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-900 dark:text-white">Activity Timeline</span>
          <span className="text-sm text-gray-500">({events.length} events)</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            {/* Events */}
            <div className="space-y-4">
              {sortedEvents.map((event) => {
                const isViolation = event.relativeToViolation === 0;
                const severityConfig = event.severity ? SEVERITY_CONFIG[event.severity] : null;

                return (
                  <button
                    key={event.id}
                    type="button"
                    className="relative w-full cursor-pointer pl-10 text-left"
                    onClick={() => onEventClick(event)}
                  >
                    {/* Dot */}
                    <div
                      className={`absolute left-2 h-4 w-4 rounded-full border-2 ${(() => {
                        if (isViolation) return 'border-red-500 bg-red-500';
                        if (severityConfig) return `${severityConfig.bg} ${severityConfig.border}`;
                        return 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800';
                      })()}`}
                    />

                    <div
                      className={`cursor-pointer rounded-lg p-3 transition-colors ${
                        isViolation
                          ? 'border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                          : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`text-sm font-medium ${
                            isViolation
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {event.title}
                        </span>
                        <span className="font-mono text-xs text-gray-500">
                          {formatRelativeTime(event.relativeToViolation)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {event.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotesSection({
  notes,
  onAddNote,
}: Readonly<{
  notes: ViolationNote[];
  onAddNote: (content: string) => void;
}>) {
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!newNote.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      onAddNote(newNote.trim());
      setNewNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-gray-500" />
        <span className="font-medium text-gray-900 dark:text-white">Investigation Notes</span>
      </div>

      {/* Add Note */}
      <div className="mb-4">
        <textarea
          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Add a note about this investigation..."
          rows={3}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!newNote.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          No notes yet. Add the first note to document your investigation.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
              <div className="mb-2 flex items-center gap-2">
                {note.authorAvatar ? (
                  <img
                    alt={note.authorName}
                    className="h-6 w-6 rounded-full"
                    src={note.authorAvatar}
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {note.authorName}
                </span>
                <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RelatedViolationsPanel({
  violationIds,
  onViewViolation,
  onLinkViolation,
}: Readonly<{
  violationIds: string[];
  onViewViolation: (id: string) => void;
  onLinkViolation: () => void;
}>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-900 dark:text-white">Related Violations</span>
        </div>
        <button
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={onLinkViolation}
        >
          Link violation
        </button>
      </div>

      {violationIds.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No related violations linked</p>
      ) : (
        <div className="space-y-2">
          {violationIds.map((id) => (
            <button
              key={id}
              className="flex w-full items-center justify-between rounded p-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => onViewViolation(id)}
            >
              <span className="text-gray-900 dark:text-white">{id}</span>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ViolationInvestigatePage() {
  const params = useParams();
  const router = useRouter();
  const violationId = params.violationId as string;

  // State
  const [violation, setViolation] = useState<Violation | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'evidence' | 'history' | 'resolution'>('evidence');

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Mock violation
        setViolation({
          id: violationId,
          type: 'screenshot_attempt',
          subtype: 'print_screen',
          severity: 'high',
          status: 'investigating',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          sessionId: 'session-123',
          recordingId: 'rec-123',
          recordingTimestamp: 1845,
          userId: 'user-1',
          userName: 'Alice Johnson',
          userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
          userEmail: 'alice@example.com',
          podId: 'pod-1',
          podName: 'Development Environment',
          contractId: 'contract-1',
          contractName: 'Project Alpha',
          description:
            'User attempted to capture screen content using Print Screen key while viewing confidential data.',
          details: {
            keyPressed: 'PrintScreen',
            activeWindow: 'Confidential_Report_Q4.pdf',
            blocked: true,
            watermarkApplied: true,
          },
          evidence: [
            {
              id: 'ev-1',
              type: 'screenshot',
              title: 'Captured Frame',
              description: 'Screenshot captured at time of violation',
              url: 'https://picsum.photos/seed/ev1/800/600',
              timestamp: new Date(),
              capturedAt: 1845,
            },
            {
              id: 'ev-2',
              type: 'recording_clip',
              title: 'Recording Clip',
              description: '30 seconds before and after the violation',
              url: '/recordings/rec-123/clip?start=1815&end=1875',
              timestamp: new Date(),
              capturedAt: 1815,
            },
            {
              id: 'ev-3',
              type: 'log',
              title: 'System Logs',
              description: 'Relevant log entries around the violation time',
              data: {
                entries: [
                  {
                    time: '14:32:15',
                    level: 'INFO',
                    message: 'User opened Confidential_Report_Q4.pdf',
                  },
                  { time: '14:32:45', level: 'WARN', message: 'Print Screen key detected' },
                  { time: '14:32:45', level: 'INFO', message: 'Screenshot blocked by DLP policy' },
                  {
                    time: '14:32:45',
                    level: 'ALERT',
                    message: 'Violation created: screenshot_attempt',
                  },
                ],
              },
              timestamp: new Date(),
              capturedAt: 1845,
            },
          ],
          relatedViolations: [],
          notes: [
            {
              id: 'note-1',
              authorId: 'admin-1',
              authorName: 'Security Team',
              content:
                'Initial review: Appears to be intentional. User was viewing sensitive financial data at the time.',
              createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
            },
          ],
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        });

        // Mock user profile
        setUserProfile({
          id: 'user-1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
          role: 'Freelancer',
          joinedAt: new Date('2023-06-15'),
          trustScore: 78,
          trustScoreTrend: 'down',
          totalViolations: 3,
          violationsByType: {
            screenshot_attempt: 2,
            clipboard_violation: 1,
          },
          violationsBySeverity: {
            high: 2,
            medium: 1,
          },
          lastViolationAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          previousActions: [
            {
              id: 'pa-1',
              violationId: 'viol-old-1',
              action: 'warned',
              date: new Date('2024-01-15'),
              resolvedBy: 'admin@company.com',
            },
          ],
        });

        // Mock timeline
        setTimelineEvents([
          {
            id: 'te-1',
            type: 'file_open',
            title: 'Opened confidential file',
            description: 'User opened Confidential_Report_Q4.pdf',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 - 30000),
            relativeToViolation: -30,
            severity: 'info',
          },
          {
            id: 'te-2',
            type: 'violation',
            title: 'Screenshot attempt detected',
            description: 'Print Screen key was pressed',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            relativeToViolation: 0,
            severity: 'high',
          },
          {
            id: 'te-3',
            type: 'system_action',
            title: 'Screenshot blocked',
            description: 'DLP policy prevented screen capture',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 100),
            relativeToViolation: 0.1,
            severity: 'info',
          },
          {
            id: 'te-4',
            type: 'user_activity',
            title: 'User continued working',
            description: 'No further violation attempts',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60000),
            relativeToViolation: 60,
            severity: 'info',
          },
        ]);
      } catch (err) {
        console.error('Failed to load violation:', err);
        setError('Failed to load violation details');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [violationId]);

  // Handlers
  const handleBack = () => {
    router.push('/violations');
  };

  const handleAddNote = (content: string) => {
    if (!violation) return;
    const newNote: ViolationNote = {
      id: `note-${Date.now()}`,
      authorId: 'current-user',
      authorName: 'You',
      content,
      createdAt: new Date(),
    };
    setViolation({
      ...violation,
      notes: [...violation.notes, newNote],
    });
  };

  const handleViewRecording = () => {
    if (!violation) return;
    router.push(`/recordings/${violation.recordingId}?t=${violation.recordingTimestamp}`);
  };

  const handleEventClick = (_event: TimelineEvent) => {
    // Feature: Handle event click for detailed view - not yet implemented
  };

  const handleViewViolation = (id: string) => {
    router.push(`/violations/${id}/investigate`);
  };

  const handleLinkViolation = () => {
    // Feature: Link violation to related violations - not yet implemented
  };

  const handleResolution = async (action: string, reason: string): Promise<void> => {
    if (!violation) return;
    setViolation({
      ...violation,
      status: action === 'dismissed' ? 'dismissed' : 'resolved',
      resolution: {
        action: action as ViolationResolution['action'],
        reason,
        resolvedBy: 'current-user',
        resolvedAt: new Date(),
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !violation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            {error || 'Violation not found'}
          </h2>
          <button className="mt-4 text-blue-600 hover:underline" onClick={handleBack}>
            Back to Violations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <ViolationHeader violation={violation} onBack={handleBack} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Tabs */}
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {(['evidence', 'history', 'resolution'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'evidence' && 'Evidence'}
                    {tab === 'history' && 'User History'}
                    {tab === 'resolution' && 'Resolution'}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === 'evidence' && (
                  <EvidenceViewer
                    evidence={violation.evidence}
                    recordingTimestamp={violation.recordingTimestamp}
                    onViewRecording={handleViewRecording}
                  />
                )}
                {activeTab === 'history' && userProfile && (
                  <UserViolationHistory currentViolationId={violation.id} user={userProfile} />
                )}
                {activeTab === 'resolution' && (
                  <ViolationWorkflow violation={violation} onResolve={handleResolution} />
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <ActivityTimeline
              events={timelineEvents}
              violationTimestamp={violation.recordingTimestamp}
              onEventClick={handleEventClick}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:col-span-1">
            {/* User Profile Card */}
            {userProfile && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center gap-3">
                  {userProfile.avatar ? (
                    <img
                      alt={userProfile.name}
                      className="h-12 w-12 rounded-full"
                      src={userProfile.avatar}
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                      <User className="h-6 w-6 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {userProfile.name}
                    </h3>
                    <p className="text-sm text-gray-500">{userProfile.email}</p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {userProfile.trustScore}
                      </span>
                      {userProfile.trustScoreTrend === 'up' && (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      )}
                      {userProfile.trustScoreTrend === 'down' && (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      {userProfile.trustScoreTrend === 'stable' && (
                        <Minus className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Trust Score</span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {userProfile.totalViolations}
                    </span>
                    <span className="block text-xs text-gray-500">Total Violations</span>
                  </div>
                </div>

                <button
                  className="w-full rounded-lg py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={() => setActiveTab('history')}
                >
                  View Full History
                </button>
              </div>
            )}

            {/* Notes */}
            <NotesSection notes={violation.notes} onAddNote={handleAddNote} />

            {/* Related Violations */}
            <RelatedViolationsPanel
              violationIds={violation.relatedViolations}
              onLinkViolation={handleLinkViolation}
              onViewViolation={handleViewViolation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
