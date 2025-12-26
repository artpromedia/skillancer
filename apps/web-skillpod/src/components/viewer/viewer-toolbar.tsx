/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises, react-hooks/exhaustive-deps */
'use client';

/**
 * Viewer Toolbar Component
 *
 * Floating toolbar that auto-hides with:
 * - Fullscreen toggle
 * - Quality selector
 * - Audio/microphone controls
 * - Clipboard sync indicator
 * - File transfer button
 * - Session timer
 * - Connection quality indicator
 */

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  Clipboard,
  ClipboardX,
  FileUp,
  HelpCircle,
  Info,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Monitor,
  Power,
  Settings,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { QualityLevel } from './vdi-viewer';

// ============================================================================
// TYPES
// ============================================================================

type ClipboardState = 'synced' | 'blocked' | 'pending';

interface ViewerToolbarProps {
  isFullscreen: boolean;
  quality: QualityLevel;
  isAudioEnabled: boolean;
  isMicrophoneEnabled: boolean;
  clipboardState: ClipboardState;
  sessionDuration: number; // seconds
  latency: number; // ms
  onToggleFullscreen: () => void;
  onQualityChange: (quality: QualityLevel) => void;
  onToggleAudio: () => void;
  onToggleMicrophone: () => void;
  onOpenFileTransfer: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenSessionInfo: () => void;
  onDisconnect: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ViewerToolbar({
  isFullscreen,
  quality,
  isAudioEnabled,
  isMicrophoneEnabled,
  clipboardState,
  sessionDuration,
  latency,
  onToggleFullscreen,
  onQualityChange,
  onToggleAudio,
  onToggleMicrophone,
  onOpenFileTransfer,
  onOpenSettings,
  onOpenShortcuts,
  onOpenSessionInfo,
  onDisconnect,
}: ViewerToolbarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-hide after 3 seconds of inactivity
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Show toolbar when mouse is near the top
      if (e.clientY < 100) {
        setIsVisible(true);
        resetHideTimeout();
      }
    };

    const handleMouseLeave = () => {
      if (!isPinned) {
        startHideTimeout();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isPinned]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const startHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      if (!isPinned) {
        setIsVisible(false);
      }
    }, 3000);
  };

  const resetHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    startHideTimeout();
  };

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      startHideTimeout();
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getSignalIcon = () => {
    if (latency < 30) {
      return <SignalHigh className="h-4 w-4 text-green-500" />;
    } else if (latency < 60) {
      return <SignalMedium className="h-4 w-4 text-yellow-500" />;
    } else {
      return <SignalLow className="h-4 w-4 text-red-500" />;
    }
  };

  const getClipboardIcon = () => {
    switch (clipboardState) {
      case 'synced':
        return <Clipboard className="h-4 w-4 text-green-500" />;
      case 'blocked':
        return <ClipboardX className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clipboard className="h-4 w-4 animate-pulse text-yellow-500" />;
    }
  };

  const qualityLabels: Record<QualityLevel, string> = {
    auto: 'Auto',
    high: 'High (1080p)',
    medium: 'Medium (720p)',
    low: 'Low (480p)',
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <TooltipProvider>
      <div
        ref={toolbarRef}
        className={cn(
          'fixed left-1/2 top-0 z-50 -translate-x-1/2 transition-all duration-300',
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="mt-4 flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900/95 px-4 py-2 shadow-xl backdrop-blur-md">
          {/* Session Timer */}
          <div className="mr-2 border-r border-gray-700 px-3 py-1 font-mono text-sm text-white">
            {formatDuration(sessionDuration)}
          </div>

          {/* Connection Quality */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2">
                {getSignalIcon()}
                <span className="text-xs text-gray-400">{latency}ms</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Connection latency: {latency}ms</p>
            </TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-gray-700" />

          {/* Fullscreen Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 text-gray-300 hover:bg-gray-700 hover:text-white"
                size="icon"
                variant="ghost"
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'} (F11)</p>
            </TooltipContent>
          </Tooltip>

          {/* Quality Selector */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="h-8 w-8 text-gray-300 hover:bg-gray-700 hover:text-white"
                    size="icon"
                    variant="ghost"
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Display Quality</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuLabel>Display Quality</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(qualityLabels) as QualityLevel[]).map((level) => (
                <DropdownMenuItem
                  key={level}
                  className={cn(quality === level && 'bg-primary/10')}
                  onClick={() => onQualityChange(level)}
                >
                  {qualityLabels[level]}
                  {quality === level && <span className="text-primary ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Audio Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={cn(
                  'h-8 w-8 hover:bg-gray-700',
                  isAudioEnabled ? 'text-gray-300 hover:text-white' : 'text-red-500'
                )}
                size="icon"
                variant="ghost"
                onClick={onToggleAudio}
              >
                {isAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Microphone Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={cn(
                  'h-8 w-8 hover:bg-gray-700',
                  isMicrophoneEnabled ? 'text-gray-300 hover:text-white' : 'text-red-500'
                )}
                size="icon"
                variant="ghost"
                onClick={onToggleMicrophone}
              >
                {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Clipboard Indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="h-8 w-8 hover:bg-gray-700" size="icon" variant="ghost">
                {getClipboardIcon()}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Clipboard:{' '}
                {clipboardState === 'synced'
                  ? 'Synced'
                  : clipboardState === 'blocked'
                    ? 'Blocked by policy'
                    : 'Syncing...'}
              </p>
            </TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-gray-700" />

          {/* File Transfer */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 text-gray-300 hover:bg-gray-700 hover:text-white"
                size="icon"
                variant="ghost"
                onClick={onOpenFileTransfer}
              >
                <FileUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>File Transfer</p>
            </TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 text-gray-300 hover:bg-gray-700 hover:text-white"
                size="icon"
                variant="ghost"
                onClick={onOpenSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>

          {/* Keyboard Shortcuts */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 text-gray-300 hover:bg-gray-700 hover:text-white"
                size="icon"
                variant="ghost"
                onClick={onOpenShortcuts}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Keyboard Shortcuts (?)</p>
            </TooltipContent>
          </Tooltip>

          {/* Session Info */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 text-gray-300 hover:bg-gray-700 hover:text-white"
                size="icon"
                variant="ghost"
                onClick={onOpenSessionInfo}
              >
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Session Info</p>
            </TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-gray-700" />

          {/* Disconnect */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 w-8 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                size="icon"
                variant="ghost"
                onClick={onDisconnect}
              >
                <Power className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Disconnect</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
