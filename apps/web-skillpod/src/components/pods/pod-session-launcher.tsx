/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-misused-promises, jsx-a11y/label-has-associated-control */
'use client';

/**
 * Pod Session Launcher Component
 *
 * Handles session creation and management:
 * - Start new sessions
 * - Join active sessions
 * - Configure session settings
 * - Handle pod lifecycle
 */

import { useToast } from '@skillancer/ui';
import { Button } from '@skillancer/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/components/select';
import { Switch } from '@skillancer/ui/components/switch';
import { cn } from '@skillancer/ui/lib/utils';
import {
  AlertCircle,
  Loader2,
  Monitor,
  Play,
  Power,
  RefreshCw,
  Settings,
  Video,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { podsApi } from '@/lib/api/pods';

// ============================================================================
// TYPES
// ============================================================================

export interface PodSessionLauncherProps {
  podId: string;
  podStatus: 'running' | 'starting' | 'stopped' | 'error';
  activeSessionId?: string;
  containmentLevel: 'standard' | 'high' | 'maximum';
}

type QualityLevel = 'auto' | 'high' | 'medium' | 'low';

function getPodStatusIndicatorClass(status: string): string {
  if (status === 'running') return 'bg-green-500';
  if (status === 'starting') return 'animate-pulse bg-yellow-500';
  if (status === 'stopped') return 'bg-gray-500';
  return 'bg-red-500';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PodSessionLauncher({
  podId,
  podStatus,
  activeSessionId,
  containmentLevel,
}: Readonly<PodSessionLauncherProps>) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState<QualityLevel>('auto');
  const [resolution, setResolution] = useState('1920x1080');
  const [recordingEnabled, setRecordingEnabled] = useState(containmentLevel !== 'standard');

  const [isStarting, setIsStarting] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleStartPod = useCallback(async () => {
    setIsStarting(true);
    try {
      await podsApi.startPod(podId);
      toast({
        title: 'Pod Starting',
        description: 'Your pod is starting up. This may take a few moments.',
      });

      // Refresh the page to get updated status
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast({
        title: 'Failed to Start Pod',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  }, [podId, router, toast]);

  const handleStopPod = useCallback(async () => {
    try {
      await podsApi.stopPod(podId);
      toast({
        title: 'Pod Stopped',
        description: 'Your pod has been stopped.',
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast({
        title: 'Failed to Stop Pod',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  }, [podId, router, toast]);

  const handleLaunchSession = useCallback(async () => {
    setIsLaunching(true);
    try {
      const session = await podsApi.createSession({
        podId,
        quality,
        resolution,
        recordingEnabled,
      });

      toast({
        title: 'Session Created',
        description: 'Launching secure workspace...',
      });

      // Navigate to viewer
      router.push(`/viewer/${session.sessionId}`);
    } catch (error) {
      toast({
        title: 'Failed to Create Session',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      setIsLaunching(false);
    }
  }, [podId, quality, resolution, recordingEnabled, router, toast]);

  const handleJoinSession = useCallback(() => {
    if (activeSessionId) {
      router.push(`/viewer/${activeSessionId}`);
    }
  }, [activeSessionId, router]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Monitor className="h-5 w-5" />
        Session
      </h3>

      {/* Pod Status */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-700/50 p-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-3 w-3 rounded-full', getPodStatusIndicatorClass(podStatus))} />
          <span className="text-sm capitalize text-gray-300">{podStatus}</span>
        </div>

        {/* Pod controls */}
        <div className="flex gap-2">
          {podStatus === 'stopped' && (
            <Button
              disabled={isStarting || isPending}
              size="sm"
              variant="ghost"
              onClick={handleStartPod}
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </Button>
          )}
          {podStatus === 'running' && (
            <Button disabled={isPending} size="sm" variant="ghost" onClick={handleStopPod}>
              <Power className="h-4 w-4" />
            </Button>
          )}
          {podStatus === 'error' && (
            <Button size="sm" variant="ghost" onClick={() => podsApi.restartPod(podId)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Error state */}
      {podStatus === 'error' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-900/20 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Pod encountered an error. Try restarting.</span>
        </div>
      )}

      {/* Starting state */}
      {podStatus === 'starting' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-900/20 p-3 text-sm text-yellow-400">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
          <span>Pod is starting up. Please wait...</span>
        </div>
      )}

      {/* Session settings */}
      {podStatus === 'running' && !activeSessionId && (
        <>
          <button
            className="mb-4 flex w-full items-center justify-between text-sm text-gray-400 hover:text-white"
            onClick={() => setShowSettings(!showSettings)}
          >
            <span className="flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              Session Settings
            </span>
            <span>{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div className="mb-4 space-y-4 rounded-lg bg-gray-700/30 p-4">
              {/* Quality */}
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Quality</label>
                <Select value={quality} onValueChange={(v) => setQuality(v as QualityLevel)}>
                  <SelectTrigger className="bg-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Adaptive)</SelectItem>
                    <SelectItem value="high">High (4K)</SelectItem>
                    <SelectItem value="medium">Medium (1080p)</SelectItem>
                    <SelectItem value="low">Low (720p)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution */}
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Resolution</label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="bg-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3840x2160">4K (3840×2160)</SelectItem>
                    <SelectItem value="2560x1440">QHD (2560×1440)</SelectItem>
                    <SelectItem value="1920x1080">Full HD (1920×1080)</SelectItem>
                    <SelectItem value="1280x720">HD (1280×720)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recording */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-300">Enable Recording</span>
                </div>
                <Switch
                  checked={recordingEnabled}
                  disabled={containmentLevel === 'maximum'}
                  onCheckedChange={setRecordingEnabled}
                />
              </div>
              {containmentLevel === 'maximum' && (
                <p className="text-xs text-gray-500">
                  Recording is mandatory for maximum containment pods
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Launch buttons */}
      <div className="space-y-2">
        {activeSessionId ? (
          <Button
            className="w-full gap-2 bg-green-600 hover:bg-green-700"
            onClick={handleJoinSession}
          >
            <Play className="h-4 w-4" />
            Join Active Session
          </Button>
        ) : (
          <Button
            className="w-full gap-2"
            disabled={podStatus !== 'running' || isLaunching}
            onClick={handleLaunchSession}
          >
            {isLaunching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Launch Session
              </>
            )}
          </Button>
        )}

        {podStatus === 'stopped' && (
          <Button
            className="w-full gap-2"
            disabled={isStarting || isPending}
            variant="outline"
            onClick={handleStartPod}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting Pod...
              </>
            ) : (
              <>
                <Power className="h-4 w-4" />
                Start Pod First
              </>
            )}
          </Button>
        )}
      </div>

      {/* Active session indicator */}
      {activeSessionId && (
        <p className="mt-3 text-center text-xs text-gray-500">
          Session active since earlier. Click to rejoin.
        </p>
      )}
    </div>
  );
}
