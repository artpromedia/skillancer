'use client';

import { cn } from '@skillancer/ui';
import { Clock, AlertTriangle, Pause } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AssessmentTimerProps {
  /** Total time in seconds */
  totalTime: number;
  /** Time remaining in seconds */
  timeRemaining: number;
  /** Callback when time changes */
  onTimeChange?: (remaining: number) => void;
  /** Callback when time runs out */
  onTimeUp?: () => void;
  /** Whether the timer is paused */
  isPaused?: boolean;
  /** Show warning when time is below this threshold (in seconds) */
  warningThreshold?: number;
  /** Show critical warning when time is below this threshold (in seconds) */
  criticalThreshold?: number;
  /** Compact display mode */
  compact?: boolean;
}

export function AssessmentTimer({
  totalTime,
  timeRemaining,
  onTimeChange: _onTimeChange,
  onTimeUp: _onTimeUp,
  isPaused = false,
  warningThreshold = 300, // 5 minutes
  criticalThreshold = 60, // 1 minute
  compact = false,
}: Readonly<AssessmentTimerProps>) {
  const [showPulse, setShowPulse] = useState(false);

  // Determine status
  const isCritical = timeRemaining <= criticalThreshold;
  const isWarning = timeRemaining <= warningThreshold && !isCritical;
  const isNormal = !isWarning && !isCritical;

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = (timeRemaining / totalTime) * 100;

  // Pulse effect for critical time
  useEffect(() => {
    if (isCritical && !isPaused) {
      const pulseInterval = setInterval(() => {
        setShowPulse((prev) => !prev);
      }, 500);
      return () => clearInterval(pulseInterval);
    }
    setShowPulse(false);
  }, [isCritical, isPaused]);

  // Color based on status
  const getStatusColor = () => {
    if (isCritical) return 'text-red-600';
    if (isWarning) return 'text-amber-600';
    return 'text-gray-900';
  };

  const getBgColor = () => {
    if (isCritical) return 'bg-red-100';
    if (isWarning) return 'bg-amber-100';
    return 'bg-gray-100';
  };

  const getProgressColor = () => {
    if (isCritical) return 'bg-red-500';
    if (isWarning) return 'bg-amber-500';
    return 'bg-indigo-500';
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-full px-3 py-1.5',
          getBgColor(),
          showPulse && 'animate-pulse'
        )}
      >
        {isPaused ? (
          <Pause className={cn('h-4 w-4', getStatusColor())} />
        ) : (
          <Clock className={cn('h-4 w-4', getStatusColor())} />
        )}
        <span className={cn('font-mono text-sm font-semibold', getStatusColor())}>
          {formatTime(timeRemaining)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg p-4',
        getBgColor(),
        showPulse && 'ring-2 ring-red-500 ring-offset-2'
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Pause className={cn('h-5 w-5', getStatusColor())} />
          ) : (
            <Clock className={cn('h-5 w-5', getStatusColor())} />
          )}
          <span className="text-sm font-medium text-gray-600">Time Remaining</span>
        </div>
        {isCritical && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Low Time!</span>
          </div>
        )}
      </div>

      {/* Time Display */}
      <div className={cn('mb-3 font-mono text-3xl font-bold', getStatusColor())}>
        {formatTime(timeRemaining)}
      </div>

      {/* Progress Bar */}
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn('h-full transition-all duration-1000', getProgressColor())}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status Message */}
      <div className="mt-2 text-xs text-gray-500">
        {isPaused && 'Timer paused'}
        {!isPaused && isNormal && `${Math.floor(progress)}% time remaining`}
        {!isPaused && isWarning && 'Less than 5 minutes remaining'}
        {!isPaused && isCritical && 'Less than 1 minute remaining!'}
      </div>
    </div>
  );
}

// Inline timer for header bar
export function InlineTimer({
  timeRemaining,
  criticalThreshold = 60,
}: Readonly<{
  timeRemaining: number;
  criticalThreshold?: number;
}>) {
  const isCritical = timeRemaining <= criticalThreshold;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1.5',
        isCritical ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-900'
      )}
    >
      <Clock className="h-4 w-4" />
      <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
    </div>
  );
}

export default AssessmentTimer;
