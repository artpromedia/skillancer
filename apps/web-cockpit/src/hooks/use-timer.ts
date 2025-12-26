/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * useTimer Hook
 *
 * Custom hook for managing timer state with localStorage persistence,
 * cross-tab synchronization, and real-time updates.
 *
 * @module hooks/use-timer
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TimerProject {
  id: string;
  name: string;
  color: string;
  clientName?: string;
}

export interface ActiveTimer {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  description: string;
  taskId?: string;
  taskName?: string;
  startTime: number; // timestamp
  pausedAt?: number; // timestamp when paused
  pausedDuration: number; // total paused milliseconds
  isPaused: boolean;
  tags?: string[];
  billable?: boolean;
}

export interface TimerEntry {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  description: string;
  taskId?: string;
  taskName?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  tags?: string[];
  billable?: boolean;
}

export interface UseTimerOptions {
  onTimerStart?: (timer: ActiveTimer) => void;
  onTimerStop?: (entry: TimerEntry) => void;
  onTimerPause?: (timer: ActiveTimer) => void;
  onTimerResume?: (timer: ActiveTimer) => void;
  storageKey?: string;
  broadcastChannel?: string;
}

export interface UseTimerReturn {
  activeTimer: ActiveTimer | null;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  elapsedTime: {
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  };
  startTimer: (options: StartTimerOptions) => void;
  stopTimer: () => TimerEntry | null;
  pauseTimer: () => void;
  resumeTimer: () => void;
  discardTimer: () => void;
  updateDescription: (description: string) => void;
  updateProject: (project: TimerProject) => void;
}

