/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, react-hooks/exhaustive-deps, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-argument */
'use client';

/**
 * useContainment Hook
 *
 * Data containment policy management:
 * - Policy state from server
 * - Clipboard intercept handling
 * - File transfer state
 * - Screenshot detection integration
 * - DLP event tracking
 */

import { useToast } from '@skillancer/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { viewerApi, type ContainmentPolicy, type FileTransferRequest } from '@/lib/api/viewer';
import { screenshotDetection, type ScreenshotEvent } from '@/lib/screenshot-detection';

// ============================================================================
// TYPES
// ============================================================================

export type ContainmentEventType =
  | 'clipboard_blocked'
  | 'file_blocked'
  | 'screenshot_blocked'
  | 'usb_blocked'
  | 'print_blocked'
  | 'screen_share_blocked';

export interface ContainmentEvent {
  type: ContainmentEventType;
  timestamp: Date;
  details?: string;
  action: 'blocked' | 'warned' | 'allowed';
}

export interface ClipboardState {
  syncEnabled: boolean;
  lastContent: string | null;
  direction: 'bidirectional' | 'inbound' | 'outbound' | 'disabled';
  pendingPaste: string | null;
}

export interface FileTransferState {
  enabled: boolean;
  direction: 'bidirectional' | 'upload' | 'download' | 'disabled';
  pendingUploads: FileTransferRequest[];
  pendingDownloads: FileTransferRequest[];
  scanningFiles: string[];
  blockedFiles: string[];
}

export interface ContainmentState {
  policy: ContainmentPolicy | null;
  clipboard: ClipboardState;
  fileTransfer: FileTransferState;
  screenshotProtection: boolean;
  watermarkEnabled: boolean;
  events: ContainmentEvent[];
  isLoading: boolean;
}

export interface ContainmentActions {
  refreshPolicy: () => Promise<void>;
  requestClipboardPaste: (content: string) => Promise<boolean>;
  requestClipboardCopy: () => Promise<string | null>;
  requestFileUpload: (files: File[]) => Promise<FileTransferRequest[]>;
  requestFileDownload: (fileId: string, filename: string) => Promise<boolean>;
  cancelFileTransfer: (requestId: string) => void;
  clearEvents: () => void;
  reportViolation: (type: ContainmentEventType, details?: string) => Promise<void>;
}

