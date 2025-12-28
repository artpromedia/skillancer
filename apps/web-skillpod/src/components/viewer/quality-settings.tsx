/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment */
'use client';

/**
 * Quality Settings Component
 *
 * Quality and performance settings panel:
 * - Video quality presets
 * - Frame rate options
 * - Bandwidth usage display
 * - Latency graph
 * - Network statistics
 */

import {
  cn,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@skillancer/ui';
import { Activity, Settings, Signal, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type QualityPreset = 'auto' | 'high' | 'medium' | 'low';
export type FrameRate = 30 | 60;
export type StatusLevel = 'good' | 'fair' | 'poor';

export interface QualityConfig {
  preset: QualityPreset;
  frameRate: FrameRate;
  audioQuality: 'high' | 'medium' | 'low';
  adaptiveBitrate: boolean;
}

export interface NetworkStats {
  latency: number;
  jitter: number;
  packetLoss: number;
  bandwidth: {
    up: number;
    down: number;
  };
  frameRate: number;
  resolution: string;
}

interface QualitySettingsProps {
  config: QualityConfig;
  stats: NetworkStats;
  onConfigChange: (config: Partial<QualityConfig>) => void;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PRESET_CONFIG: Record<QualityPreset, { label: string; description: string }> = {
  auto: { label: 'Auto', description: 'Adapts to your network' },
  high: { label: 'High', description: '1080p, high bitrate' },
  medium: { label: 'Medium', description: '720p, balanced' },
  low: { label: 'Low', description: '480p, low latency' },
};

const QUALITY_THRESHOLDS = {
  latency: { good: 50, fair: 100 },
  jitter: { good: 10, fair: 30 },
  packetLoss: { good: 0.5, fair: 2 },
};

// ============================================================================
// LATENCY GRAPH
// ============================================================================

interface LatencyGraphProps {
  latencyHistory: number[];
  maxLatency?: number;
}

function LatencyGraph({ latencyHistory, maxLatency = 200 }: Readonly<LatencyGraphProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= height; y += height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (latencyHistory.length < 2) return;

    // Draw line
    const stepX = width / (latencyHistory.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;

    latencyHistory.forEach((latency, i) => {
      const x = i * stepX;
      const y = height - (latency / maxLatency) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill area under line
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.fill();
  }, [latencyHistory, maxLatency]);

  return (
    <canvas ref={canvasRef} className="h-15 bg-muted/30 w-full rounded" height={60} width={200} />
  );
}

// ============================================================================
// STAT ITEM
// ============================================================================

interface StatItemProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: StatusLevel;
}

function StatItem({ label, value, unit, status }: Readonly<StatItemProps>) {
  const statusColors = {
    good: 'text-green-500',
    fair: 'text-yellow-500',
    poor: 'text-red-500',
  };

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn('text-sm font-medium', status && statusColors[status])}>
        {value}
        {unit && <span className="ml-0.5 text-xs">{unit}</span>}
      </span>
    </div>
  );
}

// ============================================================================
// QUALITY INDICATOR
// ============================================================================

interface QualityIndicatorProps {
  stats: NetworkStats;
  size?: 'sm' | 'md';
}

/**
 * Gets the appropriate signal icon based on quality level (number of bars).
 */
function getSignalIcon(bars: number) {
  if (bars >= 4) return SignalHigh;
  if (bars >= 3) return SignalMedium;
  if (bars >= 2) return SignalLow;
  return Signal;
}

export function QualityIndicator({ stats, size = 'md' }: Readonly<QualityIndicatorProps>) {
  const getQuality = () => {
    if (
      stats.latency < QUALITY_THRESHOLDS.latency.good &&
      stats.packetLoss < QUALITY_THRESHOLDS.packetLoss.good
    ) {
      return { level: 'good', bars: 4 };
    }
    if (
      stats.latency < QUALITY_THRESHOLDS.latency.fair &&
      stats.packetLoss < QUALITY_THRESHOLDS.packetLoss.fair
    ) {
      return { level: 'fair', bars: 3 };
    }
    if (stats.latency < 150) {
      return { level: 'poor', bars: 2 };
    }
    return { level: 'critical', bars: 1 };
  };

  const quality = getQuality();
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  const colors = {
    good: 'text-green-500',
    fair: 'text-yellow-500',
    poor: 'text-orange-500',
    critical: 'text-red-500',
  };

  const Icon = getSignalIcon(quality.bars);

  return <Icon className={cn(iconSize, colors[quality.level as keyof typeof colors])} />;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QualitySettings({
  config,
  stats,
  onConfigChange,
  className,
}: Readonly<QualitySettingsProps>) {
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  // Track latency history for graph
  useEffect(() => {
    setLatencyHistory((prev) => {
      const next = [...prev, stats.latency];
      return next.slice(-30); // Keep last 30 readings
    });
  }, [stats.latency]);

  const getLatencyStatus = (): StatusLevel => {
    if (stats.latency < QUALITY_THRESHOLDS.latency.good) return 'good';
    if (stats.latency < QUALITY_THRESHOLDS.latency.fair) return 'fair';
    return 'poor';
  };

  const getPacketLossStatus = (): StatusLevel => {
    if (stats.packetLoss < QUALITY_THRESHOLDS.packetLoss.good) return 'good';
    if (stats.packetLoss < QUALITY_THRESHOLDS.packetLoss.fair) return 'fair';
    return 'poor';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'hover:bg-accent flex items-center gap-2 rounded-lg p-2 transition-colors',
            className
          )}
        >
          <QualityIndicator size="sm" stats={stats} />
          <span className="text-muted-foreground text-xs">{stats.latency}ms</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <h4 className="font-medium">Quality & Performance</h4>
          </div>

          {/* Quality preset */}
          <div className="space-y-2">
            <Label className="text-xs">Video Quality</Label>
            <Select
              value={config.preset}
              onValueChange={(v) => onConfigChange({ preset: v as QualityPreset })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESET_CONFIG).map(([key, { label, description }]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-muted-foreground text-xs">{description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frame rate */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Frame Rate</Label>
              <p className="text-muted-foreground text-xs">Higher uses more bandwidth</p>
            </div>
            <Select
              value={config.frameRate.toString()}
              onValueChange={(v) =>
                onConfigChange({ frameRate: Number.parseInt(v, 10) as FrameRate })
              }
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Adaptive bitrate */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Adaptive Bitrate</Label>
              <p className="text-muted-foreground text-xs">Auto-adjust to network</p>
            </div>
            <Switch
              checked={config.adaptiveBitrate}
              onCheckedChange={(v) => onConfigChange({ adaptiveBitrate: v })}
            />
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Network stats */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium">Network Statistics</span>
            </div>

            {/* Latency graph */}
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Latency</span>
                <span className="text-xs font-medium">{stats.latency}ms</span>
              </div>
              <LatencyGraph latencyHistory={latencyHistory} />
            </div>

            {/* Stats grid */}
            <div className="space-y-0.5">
              <StatItem
                label="Latency"
                status={getLatencyStatus()}
                unit="ms"
                value={stats.latency}
              />
              <StatItem label="Jitter" unit="ms" value={stats.jitter} />
              <StatItem
                label="Packet Loss"
                status={getPacketLossStatus()}
                unit="%"
                value={stats.packetLoss.toFixed(1)}
              />
              <StatItem label="Frame Rate" unit="fps" value={stats.frameRate} />
              <StatItem label="Resolution" value={stats.resolution} />
              <StatItem
                label="Bandwidth ↓"
                unit="Mbps"
                value={(stats.bandwidth.down / 1000).toFixed(1)}
              />
              <StatItem
                label="Bandwidth ↑"
                unit="Mbps"
                value={(stats.bandwidth.up / 1000).toFixed(1)}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
