/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, jsx-a11y/media-has-caption, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Enhanced Recording Viewer Component
 *
 * Full-featured video player with synchronized event timeline,
 * markers, and comprehensive playback controls.
 *
 * @module components/recordings/recording-viewer
 */

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Camera,
  Scissors,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  FileText,
  Clipboard,
  PlayCircle,
  StopCircle,
  Share2,
  X,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import { EventTimeline } from './event-timeline';

// ============================================================================
// Types
// ============================================================================

interface RecordingEvent {
  id: string;
  type:
    | 'violation'
    | 'file_transfer'
    | 'clipboard'
    | 'session_start'
    | 'session_end'
    | 'screenshot'
    | 'keystroke_burst';
  subtype?: string;
  timestamp: number; // seconds from start
  duration?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

interface Recording {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  podName: string;
  startTime: Date;
  duration: number;
  videoUrl: string;
  events: RecordingEvent[];
}

interface RecordingViewerProps {
  recording: Recording;
  initialTimestamp?: number;
  onClose?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
}

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  buffered: number;
}

// ============================================================================
// Constants
// ============================================================================

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const EVENT_COLORS: Record<string, string> = {
  violation: '#EF4444', // red
  file_transfer: '#3B82F6', // blue
  clipboard: '#F59E0B', // yellow
  session_start: '#10B981', // green
  session_end: '#10B981', // green
  screenshot: '#8B5CF6', // purple
  keystroke_burst: '#6366F1', // indigo
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getEventIcon(type: string) {
  switch (type) {
    case 'violation':
      return AlertTriangle;
    case 'file_transfer':
      return FileText;
    case 'clipboard':
      return Clipboard;
    case 'session_start':
      return PlayCircle;
    case 'session_end':
      return StopCircle;
    case 'screenshot':
      return Camera;
    default:
      return FileText;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function PlaybackControls({
  state,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onPlaybackRateChange,
  onFullscreenToggle,
  onFrameStep,
}: Readonly<{
  state: PlaybackState;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onFullscreenToggle: () => void;
  onFrameStep: (direction: 'prev' | 'next') => void;
}>) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  return (
    <div className="flex items-center gap-2 bg-black/80 px-4 py-2">
      {/* Play/Pause */}
      <button
        className="p-2 text-white transition-colors hover:text-blue-400"
        onClick={onPlayPause}
      >
        {state.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
      </button>

      {/* Frame Step Backward */}
      <button
        className="p-2 text-white transition-colors hover:text-blue-400"
        title="Previous frame"
        onClick={() => onFrameStep('prev')}
      >
        <SkipBack className="h-5 w-5" />
      </button>

      {/* Frame Step Forward */}
      <button
        className="p-2 text-white transition-colors hover:text-blue-400"
        title="Next frame"
        onClick={() => onFrameStep('next')}
      >
        <SkipForward className="h-5 w-5" />
      </button>

      {/* Time Display */}
      <div className="mx-2 font-mono text-sm text-white">
        {formatTime(state.currentTime)} / {formatTime(state.duration)}
      </div>

      {/* Progress Bar */}
      <div className="mx-2 flex-1">
        <input
          className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-600 accent-blue-500"
          max={state.duration}
          min={0}
          type="range"
          value={state.currentTime}
          onChange={(e) => onSeek(Number.parseFloat(e.target.value))}
        />
      </div>

      {/* Volume */}
      <div
        className="relative"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <button
          className="p-2 text-white transition-colors hover:text-blue-400"
          onClick={onMuteToggle}
        >
          {state.isMuted || state.volume === 0 ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </button>
        {showVolumeSlider && (
          <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg bg-black/90 p-2">
            <input
              className="h-1 w-20 cursor-pointer appearance-none rounded-lg bg-gray-600 accent-blue-500"
              max={1}
              min={0}
              step={0.1}
              style={{ writingMode: 'horizontal-tb' }}
              type="range"
              value={state.volume}
              onChange={(e) => onVolumeChange(Number.parseFloat(e.target.value))}
            />
          </div>
        )}
      </div>

      {/* Playback Speed */}
      <div className="relative">
        <button
          className="px-2 py-1 text-sm text-white transition-colors hover:text-blue-400"
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
        >
          {state.playbackRate}x
        </button>
        {showSpeedMenu && (
          <div className="absolute bottom-full right-0 mb-2 min-w-[80px] rounded-lg bg-black/90 py-1">
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                className={`w-full px-3 py-1 text-left text-sm ${
                  state.playbackRate === rate ? 'text-blue-400' : 'text-white hover:text-blue-400'
                }`}
                onClick={() => {
                  onPlaybackRateChange(rate);
                  setShowSpeedMenu(false);
                }}
              >
                {rate}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen */}
      <button
        className="p-2 text-white transition-colors hover:text-blue-400"
        onClick={onFullscreenToggle}
      >
        {state.isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  );
}

function getSeverityClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'high':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

function EventDetailsPanel({
  event,
  isActive,
  onSeekTo,
  onClose,
}: Readonly<{
  event: RecordingEvent | null;
  isActive: boolean;
  onSeekTo: (timestamp: number) => void;
  onClose: () => void;
}>) {
  if (!event) return null;

  const Icon = getEventIcon(event.type);
  const color = EVENT_COLORS[event.type];

  return (
    <div
      className={`absolute right-4 top-4 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg transition-all dark:border-gray-700 dark:bg-gray-800 ${
        isActive ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      <div
        className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-700"
        style={{ borderLeftColor: color, borderLeftWidth: 4 }}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" style={{ color }} />
          <span className="font-medium text-gray-900 dark:text-white">{event.title}</span>
        </div>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">{event.description}</p>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Timestamp</span>
          <button
            className="text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => onSeekTo(event.timestamp)}
          >
            {formatTime(event.timestamp)}
          </button>
        </div>

        {event.severity && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Severity</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityClass(event.severity)}`}
            >
              {event.severity}
            </span>
          </div>
        )}

        {event.data && Object.keys(event.data).length > 0 && (
          <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Details
            </span>
            <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">
              {JSON.stringify(event.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolsPanel({
  onScreenshot,
  onExportClip,
  onDownload,
  onShare,
}: Readonly<{
  onScreenshot: () => void;
  onExportClip: () => void;
  onDownload: () => void;
  onShare: () => void;
}>) {
  return (
    <div className="flex items-center gap-1 px-2">
      <button
        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Capture screenshot"
        onClick={onScreenshot}
      >
        <Camera className="h-4 w-4" />
        Screenshot
      </button>
      <button
        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Export clip"
        onClick={onExportClip}
      >
        <Scissors className="h-4 w-4" />
        Export Clip
      </button>
      <button
        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Download full recording"
        onClick={onDownload}
      >
        <Download className="h-4 w-4" />
        Download
      </button>
      <button
        className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Share recording"
        onClick={onShare}
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RecordingViewer({
  recording,
  initialTimestamp = 0,
  onClose,
  onShare,
  onDownload,
}: Readonly<RecordingViewerProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: initialTimestamp,
    duration: recording.duration,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    isFullscreen: false,
    buffered: 0,
  });

  const [selectedEvent, setSelectedEvent] = useState<RecordingEvent | null>(null);
  const [activeEvent, setActiveEvent] = useState<RecordingEvent | null>(null);
  // Filter is set to show all events by default; could be made configurable in the future
  const eventFilter: string[] = [];
  const [timelineZoom, setTimelineZoom] = useState(1);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (eventFilter.length === 0) return recording.events;
    return recording.events.filter((e) => eventFilter.includes(e.type));
  }, [recording.events, eventFilter]);

  // Find active event based on current playback position
  useEffect(() => {
    const active = recording.events.find(
      (e) =>
        playbackState.currentTime >= e.timestamp &&
        playbackState.currentTime < e.timestamp + (e.duration || 5)
    );
    setActiveEvent(active || null);
  }, [playbackState.currentTime, recording.events]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const handleTimeUpdate = () => {
      setPlaybackState((prev) => ({
        ...prev,
        currentTime: video.currentTime,
      }));
    };

    const handleLoadedMetadata = () => {
      setPlaybackState((prev) => ({
        ...prev,
        duration: video.duration,
      }));
      if (initialTimestamp > 0) {
        video.currentTime = initialTimestamp;
      }
    };

    const handlePlay = () => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        setPlaybackState((prev) => ({
          ...prev,
          buffered: (buffered / video.duration) * 100,
        }));
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('progress', handleProgress);
    };
  }, [initialTimestamp]);

  // Handlers used by keyboard shortcuts (defined before useEffect)
  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setPlaybackState((prev) => ({ ...prev, isMuted: video.muted }));
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
      setPlaybackState((prev) => ({ ...prev, isFullscreen: false }));
    } else {
      container.requestFullscreen();
      setPlaybackState((prev) => ({ ...prev, isFullscreen: true }));
    }
  }, []);

  const handleFrameStep = useCallback((direction: 'prev' | 'next') => {
    const video = videoRef.current;
    if (!video) return;
    // Approximate frame step (30fps)
    const frameTime = 1 / 30;
    video.currentTime = Math.max(
      0,
      Math.min(video.duration, video.currentTime + (direction === 'next' ? frameTime : -frameTime))
    );
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          handleFullscreenToggle();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case ',':
          e.preventDefault();
          handleFrameStep('prev');
          break;
        case '.':
          e.preventDefault();
          handleFrameStep('next');
          break;
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [handleFrameStep, handleFullscreenToggle, handleMuteToggle]);

  // Handlers
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setPlaybackState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const handleVolumeChange = useCallback((volume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    setPlaybackState((prev) => ({ ...prev, volume, isMuted: volume === 0 }));
  }, []);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackState((prev) => ({ ...prev, playbackRate: rate }));
  }, []);

  const handleScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    // Download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `recording-${recording.id}-${formatTime(playbackState.currentTime).replaceAll(':', '-')}.png`;
    link.click();
  }, [recording.id, playbackState.currentTime]);

  const handleExportClip = useCallback(() => {
    // Would open a modal to select start/end times
    // TODO: Implement clip export functionality
  }, [playbackState.currentTime]);

  const handleEventClick = useCallback(
    (event: RecordingEvent) => {
      setSelectedEvent(event);
      handleSeek(event.timestamp);
    },
    [handleSeek]
  );

  return (
    <div ref={containerRef} className="flex h-full flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div className="flex items-center gap-3">
          {onClose && (
            <button className="p-1 text-gray-400 hover:text-white" onClick={onClose}>
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h2 className="font-medium text-white">{recording.podName}</h2>
            <p className="text-sm text-gray-400">
              {recording.userName} • {new Date(recording.startTime).toLocaleDateString()}
            </p>
          </div>
        </div>
        <ToolsPanel
          onDownload={onDownload || (() => {})}
          onExportClip={handleExportClip}
          onScreenshot={handleScreenshot}
          onShare={onShare || (() => {})}
        />
      </div>

      {/* Video Area */}
      <div className="relative flex-1 bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          preload="metadata"
          src={recording.videoUrl}
        />

        {/* Event Details Panel */}
        <EventDetailsPanel
          event={selectedEvent || activeEvent}
          isActive={!!activeEvent}
          onClose={() => setSelectedEvent(null)}
          onSeekTo={handleSeek}
        />
      </div>

      {/* Playback Controls */}
      <PlaybackControls
        state={playbackState}
        onFrameStep={handleFrameStep}
        onFullscreenToggle={handleFullscreenToggle}
        onMuteToggle={handleMuteToggle}
        onPlaybackRateChange={handlePlaybackRateChange}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
      />

      {/* Event Timeline */}
      <div className="border-t border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
          <span className="text-sm text-gray-400">Events Timeline</span>
          <div className="flex items-center gap-2">
            <button
              className="p-1 text-gray-400 hover:text-white"
              onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-400">{(timelineZoom * 100).toFixed(0)}%</span>
            <button
              className="p-1 text-gray-400 hover:text-white"
              onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
        <EventTimeline
          currentTime={playbackState.currentTime}
          duration={playbackState.duration}
          events={filteredEvents}
          selectedEventId={selectedEvent?.id}
          zoom={timelineZoom}
          onEventClick={handleEventClick}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}

export default RecordingViewer;
