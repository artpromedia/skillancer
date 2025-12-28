/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Timer Widget Component
 *
 * Compact timer widget for the header and sidebar.
 * Shows elapsed time, project info, and quick controls.
 *
 * @module components/time/timer-widget
 */

import { Timer, Play, Pause, Square, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ActiveTimer {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  description: string;
  startTime: Date;
  isPaused?: boolean;
  pausedDuration?: number; // milliseconds
  pausedAt?: number; // timestamp when paused
}

/** Shape of timer data stored in localStorage (startTime is serialized as string) */
interface StoredTimer extends Omit<ActiveTimer, 'startTime'> {
  startTime: string;
}

export interface TimerWidgetProps {
  variant?: 'compact' | 'expanded';
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  className?: string;
}

// ============================================================================
// Timer Widget Component
// ============================================================================

export function TimerWidget({
  variant = 'compact',
  onStart,
  onPause,
  onResume,
  onStop,
  className = '',
}: TimerWidgetProps) {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Load active timer from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('activeTimer');
    if (stored) {
      try {
        const timer = JSON.parse(stored) as StoredTimer;
        setActiveTimer({
          ...timer,
          startTime: new Date(timer.startTime),
        });
      } catch (e) {
        console.error('Failed to parse active timer:', e);
      }
    }

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'activeTimer') {
        if (e.newValue) {
          const timer = JSON.parse(e.newValue) as StoredTimer;
          setActiveTimer({
            ...timer,
            startTime: new Date(timer.startTime),
          });
        } else {
          setActiveTimer(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) {
      return;
    }

    const updateElapsed = () => {
      const now = Date.now();
      const start = activeTimer.startTime.getTime();
      const paused = activeTimer.pausedDuration || 0;
      setElapsedSeconds(Math.floor((now - start - paused) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Format time display
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0'),
    };
  };

  const time = formatTime(elapsedSeconds);

  // Handle actions
  const handlePause = () => {
    if (activeTimer) {
      const updated = {
        ...activeTimer,
        isPaused: true,
        pausedAt: Date.now(),
      };
      localStorage.setItem('activeTimer', JSON.stringify(updated));
      setActiveTimer({ ...activeTimer, isPaused: true });
      onPause?.();
    }
  };

  const handleResume = () => {
    if (activeTimer) {
      const pausedAt = activeTimer.pausedAt ?? Date.now();
      const additionalPaused = Date.now() - pausedAt;
      const updated = {
        ...activeTimer,
        isPaused: false,
        pausedDuration: (activeTimer.pausedDuration || 0) + additionalPaused,
      };
      localStorage.setItem('activeTimer', JSON.stringify(updated));
      setActiveTimer({
        ...activeTimer,
        isPaused: false,
        pausedDuration: updated.pausedDuration,
      });
      onResume?.();
    }
  };

  const handleStop = () => {
    // The parent component should handle creating the time entry
    localStorage.removeItem('activeTimer');
    setActiveTimer(null);
    setElapsedSeconds(0);
    onStop?.();
  };

  // Compact variant (for header)
  if (variant === 'compact') {
    if (!activeTimer) {
      return (
        <Link
          className={`flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 ${className}`}
          href="/time?action=start"
        >
          <Timer className="h-4 w-4" />
          <span className="hidden sm:inline">Start Timer</span>
        </Link>
      );
    }

    return (
      <div className={`relative ${className}`}>
        <button
          className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="relative">
            <Timer className="h-4 w-4" />
            {!activeTimer.isPaused && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-green-500" />
            )}
          </div>
          <span className="font-mono text-sm font-medium">
            {time.hours}:{time.minutes}:{time.seconds}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>

        {isDropdownOpen && (
          <>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              aria-hidden="true"
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: activeTimer.projectColor }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {activeTimer.projectName}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {activeTimer.description || 'No description'}
                </p>
              </div>

              <div className="mb-4 text-center">
                <span className="font-mono text-3xl font-bold text-gray-900 dark:text-white">
                  {time.hours}:{time.minutes}:{time.seconds}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2">
                {activeTimer.isPaused ? (
                  <button
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    onClick={handleResume}
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </button>
                ) : (
                  <button
                    className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
                    onClick={handlePause}
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </button>
                )}
                <button
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  onClick={handleStop}
                >
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              </div>

              <Link
                className="mt-4 block text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
                href="/time"
                onClick={() => setIsDropdownOpen(false)}
              >
                View Time Tracking →
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  // Expanded variant
  if (!activeTimer) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 ${className}`}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <Timer className="h-8 w-8 text-gray-400" />
          </div>
          <p className="mb-4 text-gray-500 dark:text-gray-400">No timer running</p>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700"
            onClick={onStart}
          >
            <Play className="h-5 w-5" />
            Start Timer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: activeTimer.projectColor }}
        />
        <span className="font-medium text-gray-900 dark:text-white">{activeTimer.projectName}</span>
        {!activeTimer.isPaused && (
          <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-green-500" />
        )}
      </div>

      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {activeTimer.description || 'No description'}
      </p>

      <div className="mb-6 text-center">
        <span className="font-mono text-5xl font-bold text-gray-900 dark:text-white">
          {time.hours}:{time.minutes}
        </span>
        <span className="font-mono text-2xl text-gray-400">:{time.seconds}</span>
      </div>

      <div className="flex items-center justify-center gap-3">
        {activeTimer.isPaused ? (
          <button
            className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700"
            onClick={handleResume}
          >
            <Play className="h-6 w-6" />
          </button>
        ) : (
          <button
            className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500 text-white hover:bg-yellow-600"
            onClick={handlePause}
          >
            <Pause className="h-6 w-6" />
          </button>
        )}
        <button
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
          onClick={handleStop}
        >
          <Square className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default TimerWidget;
