'use client';

import { cn } from '@skillancer/ui';
import {
  Camera,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Monitor,
  Shield,
} from 'lucide-react';
import { useState } from 'react';

interface ProctoringStatusProps {
  readonly cameraEnabled: boolean;
  readonly screenShareEnabled: boolean;
  readonly fullscreenActive: boolean;
  readonly connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  readonly confidenceScore?: number; // 0-100
  readonly violations?: {
    readonly type: string;
    readonly timestamp: Date;
    readonly severity: 'warning' | 'critical';
  }[];
  readonly compact?: boolean;
  readonly onCameraToggle?: () => void;
  readonly onScreenShareToggle?: () => void;
}

export function ProctoringStatus({
  cameraEnabled,
  screenShareEnabled,
  fullscreenActive,
  connectionStatus,
  confidenceScore = 100,
  violations = [],
  compact = false,
  onCameraToggle: _onCameraToggle,
  onScreenShareToggle: _onScreenShareToggle,
}: ProctoringStatusProps) {
  const [showViolations, setShowViolations] = useState(false);

  const recentViolations = violations.slice(-3);
  const hasWarnings = violations.some((v) => v.severity === 'warning');
  const hasCritical = violations.some((v) => v.severity === 'critical');

  const getOverallStatus = (): 'critical' | 'warning' | 'issue' | 'good' => {
    if (hasCritical) return 'critical';
    if (hasWarnings) return 'warning';
    if (!cameraEnabled || !screenShareEnabled || connectionStatus !== 'connected') return 'issue';
    return 'good';
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'good':
        return 'Secure';
      case 'critical':
        return 'Issue';
      default:
        return 'Check';
    }
  };

  const getConnectionIcon = () => {
    if (connectionStatus === 'connected') {
      return <Wifi className="h-4 w-4 text-green-600" />;
    }
    if (connectionStatus === 'reconnecting') {
      return <Wifi className="h-4 w-4 animate-pulse text-amber-500" />;
    }
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getConfidenceBarClass = (score: number): string => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const overallStatus = getOverallStatus();

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-amber-600 bg-amber-50';
      case 'issue':
        return 'text-amber-600 bg-amber-50';
      default:
        return 'text-green-600 bg-green-50';
    }
  };

  const getConfidenceColor = () => {
    if (confidenceScore >= 90) return 'text-green-600';
    if (confidenceScore >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  if (compact) {
    return (
      <div
        className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-sm', getStatusColor())}
      >
        <Shield className="h-4 w-4" />
        <span className="font-medium">{getStatusLabel(overallStatus)}</span>
        {!cameraEnabled && <Camera className="h-4 w-4 text-red-500" />}
        {connectionStatus !== 'connected' && <WifiOff className="h-4 w-4 text-red-500" />}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield
            className={cn(
              'h-5 w-5',
              overallStatus === 'good' ? 'text-green-600' : 'text-amber-600'
            )}
          />
          <h3 className="font-medium text-gray-900">Proctoring Status</h3>
        </div>
        <div className={cn('rounded-full px-2 py-1 text-xs font-medium', getStatusColor())}>
          {overallStatus === 'good' && 'All Good'}
          {overallStatus === 'warning' && 'Warning'}
          {overallStatus === 'critical' && 'Action Needed'}
          {overallStatus === 'issue' && 'Check Settings'}
        </div>
      </div>

      {/* Status Items */}
      <div className="space-y-3">
        {/* Camera Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className={cn('h-4 w-4', cameraEnabled ? 'text-green-600' : 'text-red-500')} />
            <span className="text-sm text-gray-700">Camera</span>
          </div>
          <div className="flex items-center gap-2">
            {cameraEnabled ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <XCircle className="h-3 w-3" />
                Off
              </span>
            )}
          </div>
        </div>

        {/* Screen Share Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor
              className={cn('h-4 w-4', screenShareEnabled ? 'text-green-600' : 'text-gray-400')}
            />
            <span className="text-sm text-gray-700">Screen Share</span>
          </div>
          <div className="flex items-center gap-2">
            {screenShareEnabled ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Sharing
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <XCircle className="h-3 w-3" />
                Not sharing
              </span>
            )}
          </div>
        </div>

        {/* Fullscreen Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye
              className={cn('h-4 w-4', fullscreenActive ? 'text-green-600' : 'text-amber-500')}
            />
            <span className="text-sm text-gray-700">Fullscreen</span>
          </div>
          <div className="flex items-center gap-2">
            {fullscreenActive ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                Exit detected
              </span>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getConnectionIcon()}
            <span className="text-sm text-gray-700">Connection</span>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Stable
              </span>
            )}
            {connectionStatus === 'reconnecting' && (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                Reconnecting...
              </span>
            )}
            {connectionStatus === 'disconnected' && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <XCircle className="h-3 w-3" />
                Lost
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confidence Score */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-600">Session Confidence</span>
          <span className={cn('text-sm font-semibold', getConfidenceColor())}>
            {confidenceScore}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn('h-full transition-all', getConfidenceBarClass(confidenceScore))}
            style={{ width: `${confidenceScore}%` }}
          />
        </div>
      </div>

      {/* Recent Violations */}
      {recentViolations.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            className="flex w-full items-center justify-between text-sm"
            onClick={() => setShowViolations(!showViolations)}
          >
            <span className="font-medium text-amber-600">
              {violations.length} violation{violations.length === 1 ? '' : 's'} detected
            </span>
            <span className="text-gray-400">{showViolations ? '▲' : '▼'}</span>
          </button>

          {showViolations && (
            <div className="mt-2 space-y-2">
              {recentViolations.map((v) => (
                <div
                  key={`${v.type}-${v.timestamp.getTime()}`}
                  className={cn(
                    'flex items-start gap-2 rounded p-2 text-xs',
                    v.severity === 'critical'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <div>
                    <p className="font-medium">{v.type}</p>
                    <p className="text-gray-500">{v.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mini status indicator for header
export function ProctoringIndicator({ status }: { readonly status: 'good' | 'warning' | 'error' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        status === 'good' && 'bg-green-100 text-green-700',
        status === 'warning' && 'bg-amber-100 text-amber-700',
        status === 'error' && 'bg-red-100 text-red-700'
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'good' && 'bg-green-500',
          status === 'warning' && 'animate-pulse bg-amber-500',
          status === 'error' && 'animate-pulse bg-red-500'
        )}
      />
      {status === 'good' && 'Proctoring Active'}
      {status === 'warning' && 'Check Settings'}
      {status === 'error' && 'Issue Detected'}
    </div>
  );
}

export default ProctoringStatus;
