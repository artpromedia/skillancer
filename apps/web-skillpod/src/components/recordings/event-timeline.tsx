/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Event Timeline Component
 *
 * Horizontal timeline with event markers, zoom controls,
 * and synchronized event list for recording playback.
 *
 * @module components/recordings/event-timeline
 */

import {
  AlertTriangle,
  FileText,
  Clipboard,
  PlayCircle,
  StopCircle,
  Camera,
  Keyboard,
  Filter,
  List,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

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
  timestamp: number;
  duration?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

interface EventTimelineProps {
  events: RecordingEvent[];
  duration: number;
  currentTime: number;
  zoom: number;
  onSeek: (time: number) => void;
  onEventClick: (event: RecordingEvent) => void;
  selectedEventId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const EVENT_TYPES = [
  { type: 'violation', label: 'Violations', color: '#EF4444', icon: AlertTriangle },
  { type: 'file_transfer', label: 'File Transfers', color: '#3B82F6', icon: FileText },
  { type: 'clipboard', label: 'Clipboard', color: '#F59E0B', icon: Clipboard },
  { type: 'session_start', label: 'Session Start', color: '#10B981', icon: PlayCircle },
  { type: 'session_end', label: 'Session End', color: '#10B981', icon: StopCircle },
  { type: 'screenshot', label: 'Screenshots', color: '#8B5CF6', icon: Camera },
  { type: 'keystroke_burst', label: 'Keystroke Bursts', color: '#6366F1', icon: Keyboard },
];

const EVENT_COLORS: Record<string, string> = {
  violation: '#EF4444',
  file_transfer: '#3B82F6',
  clipboard: '#F59E0B',
  session_start: '#10B981',
  session_end: '#10B981',
  screenshot: '#8B5CF6',
  keystroke_burst: '#6366F1',
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
  const eventType = EVENT_TYPES.find((e) => e.type === type);
  return eventType?.icon || FileText;
}

function getEventColor(type: string): string {
  return EVENT_COLORS[type] || '#6B7280';
}

// ============================================================================
// Sub-Components
// ============================================================================

function EventMarker({
  event,
  position,
  isActive,
  isSelected,
  onClick,
}: {
  event: RecordingEvent;
  position: number;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const color = getEventColor(event.type);
  const Icon = getEventIcon(event.type);

  return (
    <div
      className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${position}%` }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        className={`h-4 w-4 rounded-full border-2 transition-all ${
          isSelected ? 'scale-125 ring-2 ring-white ring-offset-1' : ''
        } ${isActive ? 'animate-pulse' : ''}`}
        style={{
          backgroundColor: color,
          borderColor: isSelected ? 'white' : color,
        }}
        onClick={onClick}
      >
        <span className="sr-only">{event.title}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg">
          <div className="mb-1 flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color }} />
            <span className="font-medium">{event.title}</span>
          </div>
          <div className="text-xs text-gray-400">
            {formatTime(event.timestamp)}
            {event.severity && (
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                  event.severity === 'critical'
                    ? 'bg-red-500/20 text-red-400'
                    : event.severity === 'high'
                      ? 'bg-orange-500/20 text-orange-400'
                      : event.severity === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {event.severity}
              </span>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

function TimeRuler({ duration, zoom }: { duration: number; zoom: number }) {
  // Calculate tick marks based on duration and zoom
  const tickInterval = useMemo(() => {
    const baseInterval = duration / 10;
    const intervals = [1, 5, 10, 30, 60, 300, 600, 1800, 3600];
    for (const interval of intervals) {
      if (duration / interval <= 20 * zoom) {
        return interval;
      }
    }
    return 3600;
  }, [duration, zoom]);

  const ticks = useMemo(() => {
    const result = [];
    for (let t = 0; t <= duration; t += tickInterval) {
      result.push({
        time: t,
        position: (t / duration) * 100,
        major: t % (tickInterval * 5) === 0,
      });
    }
    return result;
  }, [duration, tickInterval]);

  return (
    <div className="relative h-6 border-b border-gray-700">
      {ticks.map((tick) => (
        <div key={tick.time} className="absolute top-0" style={{ left: `${tick.position}%` }}>
          <div className={`w-px ${tick.major ? 'h-4 bg-gray-500' : 'h-2 bg-gray-600'}`} />
          {tick.major && (
            <span className="absolute left-1/2 top-4 -translate-x-1/2 text-xs text-gray-500">
              {formatTime(tick.time)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Minimap({
  events,
  duration,
  currentTime,
  visibleStart,
  visibleEnd,
  onNavigate,
}: {
  events: RecordingEvent[];
  duration: number;
  currentTime: number;
  visibleStart: number;
  visibleEnd: number;
  onNavigate: (start: number) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const visibleWidth = visibleEnd - visibleStart;
    const newStart = Math.max(0, Math.min(1 - visibleWidth, clickPosition - visibleWidth / 2));
    onNavigate(newStart * duration);
  };

  return (
    <div className="relative h-8 cursor-pointer rounded bg-gray-800" onClick={handleClick}>
      {/* Event markers */}
      {events.map((event) => (
        <div
          key={event.id}
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full"
          style={{
            left: `${(event.timestamp / duration) * 100}%`,
            backgroundColor: getEventColor(event.type),
          }}
        />
      ))}

      {/* Visible area indicator */}
      <div
        className="absolute bottom-0 top-0 rounded border-2 border-blue-500 bg-blue-500/10"
        style={{
          left: `${visibleStart * 100}%`,
          width: `${(visibleEnd - visibleStart) * 100}%`,
        }}
      />

      {/* Current time indicator */}
      <div
        className="absolute bottom-0 top-0 w-0.5 bg-white"
        style={{ left: `${(currentTime / duration) * 100}%` }}
      />
    </div>
  );
}

function EventList({
  events,
  currentTime,
  selectedEventId,
  onEventClick,
}: {
  events: RecordingEvent[];
  currentTime: number;
  selectedEventId?: string;
  onEventClick: (event: RecordingEvent) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current event
  useEffect(() => {
    if (!listRef.current) return;
    const currentEvent = events.find(
      (e) => currentTime >= e.timestamp && currentTime < e.timestamp + (e.duration || 5)
    );
    if (currentEvent) {
      const element = listRef.current.querySelector(`[data-event-id="${currentEvent.id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentTime, events]);

  return (
    <div ref={listRef} className="max-h-40 overflow-y-auto">
      {events.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500">No events in this recording</div>
      ) : (
        <div className="divide-y divide-gray-700">
          {events.map((event) => {
            const Icon = getEventIcon(event.type);
            const color = getEventColor(event.type);
            const isActive =
              currentTime >= event.timestamp &&
              currentTime < event.timestamp + (event.duration || 5);
            const isSelected = event.id === selectedEventId;

            return (
              <button
                key={event.id}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-900/30'
                    : isActive
                      ? 'bg-gray-700/50'
                      : 'hover:bg-gray-700/30'
                }`}
                data-event-id={event.id}
                onClick={() => onEventClick(event)}
              >
                <Icon className="h-4 w-4 flex-shrink-0" style={{ color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-gray-200">{event.title}</div>
                  <div className="truncate text-xs text-gray-500">{event.description}</div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {event.severity && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        event.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : event.severity === 'high'
                            ? 'bg-orange-500/20 text-orange-400'
                            : event.severity === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {event.severity}
                    </span>
                  )}
                  <span className="font-mono text-xs text-gray-500">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventTypeFilter({
  enabledTypes,
  eventCounts,
  onToggle,
}: {
  enabledTypes: string[];
  eventCounts: Record<string, number>;
  onToggle: (type: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded bg-gray-800/50 px-2 py-1">
      {EVENT_TYPES.map(({ type, label, color, icon: Icon }) => {
        const count = eventCounts[type] || 0;
        if (count === 0) return null;

        const isEnabled = enabledTypes.length === 0 || enabledTypes.includes(type);

        return (
          <button
            key={type}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              isEnabled ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-400'
            }`}
            title={label}
            onClick={() => onToggle(type)}
          >
            <Icon className="h-3 w-3" style={{ color: isEnabled ? color : undefined }} />
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EventTimeline({
  events,
  duration,
  currentTime,
  zoom,
  onSeek,
  onEventClick,
  selectedEventId,
}: EventTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showEventList, setShowEventList] = useState(true);
  const [enabledTypes, setEnabledTypes] = useState<string[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate visible range based on zoom and scroll
  const visibleDuration = duration / zoom;
  const visibleStart = scrollOffset / duration;
  const visibleEnd = Math.min(1, (scrollOffset + visibleDuration) / duration);

  // Filter events by enabled types
  const filteredEvents = useMemo(() => {
    if (enabledTypes.length === 0) return events;
    return events.filter((e) => enabledTypes.includes(e.type));
  }, [events, enabledTypes]);

  // Count events by type
  const eventCounts = useMemo(() => {
    return events.reduce(
      (acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [events]);

  // Handle click to seek
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const time = scrollOffset + clickPosition * visibleDuration;
      onSeek(Math.max(0, Math.min(duration, time)));
    },
    [isDragging, scrollOffset, visibleDuration, duration, onSeek]
  );

  // Handle type filter toggle
  const handleTypeToggle = useCallback((type: string) => {
    setEnabledTypes((prev) => {
      if (prev.length === 0) {
        return [type];
      }
      if (prev.includes(type)) {
        const next = prev.filter((t) => t !== type);
        return next.length === 0 ? [] : next;
      }
      return [...prev, type];
    });
  }, []);

  // Handle minimap navigation
  const handleMinimapNavigate = useCallback(
    (start: number) => {
      setScrollOffset(Math.max(0, Math.min(duration - visibleDuration, start)));
    },
    [duration, visibleDuration]
  );

  // Auto-scroll to follow playhead
  useEffect(() => {
    if (currentTime < scrollOffset || currentTime > scrollOffset + visibleDuration) {
      setScrollOffset(Math.max(0, currentTime - visibleDuration / 2));
    }
  }, [currentTime, scrollOffset, visibleDuration]);

  return (
    <div className="bg-gray-800/50">
      {/* Controls */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-1">
        <EventTypeFilter
          enabledTypes={enabledTypes}
          eventCounts={eventCounts}
          onToggle={handleTypeToggle}
        />
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-300"
          onClick={() => setShowEventList(!showEventList)}
        >
          {showEventList ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showEventList ? 'Hide List' : 'Show List'}
        </button>
      </div>

      {/* Minimap */}
      {zoom > 1 && (
        <div className="border-b border-gray-700 px-4 py-2">
          <Minimap
            currentTime={currentTime}
            duration={duration}
            events={filteredEvents}
            visibleEnd={visibleEnd}
            visibleStart={visibleStart}
            onNavigate={handleMinimapNavigate}
          />
        </div>
      )}

      {/* Time Ruler */}
      <div className="px-4">
        <TimeRuler duration={visibleDuration} zoom={zoom} />
      </div>

      {/* Timeline Track */}
      <div
        ref={timelineRef}
        className="relative mx-4 my-2 h-10 cursor-pointer rounded bg-gray-700/50"
        onClick={handleTimelineClick}
      >
        {/* Event Markers */}
        {filteredEvents
          .filter((e) => {
            const pos = (e.timestamp - scrollOffset) / visibleDuration;
            return pos >= 0 && pos <= 1;
          })
          .map((event) => {
            const position = ((event.timestamp - scrollOffset) / visibleDuration) * 100;
            const isActive =
              currentTime >= event.timestamp &&
              currentTime < event.timestamp + (event.duration || 5);

            return (
              <EventMarker
                key={event.id}
                event={event}
                isActive={isActive}
                isSelected={event.id === selectedEventId}
                position={position}
                onClick={() => onEventClick(event)}
              />
            );
          })}

        {/* Playhead */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-white shadow-lg"
          style={{
            left: `${((currentTime - scrollOffset) / visibleDuration) * 100}%`,
          }}
        >
          <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white" />
        </div>
      </div>

      {/* Event List */}
      {showEventList && (
        <div className="border-t border-gray-700">
          <EventList
            currentTime={currentTime}
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onEventClick={onEventClick}
          />
        </div>
      )}
    </div>
  );
}

export default EventTimeline;
