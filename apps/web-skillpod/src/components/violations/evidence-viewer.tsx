/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Evidence Viewer Component
 *
 * Tabbed interface for viewing different types of evidence
 * with annotation tools and export capabilities.
 *
 * @module components/violations/evidence-viewer
 */

import {
  Play,
  Pause,
  Camera,
  FileText,
  Terminal,
  Activity,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Square,
  Circle,
  ArrowUpRight,
  Type,
  Highlighter,
  Trash2,
  RotateCcw,
  Copy,
  Clock,
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Evidence {
  id: string;
  type: 'recording_clip' | 'screenshot' | 'log' | 'system_state';
  title: string;
  description: string;
  url?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  capturedAt: number;
}

interface Annotation {
  id: string;
  type: 'highlight' | 'circle' | 'arrow' | 'text' | 'rectangle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  color: string;
}

interface EvidenceViewerProps {
  evidence: Evidence[];
  onViewRecording: () => void;
  recordingTimestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const EVIDENCE_TYPE_CONFIG = {
  recording_clip: { icon: Play, label: 'Recording' },
  screenshot: { icon: Camera, label: 'Screenshot' },
  log: { icon: Terminal, label: 'Logs' },
  system_state: { icon: Activity, label: 'System State' },
};

const ANNOTATION_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

// ============================================================================
// Sub-Components
// ============================================================================

function RecordingClipViewer({
  evidence,
  onViewFull,
}: {
  evidence: Evidence;
  onViewFull: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          src={evidence.url}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        >
          <track kind="captions" />
        </video>

        {/* Play Button Overlay */}
        {!isPlaying && (
          <button
            className="absolute inset-0 flex items-center justify-center bg-black/50"
            onClick={togglePlay}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <Play className="h-8 w-8 text-white" fill="white" />
            </div>
          </button>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-4">
            <button className="text-white" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <span className="font-mono text-sm text-white">
              {formatTimestamp(Math.floor(currentTime))}
            </span>
            <div className="h-1 flex-1 rounded bg-white/30">
              <div className="h-full rounded bg-white" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <Clock className="mr-1 inline h-4 w-4" />
          Captured at {formatTimestamp(evidence.capturedAt)}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            onClick={onViewFull}
          >
            <ExternalLink className="h-4 w-4" />
            View Full Recording
          </button>
          <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
            <Download className="h-4 w-4" />
            Download Clip
          </button>
        </div>
      </div>
    </div>
  );
}

function ScreenshotViewer({ evidence }: { evidence: Evidence }) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Annotation['type'] | null>(null);
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setAnnotations([]);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (!selectedTool || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      type: selectedTool,
      x,
      y,
      color: selectedColor,
    };

    if (selectedTool === 'circle' || selectedTool === 'rectangle') {
      newAnnotation.width = 10;
      newAnnotation.height = 10;
    } else if (selectedTool === 'arrow') {
      newAnnotation.endX = x + 10;
      newAnnotation.endY = y - 10;
    } else if (selectedTool === 'text') {
      newAnnotation.text = 'Note';
    }

    setAnnotations([...annotations, newAnnotation]);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(annotations.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
        {/* Annotation Tools */}
        <div className="flex items-center gap-1">
          {[
            { type: 'highlight' as const, icon: Highlighter },
            { type: 'rectangle' as const, icon: Square },
            { type: 'circle' as const, icon: Circle },
            { type: 'arrow' as const, icon: ArrowUpRight },
            { type: 'text' as const, icon: Type },
          ].map(({ type, icon: Icon }) => (
            <button
              key={type}
              className={`rounded p-2 ${
                selectedTool === type
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900'
                  : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
              title={type}
              onClick={() => setSelectedTool(selectedTool === type ? null : type)}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}

          <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-600" />

          {/* Color Picker */}
          <div className="flex items-center gap-1">
            {ANNOTATION_COLORS.map((color) => (
              <button
                key={color}
                className={`h-5 w-5 rounded-full border-2 ${
                  selectedColor === color
                    ? 'border-gray-900 dark:border-white'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-600" />

          <button
            className="rounded p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            title="Reset"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            className="rounded p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            disabled={zoom <= 0.5}
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm text-gray-600 dark:text-gray-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="rounded p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            disabled={zoom >= 4}
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            className="rounded p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className={`relative overflow-auto rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900 ${
          isFullscreen ? 'fixed inset-4 z-50' : 'max-h-[500px]'
        }`}
      >
        <div
          ref={imageContainerRef}
          className="relative inline-block"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          onClick={handleImageClick}
        >
          <img alt={evidence.title} className="max-w-none" src={evidence.url} />

          {/* Annotations */}
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className="group pointer-events-auto absolute"
              style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
              }}
            >
              {ann.type === 'circle' && (
                <div
                  className="rounded-full border-2"
                  style={{
                    width: `${ann.width}%`,
                    height: `${ann.height}%`,
                    borderColor: ann.color,
                  }}
                />
              )}
              {ann.type === 'rectangle' && (
                <div
                  className="border-2"
                  style={{
                    width: `${ann.width}%`,
                    height: `${ann.height}%`,
                    borderColor: ann.color,
                  }}
                />
              )}
              {ann.type === 'text' && (
                <div
                  className="rounded px-2 py-1 text-sm font-medium text-white"
                  style={{ backgroundColor: ann.color }}
                >
                  {ann.text}
                </div>
              )}
              {ann.type === 'highlight' && (
                <div
                  className="h-8 w-8 rounded-full opacity-50"
                  style={{ backgroundColor: ann.color }}
                />
              )}

              <button
                className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAnnotation(ann.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {annotations.length > 0 && <span>{annotations.length} annotation(s) added</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
            <Copy className="h-4 w-4" />
            Copy
          </button>
          <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

function LogViewer({ evidence }: { evidence: Evidence }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const logs =
    (evidence.data?.entries as Array<{ time: string; level: string; message: string }>) || [];

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filter === 'all' || log.level.toLowerCase() === filter;
    const matchesSearch =
      !searchQuery || log.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-red-500';
      case 'WARN':
      case 'WARNING':
        return 'text-yellow-500';
      case 'INFO':
        return 'text-blue-500';
      case 'DEBUG':
        return 'text-gray-500';
      case 'ALERT':
        return 'text-red-600 font-bold';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <input
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Search logs..."
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
          <option value="alert">Alert</option>
        </select>
      </div>

      {/* Log Entries */}
      <div className="max-h-[400px] overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-sm">
        {filteredLogs.length === 0 ? (
          <p className="py-4 text-center text-gray-500">No log entries match your filters</p>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-4">
                <span className="shrink-0 text-gray-500">{log.time}</span>
                <span className={`w-12 shrink-0 ${getLevelColor(log.level)}`}>[{log.level}]</span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
          <Copy className="h-4 w-4" />
          Copy Logs
        </button>
        <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
    </div>
  );
}

function SystemStateViewer({ evidence }: { evidence: Evidence }) {
  const state = evidence.data || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(state).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <div className="mb-1 text-sm font-medium text-gray-500">{key.replace(/_/g, ' ')}</div>
            <div className="text-gray-900 dark:text-white">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(state).length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">No system state data available</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
          <Copy className="h-4 w-4" />
          Copy JSON
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EvidenceViewer({
  evidence,
  onViewRecording,
  recordingTimestamp,
}: EvidenceViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (evidence.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <h3 className="mb-1 text-lg font-medium text-gray-900 dark:text-white">
          No Evidence Available
        </h3>
        <p className="text-sm text-gray-500">No evidence has been collected for this violation</p>
      </div>
    );
  }

  const currentEvidence = evidence[activeIndex];
  const EvidenceIcon = EVIDENCE_TYPE_CONFIG[currentEvidence.type].icon;

  return (
    <div className="space-y-4">
      {/* Evidence Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {evidence.map((ev, index) => {
          const Icon = EVIDENCE_TYPE_CONFIG[ev.type].icon;
          const label = EVIDENCE_TYPE_CONFIG[ev.type].label;

          return (
            <button
              key={ev.id}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                index === activeIndex
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveIndex(index)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Evidence Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">{currentEvidence.title}</h3>
          <p className="text-sm text-gray-500">{currentEvidence.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm text-gray-500">
            {activeIndex + 1} / {evidence.length}
          </span>
          <button
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
            disabled={activeIndex === evidence.length - 1}
            onClick={() => setActiveIndex(Math.min(evidence.length - 1, activeIndex + 1))}
          >
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Evidence Content */}
      <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
        {currentEvidence.type === 'recording_clip' && (
          <RecordingClipViewer evidence={currentEvidence} onViewFull={onViewRecording} />
        )}
        {currentEvidence.type === 'screenshot' && <ScreenshotViewer evidence={currentEvidence} />}
        {currentEvidence.type === 'log' && <LogViewer evidence={currentEvidence} />}
        {currentEvidence.type === 'system_state' && (
          <SystemStateViewer evidence={currentEvidence} />
        )}
      </div>

      {/* Export Evidence Package */}
      <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
          <Download className="h-4 w-4" />
          Export All Evidence as Package
        </button>
      </div>
    </div>
  );
}
