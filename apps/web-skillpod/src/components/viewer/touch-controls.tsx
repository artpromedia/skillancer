/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, react-hooks/exhaustive-deps */
'use client';

/**
 * Touch Controls Component
 *
 * Mobile/tablet touch controls for VDI sessions:
 * - Gesture recognition (pinch zoom, pan, rotate)
 * - Virtual trackpad mode
 * - Touch-to-click mapping
 * - Multi-touch support
 */

import { cn } from '@skillancer/ui/lib/utils';
import { MousePointerClick, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type TouchMode = 'pointer' | 'trackpad' | 'gesture' | 'scroll';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

interface GestureState {
  type: 'none' | 'pan' | 'pinch' | 'rotate';
  scale: number;
  rotation: number;
  translateX: number;
  translateY: number;
}

export interface TouchControlsProps {
  mode?: TouchMode;
  onModeChange?: (mode: TouchMode) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerDown?: (x: number, y: number, button: 'left' | 'right') => void;
  onPointerUp?: () => void;
  onScroll?: (deltaX: number, deltaY: number) => void;
  onZoom?: (scale: number, centerX: number, centerY: number) => void;
  onGestureEnd?: (gesture: GestureState) => void;
  showOverlay?: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TouchControls({
  mode = 'pointer',
  onModeChange,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onScroll,
  onZoom,
  onGestureEnd,
  showOverlay = true,
  className,
}: Readonly<TouchControlsProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchesRef = useRef<Map<number, TouchPoint>>(new Map());
  const gestureRef = useRef<GestureState>({
    type: 'none',
    scale: 1,
    rotation: 0,
    translateX: 0,
    translateY: 0,
  });

  const [currentMode, setCurrentMode] = useState<TouchMode>(mode);
  const [touchCount, setTouchCount] = useState(0);
  const [showGestureHint, setShowGestureHint] = useState<string | null>(null);

  // Tap detection
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================================================
  // TOUCH HANDLERS
  // ==========================================================================

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    Array.from(e.changedTouches).forEach((touch) => {
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touchesRef.current.set(touch.identifier, {
        id: touch.identifier,
        x,
        y,
        startX: x,
        startY: y,
      });
    });

    setTouchCount(touchesRef.current.size);

    // Detect gesture type based on touch count
    if (touchesRef.current.size === 1) {
      gestureRef.current.type = 'pan';
    } else if (touchesRef.current.size === 2) {
      gestureRef.current.type = 'pinch';
      setShowGestureHint('Pinch to zoom');
    } else if (touchesRef.current.size >= 3) {
      gestureRef.current.type = 'rotate';
      setShowGestureHint('Three fingers to scroll');
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      Array.from(e.changedTouches).forEach((touch) => {
        const point = touchesRef.current.get(touch.identifier);
        if (point) {
          point.x = touch.clientX - rect.left;
          point.y = touch.clientY - rect.top;
        }
      });

      const touches = Array.from(touchesRef.current.values());

      if (touches.length === 1 && currentMode === 'pointer') {
        // Single finger - pointer movement
        const touch = touches[0];
        onPointerMove?.(touch.x, touch.y);
      } else if (touches.length === 1 && currentMode === 'trackpad') {
        // Trackpad mode - relative movement
        const touch = touches[0];
        const deltaX = touch.x - touch.startX;
        const deltaY = touch.y - touch.startY;

        // Apply sensitivity
        onPointerMove?.(deltaX * 2, deltaY * 2);
      } else if (touches.length === 2) {
        // Two fingers - pinch zoom
        const [t1, t2] = touches;

        // Calculate distance between fingers
        const currentDist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
        const startDist = Math.hypot(t2.startX - t1.startX, t2.startY - t1.startY);

        if (startDist > 0) {
          const scale = currentDist / startDist;
          gestureRef.current.scale = scale;

          // Calculate center point
          const centerX = (t1.x + t2.x) / 2;
          const centerY = (t1.y + t2.y) / 2;

          onZoom?.(scale, centerX, centerY);
        }
      } else if (touches.length >= 3) {
        // Three fingers - scroll
        const avgDeltaX = touches.reduce((sum, t) => sum + (t.x - t.startX), 0) / touches.length;
        const avgDeltaY = touches.reduce((sum, t) => sum + (t.y - t.startY), 0) / touches.length;

        onScroll?.(avgDeltaX, avgDeltaY);
      }
    },
    [currentMode, onPointerMove, onZoom, onScroll]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      Array.from(e.changedTouches).forEach((touch) => {
        const point = touchesRef.current.get(touch.identifier);

        if (point && touchesRef.current.size === 1) {
          // Check for tap
          const dx = touch.clientX - rect.left - point.startX;
          const dy = touch.clientY - rect.top - point.startY;
          const distance = Math.hypot(dx, dy);

          if (distance < 10) {
            handleTap(point.startX, point.startY);
          }
        }

        touchesRef.current.delete(touch.identifier);
      });

      setTouchCount(touchesRef.current.size);
      setShowGestureHint(null);

      if (touchesRef.current.size === 0) {
        onGestureEnd?.(gestureRef.current);
        gestureRef.current = {
          type: 'none',
          scale: 1,
          rotation: 0,
          translateX: 0,
          translateY: 0,
        };
        onPointerUp?.();
      }
    },
    [onGestureEnd, onPointerUp]
  );

  const handleTap = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      const lastTap = lastTapRef.current;

      // Double tap detection
      if (lastTap && now - lastTap.time < 300 && Math.hypot(x - lastTap.x, y - lastTap.y) < 20) {
        // Double tap - right click
        onPointerDown?.(x, y, 'right');

        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
        }

        lastTapRef.current = null;
        return;
      }

      // Single tap - wait to see if double tap
      lastTapRef.current = { time: now, x, y };

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }

      tapTimeoutRef.current = setTimeout(() => {
        // Single tap - left click
        onPointerDown?.(x, y, 'left');
        lastTapRef.current = null;
      }, 300);
    },
    [onPointerDown]
  );

  // ==========================================================================
  // MODE SWITCHING
  // ==========================================================================

  const cycleMode = useCallback(() => {
    const modes: TouchMode[] = ['pointer', 'trackpad', 'gesture', 'scroll'];
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    setCurrentMode(nextMode);
    onModeChange?.(nextMode);
  }, [currentMode, onModeChange]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const getModeIcon = () => {
    switch (currentMode) {
      case 'pointer':
        return <MousePointerClick className="h-5 w-5" />;
      case 'trackpad':
        return <Move className="h-5 w-5" />;
      case 'gesture':
        return <RotateCcw className="h-5 w-5" />;
      case 'scroll':
        return <ZoomIn className="h-5 w-5" />;
    }
  };

  const getModeLabel = () => {
    switch (currentMode) {
      case 'pointer':
        return 'Direct Touch';
      case 'trackpad':
        return 'Trackpad';
      case 'gesture':
        return 'Gesture';
      case 'scroll':
        return 'Scroll';
    }
  };

  return (
    <div ref={containerRef} className={cn('absolute inset-0 touch-none', className)}>
      {/* Touch overlay with gesture hints */}
      {showOverlay && (
        <>
          {/* Mode indicator */}
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 text-white">
            {getModeIcon()}
            <span className="text-sm">{getModeLabel()}</span>
            <button
              className="ml-2 rounded bg-white/20 px-2 py-1 text-xs hover:bg-white/30"
              onClick={cycleMode}
            >
              Switch
            </button>
          </div>

          {/* Touch count indicator */}
          {touchCount > 0 && (
            <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 text-white">
              <span className="text-sm">
                {touchCount} {touchCount === 1 ? 'finger' : 'fingers'}
              </span>
            </div>
          )}

          {/* Gesture hint */}
          {showGestureHint && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 transform rounded-lg bg-black/70 px-4 py-2 text-white">
              {showGestureHint}
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-20 right-4 flex flex-col gap-2">
            <button
              className="rounded-full bg-black/50 p-3 text-white hover:bg-black/70"
              onClick={() => onZoom?.(1.2, window.innerWidth / 2, window.innerHeight / 2)}
            >
              <ZoomIn className="h-6 w-6" />
            </button>
            <button
              className="rounded-full bg-black/50 p-3 text-white hover:bg-black/70"
              onClick={() => onZoom?.(0.8, window.innerWidth / 2, window.innerHeight / 2)}
            >
              <ZoomOut className="h-6 w-6" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
