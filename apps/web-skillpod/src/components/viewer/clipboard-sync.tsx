/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Clipboard Sync Component
 *
 * Clipboard synchronization UI:
 * - Sync indicator in toolbar
 * - Manual sync buttons
 * - Clipboard preview (if logging enabled)
 * - Policy explanation tooltip
 */

import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clipboard,
  ClipboardCheck,
  ClipboardX,
  Eye,
  EyeOff,
  Lock,
  Loader2,
} from 'lucide-react';
import { useCallback, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ClipboardSyncStatus = 'synced' | 'blocked' | 'pending' | 'disabled';
export type ClipboardDirection = 'local-to-remote' | 'remote-to-local' | 'both' | 'none';

export interface ClipboardPolicy {
  direction: ClipboardDirection;
  autoSync: boolean;
  logging: boolean;
  maxSize: number;
  allowedTypes: string[];
}

interface ClipboardSyncProps {
  status: ClipboardSyncStatus;
  policy: ClipboardPolicy;
  lastContent?: string;
  onPasteToRemote: () => Promise<void>;
  onCopyFromRemote: () => Promise<void>;
  className?: string;
}

interface ClipboardSyncIndicatorProps {
  status: ClipboardSyncStatus;
  policy: ClipboardPolicy;
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// STATUS INDICATOR
// ============================================================================

export function ClipboardSyncIndicator({
  status,
  policy,
  onClick,
  className,
}: Readonly<ClipboardSyncIndicatorProps>) {
  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
        return {
          icon: ClipboardCheck,
          color: 'text-green-500',
          label: 'Clipboard synced',
        };
      case 'blocked':
        return {
          icon: ClipboardX,
          color: 'text-red-500',
          label: 'Clipboard blocked',
        };
      case 'pending':
        return {
          icon: Clipboard,
          color: 'text-yellow-500',
          label: 'Sync pending',
        };
      case 'disabled':
        return {
          icon: ClipboardX,
          color: 'text-muted-foreground',
          label: 'Clipboard disabled',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn('rounded-lg p-2 transition-colors', 'hover:bg-accent', className)}
            onClick={onClick}
          >
            <Icon className={cn('h-5 w-5', config.color)} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
          {policy.direction !== 'both' && (
            <p className="text-muted-foreground mt-1 text-xs">
              {policy.direction === 'local-to-remote' && 'Paste only'}
              {policy.direction === 'remote-to-local' && 'Copy only'}
              {policy.direction === 'none' && 'No clipboard access'}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ClipboardSync({
  status,
  policy,
  lastContent,
  onPasteToRemote,
  onCopyFromRemote,
  className,
}: Readonly<ClipboardSyncProps>) {
  const [isPasting, setIsPasting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastAction, setLastAction] = useState<'paste' | 'copy' | null>(null);

  const handlePaste = useCallback(async () => {
    if (policy.direction === 'remote-to-local' || policy.direction === 'none') return;

    setIsPasting(true);
    try {
      await onPasteToRemote();
      setLastAction('paste');
      setTimeout(() => setLastAction(null), 2000);
    } finally {
      setIsPasting(false);
    }
  }, [policy.direction, onPasteToRemote]);

  const handleCopy = useCallback(async () => {
    if (policy.direction === 'local-to-remote' || policy.direction === 'none') return;

    setIsCopying(true);
    try {
      await onCopyFromRemote();
      setLastAction('copy');
      setTimeout(() => setLastAction(null), 2000);
    } finally {
      setIsCopying(false);
    }
  }, [policy.direction, onCopyFromRemote]);

  const canPaste = policy.direction === 'both' || policy.direction === 'local-to-remote';
  const canCopy = policy.direction === 'both' || policy.direction === 'remote-to-local';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn('hover:bg-accent rounded-lg p-2 transition-colors', className)}>
          {(() => {
            if (status === 'synced') return <ClipboardCheck className="h-5 w-5 text-green-500" />;
            if (status === 'blocked') return <ClipboardX className="h-5 w-5 text-red-500" />;
            return <Clipboard className="text-muted-foreground h-5 w-5" />;
          })()}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Clipboard Sync</h4>
            <div className="flex items-center gap-1">
              {status === 'synced' && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <Check className="h-3 w-3" />
                  Synced
                </span>
              )}
              {status === 'blocked' && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <Lock className="h-3 w-3" />
                  Blocked
                </span>
              )}
            </div>
          </div>

          {/* Policy info */}
          <div className="bg-muted/50 text-muted-foreground rounded-lg p-3 text-xs">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Policy Settings</span>
            </div>
            <ul className="space-y-1">
              <li>
                • Direction:{' '}
                {(() => {
                  if (policy.direction === 'both') return 'Bidirectional';
                  if (policy.direction === 'local-to-remote') return 'Local → Remote only';
                  if (policy.direction === 'remote-to-local') return 'Remote → Local only';
                  return 'Disabled';
                })()}
              </li>
              <li>• Auto-sync: {policy.autoSync ? 'Enabled' : 'Manual'}</li>
              {policy.logging && <li>• Content logging enabled</li>}
              <li>• Max size: {(policy.maxSize / 1024).toFixed(0)} KB</li>
            </ul>
          </div>

          {/* Manual sync buttons */}
          {!policy.autoSync && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!canPaste || isPasting}
                size="sm"
                variant="outline"
                onClick={handlePaste}
              >
                {(() => {
                  if (isPasting) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
                  if (lastAction === 'paste')
                    return <Check className="mr-2 h-4 w-4 text-green-500" />;
                  return <ArrowUpFromLine className="mr-2 h-4 w-4" />;
                })()}
                Paste to Remote
              </Button>
              <Button
                className="flex-1"
                disabled={!canCopy || isCopying}
                size="sm"
                variant="outline"
                onClick={handleCopy}
              >
                {(() => {
                  if (isCopying) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
                  if (lastAction === 'copy')
                    return <Check className="mr-2 h-4 w-4 text-green-500" />;
                  return <ArrowDownToLine className="mr-2 h-4 w-4" />;
                })()}
                Copy to Local
              </Button>
            </div>
          )}

          {/* Clipboard preview (if logging enabled) */}
          {policy.logging && lastContent && (
            <div className="overflow-hidden rounded-lg border">
              <button
                className="text-muted-foreground hover:bg-muted/50 flex w-full items-center justify-between p-2 text-xs"
                onClick={() => setShowPreview(!showPreview)}
              >
                <span>Last clipboard content</span>
                {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              {showPreview && (
                <div className="bg-muted/30 max-h-24 overflow-auto p-2 font-mono text-xs">
                  {lastContent.slice(0, 500)}
                  {lastContent.length > 500 && '...'}
                </div>
              )}
            </div>
          )}

          {/* Disabled message */}
          {policy.direction === 'none' && (
            <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg p-3 text-sm">
              <Lock className="h-4 w-4 flex-shrink-0" />
              <span>Clipboard access is disabled by security policy</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
