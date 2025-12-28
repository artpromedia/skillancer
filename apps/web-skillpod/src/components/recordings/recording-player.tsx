/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, jsx-a11y/media-has-caption, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Recording Player Component
 *
 * Video player for VDI session recordings:
 * - HLS/DASH adaptive streaming
 * - Playback controls (play, pause, seek, speed)
 * - Chapter navigation
 * - Picture-in-picture
 * - Fullscreen support
 * - Keyboard shortcuts
 */

import { cn } from '@skillancer/ui/lib/utils';
import {
  FastForward,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecordingChapter } from '@/lib/api/recordings';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordingPlayerProps {
  recordingId: string;
  streamUrl: string;
  duration: number;
  chapters?: RecordingChapter[];
  thumbnailUrl?: string;
  autoPlay?: boolean;
  className?: string;
}

interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  isPiP: boolean;
  currentTime: number;
  bufferedTime: number;
  volume: number;
  playbackRate: number;
  error: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RecordingPlayer({
  recordingId,
  streamUrl,
  duration,
  chapters = [],
  thumbnailUrl,
  autoPlay = false,
  className,
}: Readonly<RecordingPlayerProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    isPaused: true,
    isBuffering: false,
    isMuted: false,
    isFullscreen: false,
    isPiP: false,
    currentTime: 0,
    bufferedTime: 0,
    volume: 1,
    playbackRate: 1,
    error: null,
  });

  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // ==========================================================================
  // VIDEO CONTROLS
  // ==========================================================================

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, []);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;

      video.currentTime = Math.max(0, Math.min(time, duration));
    },
    [duration]
  );

  const seekRelative = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;

      seek(video.currentTime + delta);
    },
    [seek]
  );

  const setVolume = useCallback((volume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = Math.max(0, Math.min(1, volume));
    video.muted = volume === 0;

    setState((prev) => ({
      ...prev,
      volume: video.volume,
      isMuted: video.muted,
    }));
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setState((prev) => ({ ...prev, isMuted: video.muted }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setState((prev) => ({ ...prev, playbackRate: rate }));
    setShowSpeedMenu(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  }, []);

  // ==========================================================================
  // PROGRESS BAR
  // ==========================================================================

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const progress = progressRef.current;
      if (!progress) return;

      const rect = progress.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      seek(percent * duration);
    },
    [duration, seek]
  );

  // ==========================================================================
  // VIDEO EVENT HANDLERS
  // ==========================================================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setState((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
    const handlePause = () => setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
    const handleWaiting = () => setState((prev) => ({ ...prev, isBuffering: true }));
    const handleCanPlay = () => setState((prev) => ({ ...prev, isBuffering: false }));
    const handleError = () => setState((prev) => ({ ...prev, error: 'Failed to load recording' }));

    const handleTimeUpdate = () => {
      setState((prev) => ({
        ...prev,
        currentTime: video.currentTime,
      }));
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setState((prev) => ({
          ...prev,
          bufferedTime: video.buffered.end(video.buffered.length - 1),
        }));
      }
    };

    const handleEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState((prev) => ({ ...prev, isFullscreen: !!document.fullscreenElement }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // PiP change handler
  useEffect(() => {
    const handlePiPChange = () => {
      setState((prev) => ({ ...prev, isPiP: !!document.pictureInPictureElement }));
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener('enterpictureinpicture', handlePiPChange);
      video.addEventListener('leavepictureinpicture', handlePiPChange);

      return () => {
        video.removeEventListener('enterpictureinpicture', handlePiPChange);
        video.removeEventListener('leavepictureinpicture', handlePiPChange);
      };
    }
  }, []);

  // Custom seek event listener
  useEffect(() => {
    const handleSeekEvent = (e: CustomEvent<{ time: number }>) => {
      seek(e.detail.time);
    };

    globalThis.addEventListener('seek-to-time', handleSeekEvent as EventListener);
    return () => globalThis.removeEventListener('seek-to-time', handleSeekEvent as EventListener);
  }, [seek]);

  // ==========================================================================
  // CONTROLS VISIBILITY
  // ==========================================================================

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = setTimeout(() => {
      if (state.isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [state.isPlaying]);

  // ==========================================================================
  // KEYBOARD SHORTCUTS
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(state.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(state.volume - 0.1);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'p':
          if (e.shiftKey) {
            e.preventDefault();
            togglePiP();
          }
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          seek((Number.parseInt(e.key, 10) / 10) * duration);
          break;
        case ',':
          e.preventDefault();
          if (state.playbackRate > 0.25) setPlaybackRate(state.playbackRate - 0.25);
          break;
        case '.':
          e.preventDefault();
          if (state.playbackRate < 2) setPlaybackRate(state.playbackRate + 0.25);
          break;
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [
    state.volume,
    state.playbackRate,
    duration,
    togglePlay,
    seekRelative,
    setVolume,
    toggleMute,
    toggleFullscreen,
    togglePiP,
    seek,
    setPlaybackRate,
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const progress = (state.currentTime / duration) * 100;
  const buffered = (state.bufferedTime / duration) * 100;

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative bg-black',
        state.isFullscreen && 'h-screen w-screen',
        className
      )}
      onMouseLeave={() => state.isPlaying && setShowControls(false)}
      onMouseMove={showControlsTemporarily}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        playsInline
        autoPlay={autoPlay}
        className="h-full w-full"
        poster={thumbnailUrl}
        src={streamUrl}
        onClick={togglePlay}
      />

      {/* Buffering indicator */}
      {state.isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {/* Error overlay */}
      {state.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <p className="mb-4 text-xl text-red-400">{state.error}</p>
            <button
              className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
              onClick={() => {
                setState((prev) => ({ ...prev, error: null }));
                videoRef.current?.load();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="group/progress relative mb-4 h-1 cursor-pointer rounded-full bg-white/30 hover:h-2"
          onClick={handleProgressClick}
        >
          {/* Buffered progress */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/50"
            style={{ width: `${buffered}%` }}
          />
          {/* Playback progress */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-500"
            style={{ width: `${progress}%` }}
          />
          {/* Chapters markers */}
          {chapters.map((chapter) => (
            <div
              key={`chapter-${chapter.startTime}`}
              className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-white"
              style={{ left: `${(chapter.startTime / duration) * 100}%` }}
              title={chapter.title}
            />
          ))}
          {/* Scrubber */}
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 opacity-0 shadow-lg group-hover/progress:opacity-100"
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button className="rounded-full p-2 text-white hover:bg-white/20" onClick={togglePlay}>
              {state.isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </button>

            {/* Skip backward */}
            <button
              className="rounded-full p-2 text-white hover:bg-white/20"
              onClick={() => seekRelative(-10)}
            >
              <Rewind className="h-5 w-5" />
            </button>

            {/* Skip forward */}
            <button
              className="rounded-full p-2 text-white hover:bg-white/20"
              onClick={() => seekRelative(10)}
            >
              <FastForward className="h-5 w-5" />
            </button>

            {/* Volume */}
            <div className="group/volume flex items-center">
              <button
                className="rounded-full p-2 text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {state.isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                className="hidden w-20 group-hover/volume:block"
                max="1"
                min="0"
                step="0.1"
                type="range"
                value={state.isMuted ? 0 : state.volume}
                onChange={(e) => setVolume(Number.parseFloat(e.target.value))}
              />
            </div>

            {/* Time display */}
            <span className="ml-2 text-sm text-white">
              {formatTime(state.currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Previous chapter */}
            {chapters.length > 0 && (
              <>
                <button
                  className="rounded-full p-2 text-white hover:bg-white/20"
                  onClick={() => {
                    const prevChapter = [...chapters]
                      .reverse()
                      .find((c) => c.startTime < state.currentTime - 2);
                    if (prevChapter) seek(prevChapter.startTime);
                    else seek(0);
                  }}
                >
                  <SkipBack className="h-5 w-5" />
                </button>

                <button
                  className="rounded-full p-2 text-white hover:bg-white/20"
                  onClick={() => {
                    const nextChapter = chapters.find((c) => c.startTime > state.currentTime);
                    if (nextChapter) seek(nextChapter.startTime);
                  }}
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </>
            )}

            {/* Playback speed */}
            <div className="relative">
              <button
                className="rounded-full px-3 py-1 text-sm text-white hover:bg-white/20"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              >
                {state.playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-gray-800 py-2 shadow-lg">
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <button
                      key={rate}
                      className={cn(
                        'block w-full px-4 py-1 text-left text-sm text-white hover:bg-gray-700',
                        state.playbackRate === rate && 'bg-blue-600'
                      )}
                      onClick={() => setPlaybackRate(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP */}
            <button className="rounded-full p-2 text-white hover:bg-white/20" onClick={togglePiP}>
              <PictureInPicture2 className="h-5 w-5" />
            </button>

            {/* Fullscreen */}
            <button
              className="rounded-full p-2 text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              {state.isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
