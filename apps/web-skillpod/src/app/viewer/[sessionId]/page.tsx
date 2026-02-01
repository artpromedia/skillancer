/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, react-hooks/exhaustive-deps */
'use client';

/**
 * VDI Viewer Page
 *
 * Full-screen VDI viewer for SkillPod sessions with:
 * - No navigation chrome (full immersion)
 * - Session initialization and connection
 * - Loading state with connection progress
 * - Error handling with reconnection
 * - Keyboard shortcut handling
 * - Exit confirmation dialog
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@skillancer/ui';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ConnectionOverlay } from '@/components/viewer/connection-overlay';
import {
  ContainmentToast,
  type ContainmentEvent as ToastContainmentEvent,
} from '@/components/viewer/containment-toast';
import {
  FileTransferPanel,
  type FileTransfer,
  type PolicyRestrictions,
} from '@/components/viewer/file-transfer-panel';
import { KeyboardShortcuts } from '@/components/viewer/keyboard-shortcuts';
import {
  QualitySettings,
  type QualityConfig,
  type NetworkStats,
} from '@/components/viewer/quality-settings';
import {
  SessionInfoPanel,
  type SessionDetails,
  type SecurityPolicy,
  type ResourceUsage,
  type ActivityEvent,
} from '@/components/viewer/session-info-panel';
import { VdiViewer } from '@/components/viewer/vdi-viewer';
import { ViewerToolbar } from '@/components/viewer/viewer-toolbar';
import { WatermarkOverlay, type WatermarkConfig } from '@/components/viewer/watermark-overlay';
import { useContainment } from '@/hooks/use-containment';
import { useVdiSession } from '@/hooks/use-vdi-session';
import { initializeScreenshotDetection } from '@/lib/screenshot-detection';

// ============================================================================
// TYPES
// ============================================================================

interface ToastEvent {
  id: string;
  type: 'clipboard_blocked' | 'file_blocked' | 'screenshot_detected' | 'usb_denied' | 'approved';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  severity: 'warning' | 'info' | 'success' | 'error';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const contractId = searchParams.get('contractId');

  // Panel state
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFileTransfer, setShowFileTransfer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Session and containment hooks - properly destructure the [state, actions] tuple
  const [sessionState, sessionActions] = useVdiSession({
    onConnected: () => console.log('VDI session connected'),
    onDisconnected: (reason) => console.log('VDI session disconnected:', reason),
    onError: (error) => console.error('VDI session error:', error),
    onSessionExpiring: (seconds) => console.warn('Session expiring in', seconds, 'seconds'),
  });

  const [containmentState, containmentActions] = useContainment({
    sessionId,
    onViolation: (event) => {
      // Add toast for containment violations
      addToast({
        id: `violation-${Date.now()}`,
        type: mapContainmentEventType(event.type),
        message: event.details || `${event.type} event`,
        severity: event.action === 'blocked' ? 'warning' : 'info',
      });
    },
    enableScreenshotDetection: true,
  });

  // Toast notifications for containment events
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  // Map containment event types to toast event types
  const mapContainmentEventType = (type: string): ToastEvent['type'] => {
    switch (type) {
      case 'clipboard_blocked':
        return 'clipboard_blocked';
      case 'file_blocked':
        return 'file_blocked';
      case 'screenshot_blocked':
        return 'screenshot_detected';
      case 'usb_blocked':
        return 'usb_denied';
      default:
        return 'approved';
    }
  };

  // Derived state for UI
  const connectionState = sessionState.connectionState;
  const quality = sessionState.quality;
  const error = sessionState.error;
  const metrics = sessionState.metrics;
  const sessionDetails = sessionState.sessionDetails;

  // Audio/video state - derive from session state or use defaults
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);

  // Compute session duration from start time
  const sessionDuration = useMemo(() => {
    if (!sessionState.startTime) return 0;
    return Math.floor((Date.now() - sessionState.startTime.getTime()) / 1000);
  }, [sessionState.startTime]);

  // Mock latency and fps from metrics or defaults
  const latency = metrics?.latency ?? 0;
  const fps = metrics?.frameRate ?? 0;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize connection on mount
  useEffect(() => {
    if (sessionId) {
      sessionActions.connect(sessionId);
    }

    return () => {
      // Cleanup on unmount
    };
  }, [sessionId]);

  // Initialize screenshot detection
  useEffect(() => {
    const cleanup = initializeScreenshotDetection({
      onDetected: (method) => {
        addToast({
          id: `screenshot-${Date.now()}`,
          type: 'screenshot_detected',
          message: `Screenshot attempt detected (${method}) and logged`,
          severity: 'warning',
        });
      },
      sessionId,
    });

    return cleanup;
  }, [sessionId]);

  // Handle containment events
  useEffect(() => {
    if (containmentState.events.length > 0) {
      const latestEvent = containmentState.events[0]; // Events are prepended
      addToast({
        id: `containment-${Date.now()}`,
        type: mapContainmentEventType(latestEvent.type),
        message: latestEvent.details || latestEvent.type,
        severity: latestEvent.action === 'blocked' ? 'warning' : 'info',
      });
    }
  }, [containmentState.events.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+End - Show toolbar
      if (e.ctrlKey && e.altKey && e.key === 'End') {
        e.preventDefault();
        // Toolbar will show on mouse movement, this forces it
      }

      // Ctrl+Alt+Shift - Release keyboard grab
      if (e.ctrlKey && e.altKey && e.shiftKey) {
        e.preventDefault();
        // Release focus from VDI
      }

      // F11 - Toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }

      // Escape - Show exit dialog
      if (e.key === 'Escape' && !showExitDialog) {
        e.preventDefault();
        setShowExitDialog(true);
      }

      // ? - Show shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.altKey) {
        setShowShortcuts(true);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [showExitDialog]);

  // Fullscreen change detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Warn before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (connectionState === 'connected') {
        e.preventDefault();
      }
    };

    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    return () => globalThis.removeEventListener('beforeunload', handleBeforeUnload);
  }, [connectionState]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const filterToastById = (toasts: ToastEvent[], id: string) => toasts.filter((t) => t.id !== id);

  const removeToast = (id: string) => {
    setToasts((prev) => filterToastById(prev, id));
  };

  const addToast = useCallback((event: ToastEvent) => {
    setToasts((prev) => [...prev, event]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => removeToast(event.id), 5000);
  }, []);

  const toggleAudio = () => setIsAudioEnabled((prev) => !prev);
  const toggleMicrophone = () => setIsMicrophoneEnabled((prev) => !prev);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleDisconnect = async () => {
    sessionActions.disconnect();
    router.push('/pods');
  };

  const handleReconnect = async () => {
    await sessionActions.reconnect();
    setShowExitDialog(false);
  };

  const handleQualityChange = (newQuality: QualityConfig['preset']) => {
    sessionActions.setQuality(newQuality as 'auto' | 'high' | 'medium' | 'low');
  };

  // File transfer handlers
  const handleFileUpload = async (files: File[]) => {
    await containmentActions.requestFileUpload(files);
  };

  const handleFileDownload = async (transferId: string) => {
    await containmentActions.requestFileDownload(transferId, 'file');
  };

  const handleCancelTransfer = (transferId: string) => {
    containmentActions.cancelFileTransfer(transferId);
  };

  const handleRequestApproval = async (_transferId: string) => {
    // No-op for now, transfers auto-request approval
  };

  // Build props for components
  const qualityConfig: QualityConfig = {
    preset: quality as QualityConfig['preset'],
    frameRate: 30,
    audioQuality: 'high',
    adaptiveBitrate: true,
  };

  const networkStats: NetworkStats = {
    latency,
    jitter: 0,
    packetLoss: 0,
    bandwidth: { up: 0, down: 0 },
    frameRate: fps,
    resolution: '1920x1080',
  };

  const policyRestrictions: PolicyRestrictions = {
    maxFileSize: containmentState.policy?.maxFileSize ?? 100 * 1024 * 1024,
    allowedTypes: containmentState.policy?.allowedFileTypes ?? ['*'],
    blockedTypes: [],
    requireApproval: false,
    dlpEnabled: false,
  };

  const sessionInfoDetails: SessionDetails = {
    id: sessionId,
    podId: sessionDetails?.podId ?? 'unknown',
    podName: sessionDetails?.podName ?? 'SkillPod Session',
    startTime: sessionState.startTime ?? new Date(),
    contractId: contractId ?? undefined,
    projectName: undefined,
    userId: sessionDetails?.userId ?? 'unknown',
    userEmail: 'user@example.com',
  };

  const securityPolicy: SecurityPolicy = {
    clipboardEnabled: containmentState.policy?.clipboardEnabled ?? false,
    fileTransferEnabled: containmentState.policy?.fileTransferEnabled ?? false,
    watermarkEnabled: containmentState.policy?.watermarkEnabled ?? false,
    screenshotBlocked: containmentState.policy?.screenshotProtection ?? true,
    recordingEnabled: containmentState.policy?.recordingEnabled ?? false,
  };

  const resourceUsage: ResourceUsage = {
    cpu: 0,
    memory: 0,
    storage: { used: 0, total: 100 },
  };

  const activities: ActivityEvent[] = containmentState.events.slice(0, 10).map((event, index) => ({
    id: `activity-${index}`,
    type: 'violation' as const,
    message: event.details ?? event.type,
    timestamp: event.timestamp,
  }));

  // Convert file transfer state to FileTransfer[]
  const fileTransfers: FileTransfer[] = [
    ...containmentState.fileTransfer.pendingUploads.map((t) => ({
      id: t.id,
      name: t.filename,
      size: t.size,
      type: t.type ?? 'application/octet-stream',
      direction: 'upload' as const,
      status: t.status as FileTransfer['status'],
      progress: 0,
      createdAt: new Date(t.createdAt),
    })),
    ...containmentState.fileTransfer.pendingDownloads.map((t) => ({
      id: t.id,
      name: t.filename,
      size: t.size,
      type: t.type ?? 'application/octet-stream',
      direction: 'download' as const,
      status: t.status as FileTransfer['status'],
      progress: 0,
      createdAt: new Date(t.createdAt),
    })),
  ];

  // Toast events for ContainmentToast component
  const toastContainmentEvents: ToastContainmentEvent[] = toasts.map((t) => ({
    id: t.id,
    type: mapToastTypeToContainmentType(t.type),
    message: t.message,
    timestamp: new Date(),
    autoDismiss: true,
    dismissAfter: 5000,
  }));

  const mapToastTypeToContainmentType = (
    type: ToastEvent['type']
  ): ToastContainmentEvent['type'] => {
    switch (type) {
      case 'clipboard_blocked':
        return 'clipboard_blocked';
      case 'file_blocked':
        return 'file_blocked';
      case 'screenshot_detected':
        return 'screenshot_blocked';
      case 'usb_denied':
        return 'usb_blocked';
      default:
        return 'policy_updated';
    }
  };

  // Watermark config
  const watermarkConfig: WatermarkConfig | null = containmentState.policy?.watermarkEnabled
    ? {
        enabled: true,
        pattern: 'tiled',
        content: {
          userEmail: sessionInfoDetails.userEmail,
          sessionId: sessionId.slice(0, 8),
          showTimestamp: true,
        },
        style: {
          opacity: 0.15,
          fontSize: 14,
          color: '#000000',
          rotation: -30,
        },
        antiScreenshot: true,
      }
    : null;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Main VDI Viewer */}
      <VdiViewer
        connectionState={connectionState}
        quality={quality}
        sessionId={sessionId}
        onQualityChange={handleQualityChange}
      />

      {/* Watermark Overlay */}
      {watermarkConfig && <WatermarkOverlay config={watermarkConfig} />}

      {/* Connection Overlay */}
      {connectionState !== 'connected' && (
        <ConnectionOverlay
          error={error}
          state={connectionState}
          onCancel={() => router.push('/pods')}
          onRetry={handleReconnect}
        />
      )}

      {/* Floating Toolbar */}
      <ViewerToolbar
        clipboardState={containmentState.clipboard.syncEnabled ? 'synced' : 'blocked'}
        isAudioEnabled={isAudioEnabled}
        isFullscreen={isFullscreen}
        isMicrophoneEnabled={isMicrophoneEnabled}
        latency={latency}
        quality={quality}
        sessionDuration={sessionDuration}
        onDisconnect={() => setShowExitDialog(true)}
        onOpenFileTransfer={() => setShowFileTransfer(true)}
        onOpenSessionInfo={() => setShowSessionInfo(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onQualityChange={handleQualityChange}
        onToggleAudio={toggleAudio}
        onToggleFullscreen={toggleFullscreen}
        onToggleMicrophone={toggleMicrophone}
      />

      {/* Containment Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <ContainmentToast events={toastContainmentEvents} onDismiss={removeToast} />
      </div>

      {/* File Transfer Panel */}
      {showFileTransfer && (
        <FileTransferPanel
          isOpen={showFileTransfer}
          onClose={() => setShowFileTransfer(false)}
          transfers={fileTransfers}
          restrictions={policyRestrictions}
          onUpload={handleFileUpload}
          onDownload={handleFileDownload}
          onCancelTransfer={handleCancelTransfer}
          onRequestApproval={handleRequestApproval}
        />
      )}

      {/* Quality Settings */}
      {showSettings && (
        <QualitySettings
          config={qualityConfig}
          stats={networkStats}
          onConfigChange={(changes) => {
            if (changes.preset) {
              handleQualityChange(changes.preset);
            }
          }}
        />
      )}

      {/* Keyboard Shortcuts */}
      {showShortcuts && (
        <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      )}

      {/* Session Info Panel */}
      {showSessionInfo && (
        <SessionInfoPanel
          isOpen={showSessionInfo}
          onClose={() => setShowSessionInfo(false)}
          session={sessionInfoDetails}
          policy={securityPolicy}
          resources={resourceUsage}
          activities={activities}
          onEndSession={() => setShowExitDialog(true)}
        />
      )}

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End VDI Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect from this session? Any unsaved work in the virtual
              desktop may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDisconnect}
            >
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden Session Metadata (for debugging) */}
      <div className="hidden" data-contract-id={contractId} data-session-id={sessionId}>
        Session: {sessionId}
      </div>
    </div>
  );
}
