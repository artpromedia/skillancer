/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Kasm Embed Component
 *
 * Secure iframe embed for Kasm Workspaces:
 * - Secure iframe with sandbox attributes
 * - PostMessage communication
 * - Token injection
 * - Event listener for Kasm events
 * - Size synchronization
 * - Focus management
 */

import { cn } from '@skillancer/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface KasmEmbedConfig {
  sessionId: string;
  token: string;
  apiUrl: string;
  quality?: 'auto' | 'high' | 'medium' | 'low';
  frameRate?: 30 | 60;
}

export interface KasmEmbedEvents {
  onReady?: () => void;
  onError?: (error: string) => void;
  onDisconnect?: (reason?: string) => void;
  onResize?: (width: number, height: number) => void;
  onFocusChange?: (focused: boolean) => void;
  onMetrics?: (metrics: KasmMetrics) => void;
}

export interface KasmMetrics {
  latency: number;
  frameRate: number;
  bandwidth: number;
}

interface KasmEmbedProps {
  config: KasmEmbedConfig;
  events?: KasmEmbedEvents;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SANDBOX_ATTRIBUTES = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-pointer-lock',
  'allow-downloads',
].join(' ');

const ALLOWED_FEATURES = [
  'autoplay',
  'clipboard-read',
  'clipboard-write',
  'fullscreen',
  'microphone',
  'camera',
].join('; ');

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KasmEmbed({ config, events, className }: KasmEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Build iframe URL with token
  const iframeUrl = buildKasmUrl(config);

  // Handle messages from Kasm iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Validate origin
      const allowedOrigin = new URL(config.apiUrl).origin;
      if (event.origin !== allowedOrigin) return;

      const message = event.data;
      if (!message || typeof message !== 'object') return;

      switch (message.type) {
        case 'kasm:ready':
          setIsReady(true);
          events?.onReady?.();
          break;

        case 'kasm:error':
          events?.onError?.(message.error || 'Unknown error');
          break;

        case 'kasm:disconnect':
          events?.onDisconnect?.(message.reason);
          break;

        case 'kasm:resize':
          events?.onResize?.(message.width, message.height);
          break;

        case 'kasm:metrics':
          events?.onMetrics?.(message.metrics);
          break;
      }
    },
    [config.apiUrl, events]
  );

  // Set up message listener
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Send configuration to iframe once ready
  useEffect(() => {
    if (!isReady || !iframeRef.current?.contentWindow) return;

    const allowedOrigin = new URL(config.apiUrl).origin;
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'kasm:configure',
        config: {
          quality: config.quality || 'auto',
          frameRate: config.frameRate || 30,
        },
      },
      allowedOrigin
    );
  }, [isReady, config]);

  // Track focus state
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    events?.onFocusChange?.(true);
  }, [events]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    events?.onFocusChange?.(false);
  }, [events]);

  // Focus iframe programmatically
  const focusIframe = useCallback(() => {
    iframeRef.current?.focus();
  }, []);

  return (
    <div className={cn('relative h-full w-full', 'bg-black', className)} onClick={focusIframe}>
      <iframe
        ref={iframeRef}
        allow={ALLOWED_FEATURES}
        className={cn(
          'h-full w-full border-0',
          'focus:outline-none',
          isFocused && 'ring-primary ring-2 ring-offset-2'
        )}
        loading="eager"
        sandbox={SANDBOX_ATTRIBUTES}
        src={iframeUrl}
        title="SkillPod Secure Workspace"
        onBlur={handleBlur}
        onFocus={handleFocus}
      />

      {/* Focus indicator */}
      {!isFocused && isReady && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'cursor-pointer bg-black/30 backdrop-blur-sm',
            'transition-opacity duration-200'
          )}
          onClick={focusIframe}
        >
          <div className="text-center text-white">
            <p className="text-lg font-medium">Click to focus</p>
            <p className="text-sm text-white/70">Press Ctrl+Alt+Shift to release focus</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function buildKasmUrl(config: KasmEmbedConfig): string {
  const url = new URL(`${config.apiUrl}/api/v1/stream/${config.sessionId}`);
  url.searchParams.set('token', config.token);
  url.searchParams.set('auto_login', 'true');
  url.searchParams.set('quality', config.quality || 'auto');
  url.searchParams.set('fps', String(config.frameRate || 30));
  return url.toString();
}

// ============================================================================
// HOOK FOR CONTROLLING EMBED
// ============================================================================

export interface KasmEmbedController {
  sendCommand: (command: string, data?: Record<string, unknown>) => void;
  focus: () => void;
  blur: () => void;
}

export function useKasmEmbedController(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  apiUrl: string
): KasmEmbedController {
  const sendCommand = useCallback(
    (command: string, data?: Record<string, unknown>) => {
      if (!iframeRef.current?.contentWindow) return;

      const allowedOrigin = new URL(apiUrl).origin;
      iframeRef.current.contentWindow.postMessage(
        { type: `kasm:${command}`, ...data },
        allowedOrigin
      );
    },
    [iframeRef, apiUrl]
  );

  const focus = useCallback(() => {
    iframeRef.current?.focus();
  }, [iframeRef]);

  const blur = useCallback(() => {
    iframeRef.current?.blur();
  }, [iframeRef]);

  return { sendCommand, focus, blur };
}
