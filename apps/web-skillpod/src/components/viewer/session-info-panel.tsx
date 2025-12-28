/* eslint-disable @typescript-eslint/no-unused-vars, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Session Info Panel Component
 *
 * Session information panel:
 * - Session details (ID, pod, duration)
 * - Security policy summary
 * - Resource usage
 * - Activity log
 * - End session button
 */

import { Badge, Button, cn, Progress, Separator } from '@skillancer/ui';
import {
  Activity,
  AlertCircle,
  Clock,
  Cpu,
  FileText,
  HardDrive,
  Info,
  LogOut,
  MemoryStick,
  Monitor,
  Shield,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface SessionDetails {
  id: string;
  podId: string;
  podName: string;
  startTime: Date;
  contractId?: string;
  projectName?: string;
  userId: string;
  userEmail: string;
}

export interface SecurityPolicy {
  clipboardEnabled: boolean;
  fileTransferEnabled: boolean;
  watermarkEnabled: boolean;
  screenshotBlocked: boolean;
  recordingEnabled: boolean;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: {
    used: number;
    total: number;
  };
}

export interface ActivityEvent {
  id: string;
  type: 'connection' | 'file' | 'clipboard' | 'violation' | 'system';
  message: string;
  timestamp: Date;
}

interface SessionInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetails;
  policy: SecurityPolicy;
  resources: ResourceUsage;
  activities: ActivityEvent[];
  onEndSession: () => void;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(startTime: Date): string {
  const now = new Date();
  const diff = now.getTime() - startTime.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// SECTION COMPONENTS
// ============================================================================

interface SessionDetailsSectionProps {
  session: SessionDetails;
  duration: string;
}

function SessionDetailsSection({ session, duration }: Readonly<SessionDetailsSectionProps>) {
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Info className="h-4 w-4" />
        Session Details
      </h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Session ID</span>
          <p className="truncate font-mono text-xs">{session.id.slice(0, 12)}...</p>
        </div>
        <div>
          <span className="text-muted-foreground">Pod</span>
          <p className="truncate">{session.podName}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Started</span>
          <p>{session.startTime.toLocaleTimeString()}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Duration</span>
          <p className="text-primary font-medium">{duration}</p>
        </div>
        {session.projectName && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Project</span>
            <p>{session.projectName}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SecurityPolicySectionProps {
  policy: SecurityPolicy;
}

function SecurityPolicySection({ policy }: Readonly<SecurityPolicySectionProps>) {
  const items = [
    { label: 'Clipboard', enabled: policy.clipboardEnabled },
    { label: 'File Transfer', enabled: policy.fileTransferEnabled },
    { label: 'Watermark', enabled: policy.watermarkEnabled },
    { label: 'Screenshot Block', enabled: policy.screenshotBlocked },
    { label: 'Recording', enabled: policy.recordingEnabled },
  ];

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Shield className="h-4 w-4" />
        Security Policy
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item.label}
            className="text-xs"
            variant={item.enabled ? 'default' : 'secondary'}
          >
            {item.enabled ? '✓' : '✗'} {item.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

interface ResourceUsageSectionProps {
  resources: ResourceUsage;
}

function ResourceUsageSection({ resources }: Readonly<ResourceUsageSectionProps>) {
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4" />
        Resource Usage
      </h4>
      <div className="space-y-3">
        {/* CPU */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              CPU
            </span>
            <span
              className={cn(
                'font-medium',
                resources.cpu > 80 && 'text-destructive',
                resources.cpu > 60 && resources.cpu <= 80 && 'text-yellow-500'
              )}
            >
              {resources.cpu}%
            </span>
          </div>
          <Progress className="h-1.5" value={resources.cpu} />
        </div>

        {/* Memory */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <MemoryStick className="h-3 w-3" />
              Memory
            </span>
            <span
              className={cn(
                'font-medium',
                resources.memory > 80 && 'text-destructive',
                resources.memory > 60 && resources.memory <= 80 && 'text-yellow-500'
              )}
            >
              {resources.memory}%
            </span>
          </div>
          <Progress className="h-1.5" value={resources.memory} />
        </div>

        {/* Storage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              Storage
            </span>
            <span className="font-medium">
              {formatBytes(resources.storage.used)} / {formatBytes(resources.storage.total)}
            </span>
          </div>
          <Progress
            className="h-1.5"
            value={(resources.storage.used / resources.storage.total) * 100}
          />
        </div>
      </div>
    </div>
  );
}

interface ActivityLogSectionProps {
  activities: ActivityEvent[];
}

function ActivityLogSection({ activities }: Readonly<ActivityLogSectionProps>) {
  const getIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'connection':
        return Monitor;
      case 'file':
        return FileText;
      case 'clipboard':
        return FileText;
      case 'violation':
        return AlertCircle;
      case 'system':
        return Info;
    }
  };

  const getColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'violation':
        return 'text-destructive';
      case 'system':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="h-4 w-4" />
        Recent Activity
      </h4>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">No recent activity</p>
        ) : (
          activities.slice(0, 10).map((activity) => {
            const Icon = getIcon(activity.type);
            return (
              <div key={activity.id} className="flex items-start gap-2 text-xs">
                <Icon className={cn('mt-0.5 h-3 w-3 flex-shrink-0', getColor(activity.type))} />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate">{activity.message}</p>
                  <p className="text-muted-foreground">{formatTime(activity.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SessionInfoPanel({
  isOpen,
  onClose,
  session,
  policy,
  resources,
  activities,
  onEndSession,
  className,
}: Readonly<SessionInfoPanelProps>) {
  const [duration, setDuration] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const updateDuration = () => {
      setDuration(formatDuration(session.startTime));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [isOpen, session.startTime]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-80',
          'bg-background border-l shadow-xl',
          'transform transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Session Info</h3>
          <button className="text-muted-foreground hover:text-foreground p-1" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-57px-73px)] space-y-6 overflow-y-auto p-4">
          <SessionDetailsSection duration={duration} session={session} />
          <Separator />
          <SecurityPolicySection policy={policy} />
          <Separator />
          <ResourceUsageSection resources={resources} />
          <Separator />
          <ActivityLogSection activities={activities} />
        </div>

        {/* Footer */}
        <div className="bg-background absolute bottom-0 left-0 right-0 border-t p-4">
          <Button className="w-full" variant="destructive" onClick={onEndSession}>
            <LogOut className="mr-2 h-4 w-4" />
            End Session
          </Button>
        </div>
      </div>
    </>
  );
}
