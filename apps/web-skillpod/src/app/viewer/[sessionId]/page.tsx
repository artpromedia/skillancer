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
  Button,
  cn,
} from '@skillancer/ui';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ConnectionOverlay } from '@/components/viewer/connection-overlay';
import { ContainmentToast } from '@/components/viewer/containment-toast';
import { FileTransferPanel } from '@/components/viewer/file-transfer-panel';
import { KeyboardShortcuts } from '@/components/viewer/keyboard-shortcuts';
import { QualitySettings } from '@/components/viewer/quality-settings';
import { SessionInfoPanel } from '@/components/viewer/session-info-panel';
import { VdiViewer } from '@/components/viewer/vdi-viewer';
import { ViewerToolbar } from '@/components/viewer/viewer-toolbar';
import { WatermarkOverlay } from '@/components/viewer/watermark-overlay';
import { useContainment } from '@/hooks/use-containment';
import { useVdiSession } from '@/hooks/use-vdi-session';
import { initializeScreenshotDetection } from '@/lib/screenshot-detection';

// ============================================================================
// TYPES
// ============================================================================

interface ContainmentEvent {
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

  // Session and containment hooks
  const {
    session,
    connectionState,
    quality,
    latency,
    fps,
    error,
    connect,
    disconnect,
    reconnect,
    setQualityLevel,
    toggleAudio,
    toggleMicrophone,
    isAudioEnabled,
    isMicrophoneEnabled,
    sessionDuration,
    extendSession,
  } = useVdiSession(sessionId);

  const {
    policy,
    clipboardState,
    containmentEvents,
    dismissEvent,
    requestFileTransfer,
    pendingTransfers,
    syncClipboard,
  } = useContainment(sessionId);

  // Toast notifications for containment events
  const [toasts, setToasts] = useState<ContainmentEvent[]>([]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize connection on mount
  useEffect(() => {
    if (sessionId) {
      connect();
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
    if (containmentEvents.length > 0) {
      const latestEvent = containmentEvents[containmentEvents.length - 1];
      addToast(latestEvent);
    }
  }, [containmentEvents]);

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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        e.returnValue = 'You have an active VDI session. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [connectionState]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const addToast = (event: ContainmentEvent) => {
    setToasts((prev) => [...prev, event]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== event.id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    router.push('/pods');
  };

  const handleReconnect = () => {
    reconnect();
    setShowExitDialog(false);
  };

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
        onQualityChange={setQualityLevel}
      />

      {/* Watermark Overlay */}
      {policy?.watermark?.enabled && session && (
        <WatermarkOverlay
          config={policy.watermark}
          sessionId={sessionId}
          userEmail={session.user?.email || 'user@example.com'}
        />
      )}

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
        clipboardState={clipboardState}
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
        onQualityChange={setQualityLevel}
        onToggleAudio={toggleAudio}
        onToggleFullscreen={toggleFullscreen}
        onToggleMicrophone={toggleMicrophone}
      />

      {/* Containment Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <ContainmentToast key={toast.id} event={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* File Transfer Panel */}
      {showFileTransfer && (
        <FileTransferPanel
          pendingTransfers={pendingTransfers}
          policy={policy?.fileTransfer}
          sessionId={sessionId}
          onClose={() => setShowFileTransfer(false)}
          onRequestTransfer={requestFileTransfer}
        />
      )}

      {/* Quality Settings */}
      {showSettings && (
        <QualitySettings
          fps={fps}
          latency={latency}
          quality={quality}
          onClose={() => setShowSettings(false)}
          onQualityChange={setQualityLevel}
        />
      )}

      {/* Keyboard Shortcuts */}
      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}

      {/* Session Info Panel */}
      {showSessionInfo && (
        <SessionInfoPanel
          contractId={contractId}
          policy={policy}
          session={session}
          sessionDuration={sessionDuration}
          onClose={() => setShowSessionInfo(false)}
          onEndSession={() => setShowExitDialog(true)}
          onExtendSession={extendSession}
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