export interface StartTimerOptions {
  project: TimerProject;
  description?: string;
  taskId?: string;
  taskName?: string;
  tags?: string[];
  billable?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STORAGE_KEY = 'activeTimer';
const DEFAULT_BROADCAST_CHANNEL = 'timer-sync';

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `timer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(hours: number, minutes: number, seconds: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function timestampToTimeString(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

function timestampToDateString(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[0];
}

// ============================================================================
// useTimer Hook
// ============================================================================

export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
  const {
    onTimerStart,
    onTimerStop,
    onTimerPause,
    onTimerResume,
    storageKey = DEFAULT_STORAGE_KEY,
    broadcastChannel = DEFAULT_BROADCAST_CHANNEL,
  } = options;

  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize BroadcastChannel for cross-tab sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastRef.current = new BroadcastChannel(broadcastChannel);

      broadcastRef.current.onmessage = (event) => {
        const { type, timer } = event.data;

        switch (type) {
          case 'TIMER_STARTED':
          case 'TIMER_UPDATED':
            setActiveTimer(timer);
            break;
          case 'TIMER_STOPPED':
          case 'TIMER_DISCARDED':
            setActiveTimer(null);
            setElapsedSeconds(0);
            break;
          case 'TIMER_PAUSED':
          case 'TIMER_RESUMED':
            setActiveTimer(timer);
            break;
        }
      };

      return () => {
        broadcastRef.current?.close();
      };
    }
  }, [broadcastChannel]);

  // Load timer from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const timer = JSON.parse(stored) as ActiveTimer;
        setActiveTimer(timer);
      } catch (e) {
        console.error('Failed to parse stored timer:', e);
        localStorage.removeItem(storageKey);
      }
    }

    // Listen for storage changes from other tabs (fallback for BroadcastChannel)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        if (e.newValue) {
          try {
            const timer = JSON.parse(e.newValue) as ActiveTimer;
            setActiveTimer(timer);
          } catch (err) {
            console.error('Failed to parse timer from storage event:', err);
          }
        } else {
          setActiveTimer(null);
          setElapsedSeconds(0);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  // Update elapsed time
  useEffect(() => {
    if (!activeTimer) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      if (activeTimer.isPaused) {
        const pausedAt = activeTimer.pausedAt || Date.now();
        const active = pausedAt - activeTimer.startTime - activeTimer.pausedDuration;
        setElapsedSeconds(Math.floor(active / 1000));
      } else {
        const active = Date.now() - activeTimer.startTime - activeTimer.pausedDuration;
        setElapsedSeconds(Math.floor(active / 1000));
      }
    };

    updateElapsed();
    intervalRef.current = setInterval(updateElapsed, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeTimer]);

  // Calculate elapsed time components
  const elapsedTime = {
    hours: Math.floor(elapsedSeconds / 3600),
    minutes: Math.floor((elapsedSeconds % 3600) / 60),
    seconds: elapsedSeconds % 60,
    formatted: formatTime(
      Math.floor(elapsedSeconds / 3600),
      Math.floor((elapsedSeconds % 3600) / 60),
      elapsedSeconds % 60
    ),
  };

  // Broadcast timer state to other tabs
  const broadcastState = useCallback((type: string, timer: ActiveTimer | null) => {
    broadcastRef.current?.postMessage({ type, timer });
  }, []);

  // Start timer
  const startTimer = useCallback(
    (startOptions: StartTimerOptions) => {
      const timer: ActiveTimer = {
        id: generateId(),
        projectId: startOptions.project.id,
        projectName: startOptions.project.name,
        projectColor: startOptions.project.color,
        description: startOptions.description || '',
        taskId: startOptions.taskId,
        taskName: startOptions.taskName,
        startTime: Date.now(),
        pausedDuration: 0,
        isPaused: false,
        tags: startOptions.tags,
        billable: startOptions.billable ?? true,
      };

      setActiveTimer(timer);
      localStorage.setItem(storageKey, JSON.stringify(timer));
      broadcastState('TIMER_STARTED', timer);
      onTimerStart?.(timer);
    },
    [storageKey, broadcastState, onTimerStart]
  );

  // Stop timer and create entry
  const stopTimer = useCallback((): TimerEntry | null => {
    if (!activeTimer) return null;

    const endTime = Date.now();
    let activeDuration: number;

    if (activeTimer.isPaused && activeTimer.pausedAt) {
      activeDuration = activeTimer.pausedAt - activeTimer.startTime - activeTimer.pausedDuration;
    } else {
      activeDuration = endTime - activeTimer.startTime - activeTimer.pausedDuration;
    }

    const durationMinutes = Math.round(activeDuration / 60000);

    const entry: TimerEntry = {
      id: generateId(),
      projectId: activeTimer.projectId,
      projectName: activeTimer.projectName,
      projectColor: activeTimer.projectColor,
      description: activeTimer.description,
      taskId: activeTimer.taskId,
      taskName: activeTimer.taskName,
      date: timestampToDateString(activeTimer.startTime),
      startTime: timestampToTimeString(activeTimer.startTime),
      endTime: timestampToTimeString(activeTimer.isPaused ? activeTimer.pausedAt! : endTime),
      duration: durationMinutes,
      tags: activeTimer.tags,
      billable: activeTimer.billable,
    };

    setActiveTimer(null);
    setElapsedSeconds(0);
    localStorage.removeItem(storageKey);
    broadcastState('TIMER_STOPPED', null);
    onTimerStop?.(entry);

    return entry;
  }, [activeTimer, storageKey, broadcastState, onTimerStop]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (!activeTimer || activeTimer.isPaused) return;

    const updated: ActiveTimer = {
      ...activeTimer,
      isPaused: true,
      pausedAt: Date.now(),
    };

    setActiveTimer(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    broadcastState('TIMER_PAUSED', updated);
    onTimerPause?.(updated);
  }, [activeTimer, storageKey, broadcastState, onTimerPause]);

  // Resume timer
  const resumeTimer = useCallback(() => {
    if (!activeTimer || !activeTimer.isPaused) return;

    const pausedAt = activeTimer.pausedAt || Date.now();
    const additionalPaused = Date.now() - pausedAt;

    const updated: ActiveTimer = {
      ...activeTimer,
      isPaused: false,
      pausedAt: undefined,
      pausedDuration: activeTimer.pausedDuration + additionalPaused,
    };

    setActiveTimer(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    broadcastState('TIMER_RESUMED', updated);
    onTimerResume?.(updated);
  }, [activeTimer, storageKey, broadcastState, onTimerResume]);

  // Discard timer without saving
  const discardTimer = useCallback(() => {
    setActiveTimer(null);
    setElapsedSeconds(0);
    localStorage.removeItem(storageKey);
    broadcastState('TIMER_DISCARDED', null);
  }, [storageKey, broadcastState]);

  // Update timer description
  const updateDescription = useCallback(
    (description: string) => {
      if (!activeTimer) return;

      const updated = { ...activeTimer, description };
      setActiveTimer(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      broadcastState('TIMER_UPDATED', updated);
    },
    [activeTimer, storageKey, broadcastState]
  );

  // Update timer project
  const updateProject = useCallback(
    (project: TimerProject) => {
      if (!activeTimer) return;

      const updated = {
        ...activeTimer,
        projectId: project.id,
        projectName: project.name,
        projectColor: project.color,
      };
      setActiveTimer(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      broadcastState('TIMER_UPDATED', updated);
    },
    [activeTimer, storageKey, broadcastState]
  );

  return {
    activeTimer,
    isRunning: activeTimer !== null && !activeTimer.isPaused,
    isPaused: activeTimer?.isPaused ?? false,
    elapsedSeconds,
    elapsedTime,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    discardTimer,
    updateDescription,
    updateProject,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useTimer;
