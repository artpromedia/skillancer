/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Watermark Overlay Component
 *
 * Dynamic watermark overlay positioned above VDI stream:
 * - Renders watermark based on policy configuration
 * - Supports tiled, corner, and center patterns
 * - Semi-transparent and cannot be selected
 * - Updates position periodically (anti-screenshot)
 */

import { cn } from '@skillancer/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type WatermarkPattern = 'tiled' | 'corner' | 'center' | 'diagonal';
export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WatermarkConfig {
  enabled: boolean;
  pattern: WatermarkPattern;
  position?: WatermarkPosition;
  content: {
    userEmail?: string;
    sessionId?: string;
    showTimestamp?: boolean;
    customText?: string;
  };
  style: {
    opacity: number;
    fontSize: number;
    color: string;
    rotation?: number;
  };
  antiScreenshot?: boolean;
}

interface WatermarkOverlayProps {
  config: WatermarkConfig;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: WatermarkConfig = {
  enabled: true,
  pattern: 'tiled',
  content: {
    showTimestamp: true,
  },
  style: {
    opacity: 0.15,
    fontSize: 14,
    color: '#000000',
    rotation: -30,
  },
  antiScreenshot: true,
};

// ============================================================================
// WATERMARK TEXT GENERATOR
// ============================================================================

function generateWatermarkText(content: WatermarkConfig['content']): string {
  const parts: string[] = [];

  if (content.userEmail) {
    parts.push(content.userEmail);
  }

  if (content.sessionId) {
    parts.push(`Session: ${content.sessionId.slice(0, 8)}`);
  }

  if (content.customText) {
    parts.push(content.customText);
  }

  return parts.join(' • ') || 'CONFIDENTIAL';
}

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// TILED WATERMARK
// ============================================================================

interface TiledWatermarkProps {
  text: string;
  timestamp?: string;
  style: WatermarkConfig['style'];
  offset: { x: number; y: number };
}

function TiledWatermark({ text, timestamp, style, offset }: TiledWatermarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Configure text style
    ctx.font = `${style.fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = style.color;
    ctx.globalAlpha = style.opacity;

    // Calculate text dimensions
    const fullText = timestamp ? `${text} | ${timestamp}` : text;
    const metrics = ctx.measureText(fullText);
    const textHeight = style.fontSize * 1.5;

    // Calculate spacing
    const spacingX = metrics.width + 100;
    const spacingY = textHeight + 80;

    // Draw tiled pattern with rotation
    ctx.save();

    // Apply rotation around center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((style.rotation || -30) * (Math.PI / 180));
    ctx.translate(-centerX, -centerY);

    // Draw tiles with offset for anti-screenshot
    const startX = -canvas.width + offset.x;
    const startY = -canvas.height + offset.y;
    const endX = canvas.width * 2;
    const endY = canvas.height * 2;

    for (let y = startY; y < endY; y += spacingY) {
      for (let x = startX; x < endX; x += spacingX) {
        ctx.fillText(fullText, x, y);
      }
    }

    ctx.restore();
  }, [text, timestamp, style, offset]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 select-none"
      style={{ mixBlendMode: 'multiply' }}
    />
  );
}

// ============================================================================
// CORNER WATERMARK
// ============================================================================

interface CornerWatermarkProps {
  text: string;
  timestamp?: string;
  position: WatermarkPosition;
  style: WatermarkConfig['style'];
}

function CornerWatermark({ text, timestamp, position, style }: CornerWatermarkProps) {
  const positionClasses: Record<WatermarkPosition, string> = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <div
      className={cn('pointer-events-none absolute select-none', positionClasses[position])}
      style={{
        opacity: style.opacity,
        fontSize: style.fontSize,
        color: style.color,
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium">{text}</span>
        {timestamp && <span className="text-xs opacity-80">{timestamp}</span>}
      </div>
    </div>
  );
}

// ============================================================================
// CENTER WATERMARK
// ============================================================================

interface CenterWatermarkProps {
  text: string;
  timestamp?: string;
  style: WatermarkConfig['style'];
}

function CenterWatermark({ text, timestamp, style }: CenterWatermarkProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
      style={{
        opacity: style.opacity,
      }}
    >
      <div
        className="text-center"
        style={{
          fontSize: style.fontSize * 2,
          color: style.color,
          transform: `rotate(${style.rotation || -30}deg)`,
        }}
      >
        <div className="font-bold">{text}</div>
        {timestamp && <div className="mt-2 text-base opacity-80">{timestamp}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// DIAGONAL WATERMARK
// ============================================================================

interface DiagonalWatermarkProps {
  text: string;
  timestamp?: string;
  style: WatermarkConfig['style'];
  offset: number;
}

function DiagonalWatermark({ text, timestamp, style, offset }: DiagonalWatermarkProps) {
  const fullText = timestamp ? `${text} | ${timestamp}` : text;

  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div
        className="absolute whitespace-nowrap"
        style={{
          opacity: style.opacity,
          fontSize: style.fontSize,
          color: style.color,
          transform: `rotate(-45deg) translateX(${offset}px)`,
          top: '50%',
          left: '-50%',
          width: '200%',
        }}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="inline-block px-16">
            {fullText}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WatermarkOverlay({ config: userConfig, className }: WatermarkOverlayProps) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

  const [timestamp, setTimestamp] = useState<string>('');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [diagonalOffset, setDiagonalOffset] = useState(0);

  // Update timestamp every minute
  useEffect(() => {
    if (!config.content.showTimestamp) return undefined;

    const updateTimestamp = () => setTimestamp(formatTimestamp());
    updateTimestamp();

    const interval = setInterval(updateTimestamp, 60000);
    return () => clearInterval(interval);
  }, [config.content.showTimestamp]);

  // Anti-screenshot: randomize position periodically
  useEffect(() => {
    if (!config.antiScreenshot) return undefined;

    const randomizePosition = () => {
      setOffset({
        x: Math.random() * 50 - 25,
        y: Math.random() * 50 - 25,
      });
      setDiagonalOffset(Math.random() * 100 - 50);
    };

    // Randomize every 30 seconds
    const interval = setInterval(randomizePosition, 30000);
    return () => clearInterval(interval);
  }, [config.antiScreenshot]);

  // Generate watermark text
  const watermarkText = useMemo(() => generateWatermarkText(config.content), [config.content]);

  if (!config.enabled) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 z-40 overflow-hidden',
        'pointer-events-none select-none',
        className
      )}
    >
      {config.pattern === 'tiled' && (
        <TiledWatermark
          offset={offset}
          style={config.style}
          text={watermarkText}
          timestamp={config.content.showTimestamp ? timestamp : undefined}
        />
      )}

      {config.pattern === 'corner' && (
        <CornerWatermark
          position={config.position || 'bottom-right'}
          style={config.style}
          text={watermarkText}
          timestamp={config.content.showTimestamp ? timestamp : undefined}
        />
      )}

      {config.pattern === 'center' && (
        <CenterWatermark
          style={config.style}
          text={watermarkText}
          timestamp={config.content.showTimestamp ? timestamp : undefined}
        />
      )}

      {config.pattern === 'diagonal' && (
        <DiagonalWatermark
          offset={diagonalOffset}
          style={config.style}
          text={watermarkText}
          timestamp={config.content.showTimestamp ? timestamp : undefined}
        />
      )}
    </div>
  );
}
