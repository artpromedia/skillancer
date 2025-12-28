/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, no-console */
'use client';

/**
 * VDI Viewer Component
 *
 * Main VDI viewer that embeds Kasm WebRTC streaming with:
 * - Dynamic sizing (responsive to window)
 * - Aspect ratio maintenance
 * - Connection state management
 * - Quality indicator overlay
 * - Latency display
 * - Frame rate counter (debug mode)
 */

import { cn, Skeleton } from '@skillancer/ui';
import { Activity, SignalHigh, SignalLow, SignalMedium, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { KasmEmbed } from '@/lib/kasm/kasm-embed';

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type QualityLevel = 'auto' | 'high' | 'medium' | 'low';

interface VdiViewerProps {
  readonly sessionId: string;
  readonly connectionState: ConnectionState;
  readonly quality: QualityLevel;
  readonly onQualityChange: (quality: QualityLevel) => void;
  readonly showDebugInfo?: boolean;
  readonly className?: string;
}

interface PerformanceStats {
  fps: number;
  latency: number;
  bandwidth: number;
  packetLoss: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VdiViewer({
  sessionId,
  connectionState,
  quality,
  onQualityChange,
  showDebugInfo = false,
  className,
}: VdiViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    latency: 0,
    bandwidth: 0,
    packetLoss: 0,
  });
  const [showStats, setShowStats] = useState(showDebugInfo);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Handle window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Performance stats update (simulated - real implementation would come from Kasm)
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const interval = setInterval(() => {
      setStats({
        fps: 55 + Math.floor(Math.random() * 10),
        latency: 20 + Math.floor(Math.random() * 30),
        bandwidth: 2.5 + Math.random() * 2,
        packetLoss: Math.random() * 0.5,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionState]);

  // Debug mode toggle (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowStats((prev) => !prev);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleKasmEvent = useCallback((event: string, _data: unknown) => {
    // Kasm event handler - events processed by switch below

    switch (event) {
      case 'quality_change':
        // Handle quality change from Kasm
        break;
      case 'latency_update':
        // Update latency stats
        break;
      case 'connection_state':
        // Handle connection state change
        break;
    }
  }, []);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatsColor = (
    value: number,
    goodThreshold: number,
    warningThreshold: number,
    higherIsBetter: boolean
  ): string => {
    if (higherIsBetter) {
      if (value >= goodThreshold) return 'text-green-400';
      if (value >= warningThreshold) return 'text-yellow-400';
      return 'text-red-400';
    }
    if (value < goodThreshold) return 'text-green-400';
    if (value < warningThreshold) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSignalIcon = () => {
    if (connectionState !== 'connected') {
      return <WifiOff className="text-muted-foreground h-4 w-4" />;
    }

    if (stats.latency < 30) {
      return <SignalHigh className="h-4 w-4 text-green-500" />;
    } else if (stats.latency < 60) {
      return <SignalMedium className="h-4 w-4 text-yellow-500" />;
    } else {
      return <SignalLow className="h-4 w-4 text-red-500" />;
    }
  };

  const getQualityColor = () => {
    switch (quality) {
      case 'high':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-orange-500';
      default:
        return 'text-blue-500';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden bg-black', className)}
    >
      {/* Kasm Embed Container */}
      {connectionState === 'connected' ? (
        <KasmEmbed
          height={dimensions.height}
          quality={quality}
          sessionId={sessionId}
          width={dimensions.width}
          onEvent={handleKasmEvent}
        />
      ) : (
        // Placeholder while not connected
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <Skeleton className="h-[600px] w-[800px] bg-gray-800" />
          </div>
        </div>
      )}

      {/* Quality Indicator (top-right corner) */}
      {connectionState === 'connected' && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          {getSignalIcon()}
          <span className="text-xs font-medium text-white">{stats.latency}ms</span>
        </div>
      )}

      {/* Debug Stats Overlay */}
      {showStats && connectionState === 'connected' && (
        <div className="absolute left-4 top-4 space-y-2 rounded-lg bg-black/80 p-4 font-mono text-xs text-white backdrop-blur-sm">
          <div className="mb-2 font-semibold text-green-400">Performance Stats</div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-gray-400">FPS:</span>
            <span className={cn(getStatsColor(stats.fps, 60, 30, true))}>{stats.fps}</span>

            <span className="text-gray-400">Latency:</span>
            <span className={cn(getStatsColor(stats.latency, 30, 60, false))}>
              {stats.latency}ms
            </span>

            <span className="text-gray-400">Bandwidth:</span>
            <span className="text-blue-400">{stats.bandwidth.toFixed(1)} Mbps</span>

            <span className="text-gray-400">Packet Loss:</span>
            <span className={cn(getStatsColor(stats.packetLoss, 0.1, 0.5, false))}>
              {stats.packetLoss.toFixed(2)}%
            </span>

            <span className="text-gray-400">Quality:</span>
            <span className={getQualityColor()}>{quality}</span>

            <span className="text-gray-400">Resolution:</span>
            <span className="text-white">
              {dimensions.width}x{dimensions.height}
            </span>
          </div>

          <div className="border-t border-gray-600 pt-2 text-gray-500">
            Press Ctrl+Shift+D to hide
          </div>
        </div>
      )}

      {/* Connection State Indicator (bottom-left) */}
      {connectionState !== 'connected' && connectionState !== 'connecting' && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-yellow-500/90 px-3 py-2">
          <Activity className="h-4 w-4 animate-pulse text-yellow-900" />
          <span className="text-sm font-medium text-yellow-900">
            {connectionState === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
          </span>
        </div>
      )}
    </div>
  );
}
