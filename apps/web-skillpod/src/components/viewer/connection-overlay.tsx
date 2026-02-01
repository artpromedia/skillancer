/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Connection Overlay Component
 *
 * Displays connection state with progress steps:
 * - Connecting: spinner with step progress
 * - Reconnecting: attempt counter with manual button
 * - Error: message with troubleshooting tips
 */

import { Button, cn, Progress } from '@skillancer/ui';
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

type ConnectionStep = 'authenticating' | 'provisioning' | 'establishing' | 'loading';

interface ConnectionOverlayProps {
  state: ConnectionState;
  error?: string;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CONNECTION_STEPS: { id: ConnectionStep; label: string; duration: number }[] = [
  { id: 'authenticating', label: 'Authenticating...', duration: 1500 },
  { id: 'provisioning', label: 'Provisioning resources...', duration: 2500 },
  { id: 'establishing', label: 'Establishing connection...', duration: 2000 },
  { id: 'loading', label: 'Loading desktop...', duration: 1500 },
];

const TROUBLESHOOTING_TIPS = [
  'Check your internet connection',
  'Try refreshing the page',
  'Disable VPN if enabled',
  'Clear browser cache and cookies',
  'Try a different browser',
];

// ============================================================================
// CONNECTING STATE
// ============================================================================

// Helper to create interval handler for step progress
function createStepProgressHandler(
  step: { duration: number },
  startTime: number,
  currentStep: number,
  setStepProgress: (value: number) => void,
  setCurrentStep: (updater: (prev: number) => number) => void,
  clearIntervalFn: () => void
) {
  return () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min((elapsed / step.duration) * 100, 100);
    setStepProgress(progress);

    if (progress >= 100) {
      clearIntervalFn();
      if (currentStep < CONNECTION_STEPS.length - 1) {
        setTimeout(() => {
          setCurrentStep((prev) => prev + 1);
          setStepProgress(0);
        }, 200);
      }
    }
  };
}

function ConnectingState() {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);

  useEffect(() => {
    if (currentStep >= CONNECTION_STEPS.length) return undefined;

    const step = CONNECTION_STEPS[currentStep];
    const startTime = Date.now();
    let interval: NodeJS.Timeout;
    const handler = createStepProgressHandler(
      step,
      startTime,
      currentStep,
      setStepProgress,
      setCurrentStep,
      () => clearInterval(interval)
    );
    interval = setInterval(handler, 50);

    return () => clearInterval(interval);
  }, [currentStep]);

  const overallProgress =
    (currentStep / CONNECTION_STEPS.length) * 100 + stepProgress / CONNECTION_STEPS.length;

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Animated spinner */}
      <div className="relative">
        <div className="border-muted h-24 w-24 animate-pulse rounded-full border-4" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-primary h-12 w-12 animate-spin" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-foreground mb-2 text-2xl font-semibold">
          Connecting to Secure Workspace
        </h2>
        <p className="text-muted-foreground">Please wait while we prepare your session...</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md">
        <Progress className="h-2" value={overallProgress} />
      </div>

      {/* Steps */}
      <div className="w-full max-w-md space-y-3">
        {CONNECTION_STEPS.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 rounded-lg p-3 transition-colors',
                isComplete && 'bg-green-500/10',
                isCurrent && 'bg-primary/10',
                isPending && 'opacity-50'
              )}
            >
              <div className="flex-shrink-0">
                {(() => {
                  if (isComplete) return <CheckCircle className="h-5 w-5 text-green-500" />;
                  if (isCurrent) return <Loader2 className="text-primary h-5 w-5 animate-spin" />;
                  return <div className="border-muted h-5 w-5 rounded-full border-2" />;
                })()}
              </div>
              <span
                className={cn(
                  'text-sm',
                  isComplete && 'text-green-600',
                  isCurrent && 'text-foreground font-medium',
                  isPending && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Security note */}
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Shield className="h-4 w-4" />
        <span>Secured with enterprise-grade encryption</span>
      </div>
    </div>
  );
}

// ============================================================================
// RECONNECTING STATE
// ============================================================================