export interface UseContainmentOptions {
  sessionId: string;
  onViolation?: (event: ContainmentEvent) => void;
  enableScreenshotDetection?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useContainment(
  options: UseContainmentOptions
): [ContainmentState, ContainmentActions] {
  const { sessionId, onViolation, enableScreenshotDetection = true } = options;

  const { toast } = useToast();

  // State
  const [state, setState] = useState<ContainmentState>({
    policy: null,
    clipboard: {
      syncEnabled: false,
      lastContent: null,
      direction: 'disabled',
      pendingPaste: null,
    },
    fileTransfer: {
      enabled: false,
      direction: 'disabled',
      pendingUploads: [],
      pendingDownloads: [],
      scanningFiles: [],
      blockedFiles: [],
    },
    screenshotProtection: false,
    watermarkEnabled: false,
    events: [],
    isLoading: true,
  });

  // Refs
  const clipboardInterceptRef = useRef<((e: ClipboardEvent) => void) | null>(null);
  const eventStreamRef = useRef<EventSource | null>(null);

  // ============================================================================
  // POLICY MANAGEMENT
  // ============================================================================

  const refreshPolicy = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const policy = await viewerApi.getContainmentPolicy(sessionId);

      setState((prev) => ({
        ...prev,
        policy,
        clipboard: {
          ...prev.clipboard,
          syncEnabled: policy.clipboardEnabled,
          direction: policy.clipboardDirection,
        },
        fileTransfer: {
          ...prev.fileTransfer,
          enabled: policy.fileTransferEnabled,
          direction: policy.fileTransferDirection,
        },
        screenshotProtection: policy.screenshotProtection,
        watermarkEnabled: policy.watermarkEnabled,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch containment policy:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [sessionId]);

  // ============================================================================
  // EVENT RECORDING
  // ============================================================================

  const addEvent = useCallback(
    (event: ContainmentEvent) => {
      setState((prev) => ({
        ...prev,
        events: [event, ...prev.events].slice(0, 100), // Keep last 100 events
      }));

      onViolation?.(event);

      // Show toast for blocked actions
      if (event.action === 'blocked') {
        toast({
          title: 'Action Blocked',
          description: getEventDescription(event.type, event.details),
          variant: 'destructive',
        });
      }
    },
    [onViolation, toast]
  );

  const clearEvents = useCallback(() => {
    setState((prev) => ({ ...prev, events: [] }));
  }, []);

  const reportViolation = useCallback(
    async (type: ContainmentEventType, details?: string) => {
      const event: ContainmentEvent = {
        type,
        timestamp: new Date(),
        details,
        action: 'blocked',
      };

      addEvent(event);

      try {
        await viewerApi.reportContainmentViolation(sessionId, {
          type,
          details,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to report violation:', error);
      }
    },
    [sessionId, addEvent]
  );

  // ============================================================================
  // CLIPBOARD HANDLING
  // ============================================================================

  const requestClipboardPaste = useCallback(
    async (content: string): Promise<boolean> => {
      if (!state.policy?.clipboardEnabled) {
        await reportViolation('clipboard_blocked', 'Clipboard paste blocked by policy');
        return false;
      }

      const direction = state.policy.clipboardDirection;
      if (direction === 'outbound' || direction === 'disabled') {
        await reportViolation('clipboard_blocked', 'Inbound clipboard paste not allowed');
        return false;
      }

      // Check DLP for content
      try {
        const allowed = await viewerApi.checkClipboardContent(sessionId, {
          content,
          direction: 'inbound',
        });

        if (!allowed) {
          await reportViolation('clipboard_blocked', 'Content blocked by DLP policy');
          return false;
        }

        setState((prev) => ({
          ...prev,
          clipboard: {
            ...prev.clipboard,
            lastContent: content,
            pendingPaste: null,
          },
        }));

        return true;
      } catch (error) {
        console.error('Clipboard check failed:', error);
        return false;
      }
    },
    [sessionId, state.policy, reportViolation]
  );

  const requestClipboardCopy = useCallback(async (): Promise<string | null> => {
    if (!state.policy?.clipboardEnabled) {
      await reportViolation('clipboard_blocked', 'Clipboard copy blocked by policy');
      return null;
    }

    const direction = state.policy.clipboardDirection;
    if (direction === 'inbound' || direction === 'disabled') {
      await reportViolation('clipboard_blocked', 'Outbound clipboard copy not allowed');
      return null;
    }

    try {
      const content = await viewerApi.getRemoteClipboard(sessionId);

      // Check DLP for content
      const allowed = await viewerApi.checkClipboardContent(sessionId, {
        content,
        direction: 'outbound',
      });

      if (!allowed) {
        await reportViolation('clipboard_blocked', 'Content blocked by DLP policy');
        return null;
      }

      setState((prev) => ({
        ...prev,
        clipboard: {
          ...prev.clipboard,
          lastContent: content,
        },
      }));

      return content;
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      return null;
    }
  }, [sessionId, state.policy, reportViolation]);

  // ============================================================================
  // FILE TRANSFER
  // ============================================================================

  const requestFileUpload = useCallback(
    async (files: File[]): Promise<FileTransferRequest[]> => {
      if (!state.policy?.fileTransferEnabled) {
        await reportViolation('file_blocked', 'File upload blocked by policy');
        return [];
      }

      const direction = state.policy.fileTransferDirection;
      if (direction === 'download' || direction === 'disabled') {
        await reportViolation('file_blocked', 'File upload not allowed');
        return [];
      }

      const requests: FileTransferRequest[] = [];
      const scanning: string[] = [];
      const blocked: string[] = [];

      for (const file of files) {
        // Check file size limit
        const maxSize = state.policy.maxFileSize || 100 * 1024 * 1024; // 100MB default
        if (file.size > maxSize) {
          blocked.push(file.name);
          await reportViolation('file_blocked', `File ${file.name} exceeds size limit`);
          continue;
        }

        // Check file type
        if (state.policy.allowedFileTypes?.length) {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (!state.policy.allowedFileTypes.includes(ext)) {
            blocked.push(file.name);
            await reportViolation('file_blocked', `File type .${ext} not allowed`);
            continue;
          }
        }

        scanning.push(file.name);

        try {
          const request = await viewerApi.requestFileUpload(sessionId, {
            filename: file.name,
            size: file.size,
            type: file.type,
          });

          requests.push(request);
        } catch (error) {
          blocked.push(file.name);
        }
      }

      setState((prev) => ({
        ...prev,
        fileTransfer: {
          ...prev.fileTransfer,
          pendingUploads: [...prev.fileTransfer.pendingUploads, ...requests],
          scanningFiles: [...prev.fileTransfer.scanningFiles, ...scanning],
          blockedFiles: [...prev.fileTransfer.blockedFiles, ...blocked],
        },
      }));

      return requests;
    },
    [sessionId, state.policy, reportViolation]
  );

  const requestFileDownload = useCallback(
    async (fileId: string, filename: string): Promise<boolean> => {
      if (!state.policy?.fileTransferEnabled) {
        await reportViolation('file_blocked', 'File download blocked by policy');
        return false;
      }

      const direction = state.policy.fileTransferDirection;
      if (direction === 'upload' || direction === 'disabled') {
        await reportViolation('file_blocked', 'File download not allowed');
        return false;
      }

      try {
        const request = await viewerApi.requestFileDownload(sessionId, {
          fileId,
          filename,
        });

        setState((prev) => ({
          ...prev,
          fileTransfer: {
            ...prev.fileTransfer,
            pendingDownloads: [...prev.fileTransfer.pendingDownloads, request],
          },
        }));

        return true;
      } catch (error) {
        await reportViolation('file_blocked', `Download of ${filename} blocked`);
        return false;
      }
    },
    [sessionId, state.policy, reportViolation]
  );

  const cancelFileTransfer = useCallback(
    (requestId: string) => {
      viewerApi.cancelFileTransfer(sessionId, requestId).catch(console.error);

      setState((prev) => ({
        ...prev,
        fileTransfer: {
          ...prev.fileTransfer,
          pendingUploads: prev.fileTransfer.pendingUploads.filter((r) => r.id !== requestId),
          pendingDownloads: prev.fileTransfer.pendingDownloads.filter((r) => r.id !== requestId),
        },
      }));
    },
    [sessionId]
  );

  // ============================================================================
  // SCREENSHOT DETECTION
  // ============================================================================

  const handleScreenshotDetected = useCallback(
    (event: ScreenshotEvent) => {
      reportViolation('screenshot_blocked', `Screenshot attempt detected: ${event.type}`);
    },
    [reportViolation]
  );

  // ============================================================================
  // CLIPBOARD INTERCEPT
  // ============================================================================

  const setupClipboardIntercept = useCallback(() => {
    if (clipboardInterceptRef.current) {
      document.removeEventListener('paste', clipboardInterceptRef.current);
    }

    const handler = async (e: ClipboardEvent) => {
      // Only intercept when viewer is focused
      const viewerElement = document.querySelector('[data-vdi-viewer]');
      if (!viewerElement?.contains(e.target as Node)) return;

      e.preventDefault();

      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        const allowed = await requestClipboardPaste(text);
        if (!allowed) {
          toast({
            title: 'Clipboard Blocked',
            description: 'This content cannot be pasted into the secure workspace',
            variant: 'destructive',
          });
        }
      }
    };

    clipboardInterceptRef.current = handler;
    document.addEventListener('paste', handler);
  }, [requestClipboardPaste, toast]);

  // ============================================================================
  // SSE EVENT STREAM
  // ============================================================================

  const setupEventStream = useCallback(() => {
    if (eventStreamRef.current) {
      eventStreamRef.current.close();
    }

    const eventSource = new EventSource(`/api/v1/sessions/${sessionId}/containment/events`);

    eventSource.addEventListener('policy_update', () => {
      refreshPolicy();
    });

    eventSource.addEventListener('file_scan_complete', (e) => {
      const data = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        fileTransfer: {
          ...prev.fileTransfer,
          scanningFiles: prev.fileTransfer.scanningFiles.filter((f) => f !== data.filename),
        },
      }));
    });

    eventSource.addEventListener('file_blocked', (e) => {
      const data = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        fileTransfer: {
          ...prev.fileTransfer,
          scanningFiles: prev.fileTransfer.scanningFiles.filter((f) => f !== data.filename),
          blockedFiles: [...prev.fileTransfer.blockedFiles, data.filename],
        },
      }));
      addEvent({
        type: 'file_blocked',
        timestamp: new Date(),
        details: `File ${data.filename} blocked: ${data.reason}`,
        action: 'blocked',
      });
    });

    eventStreamRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [sessionId, refreshPolicy, addEvent]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load policy on mount
  useEffect(() => {
    refreshPolicy();
  }, [refreshPolicy]);

  // Setup clipboard intercept when policy loads
  useEffect(() => {
    if (state.policy?.clipboardEnabled) {
      setupClipboardIntercept();
    }

    return () => {
      if (clipboardInterceptRef.current) {
        document.removeEventListener('paste', clipboardInterceptRef.current);
      }
    };
  }, [state.policy?.clipboardEnabled, setupClipboardIntercept]);

  // Setup screenshot detection
  useEffect(() => {
    if (enableScreenshotDetection && state.policy?.screenshotProtection) {
      screenshotDetection.start(handleScreenshotDetected);

      return () => {
        screenshotDetection.stop();
      };
    }
  }, [enableScreenshotDetection, state.policy?.screenshotProtection, handleScreenshotDetected]);

  // Setup SSE event stream
  useEffect(() => {
    return setupEventStream();
  }, [setupEventStream]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getEventDescription = (type: ContainmentEventType, details?: string): string => {
    const descriptions: Record<ContainmentEventType, string> = {
      clipboard_blocked: 'Clipboard access was blocked by security policy',
      file_blocked: 'File transfer was blocked by security policy',
      screenshot_blocked: 'Screenshot attempt was detected and blocked',
      usb_blocked: 'USB device access was blocked',
      print_blocked: 'Print operation was blocked',
      screen_share_blocked: 'Screen sharing was blocked',
    };

    return details || descriptions[type];
  };

  // ============================================================================
  // RETURN
  // ============================================================================

  const actions: ContainmentActions = {
    refreshPolicy,
    requestClipboardPaste,
    requestClipboardCopy,
    requestFileUpload,
    requestFileDownload,
    cancelFileTransfer,
    clearEvents,
    reportViolation,
  };

  return [state, actions];
}