interface ReconnectingStateProps {
  attempt: number;
  maxAttempts: number;
  onRetry?: () => void;
  onCancel?: () => void;
}

function ReconnectingState({
  attempt,
  maxAttempts,
  onRetry,
  onCancel,
}: Readonly<ReconnectingStateProps>) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      onRetry?.();
      return undefined;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onRetry]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Animated icon */}
      <div className="relative">
        <WifiOff className="h-16 w-16 animate-pulse text-yellow-500" />
        <div className="absolute -right-1 -top-1">
          <RefreshCw className="text-primary h-6 w-6 animate-spin" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-foreground mb-2 text-xl font-semibold">Connection Lost</h2>
        <p className="text-muted-foreground">Attempting to reconnect...</p>
      </div>

      {/* Attempt counter */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Attempt {attempt} of {maxAttempts}
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="text-primary font-medium">Retrying in {countdown}s</span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {Array.from({ length: maxAttempts }).map((_, i) => (
          <div
            key={`reconnect-attempt-${i + 1}`}
            className={cn(
              'h-3 w-3 rounded-full transition-colors',
              i < attempt ? 'bg-yellow-500' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reconnect Now
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

interface ErrorStateProps {
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

function ErrorState({ error, onRetry, onCancel }: Readonly<ErrorStateProps>) {
  const [showTips, setShowTips] = useState(false);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Error icon */}
      <div className="bg-destructive/10 flex h-20 w-20 items-center justify-center rounded-full">
        <AlertCircle className="text-destructive h-10 w-10" />
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-foreground mb-2 text-xl font-semibold">Connection Failed</h2>
        <p className="text-muted-foreground max-w-md">
          {error || 'Unable to establish a connection to the secure workspace.'}
        </p>
      </div>

      {/* Troubleshooting */}
      <div className="w-full max-w-md">
        <button
          className="text-primary flex w-full items-center justify-center gap-2 text-sm hover:underline"
          onClick={() => setShowTips(!showTips)}
        >
          <HelpCircle className="h-4 w-4" />
          {showTips ? 'Hide troubleshooting tips' : 'Show troubleshooting tips'}
        </button>

        {showTips && (
          <div className="bg-muted/50 mt-4 rounded-lg p-4">
            <ul className="text-muted-foreground space-y-2 text-sm">
              {TROUBLESHOOTING_TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
        <Button onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>

      {/* Support link */}
      <a className="text-muted-foreground hover:text-primary text-sm" href="/support">
        Contact Support
      </a>
    </div>
  );
}

// ============================================================================
// DISCONNECTED STATE
// ============================================================================

interface DisconnectedStateProps {
  onRetry?: () => void;
  onCancel?: () => void;
}

function DisconnectedState({ onRetry, onCancel }: Readonly<DisconnectedStateProps>) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
        <Wifi className="text-muted-foreground h-10 w-10" />
      </div>

      <div className="text-center">
        <h2 className="text-foreground mb-2 text-xl font-semibold">Session Disconnected</h2>
        <p className="text-muted-foreground">Your session has ended or was disconnected.</p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel}>
          Exit
        </Button>
        <Button onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reconnect
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ConnectionOverlay({
  state,
  error,
  reconnectAttempt = 1,
  maxReconnectAttempts = 5,
  onRetry,
  onCancel,
  className,
}: Readonly<ConnectionOverlayProps>) {
  if (state === 'connected') {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-background/95 backdrop-blur-sm',
        className
      )}
    >
      <div className="w-full max-w-lg p-8">
        {state === 'connecting' && <ConnectingState />}

        {state === 'reconnecting' && (
          <ReconnectingState
            attempt={reconnectAttempt}
            maxAttempts={maxReconnectAttempts}
            onCancel={onCancel}
            onRetry={onRetry}
          />
        )}

        {state === 'error' && <ErrorState error={error} onCancel={onCancel} onRetry={onRetry} />}

        {state === 'disconnected' && <DisconnectedState onCancel={onCancel} onRetry={onRetry} />}
      </div>
    </div>
  );
}
