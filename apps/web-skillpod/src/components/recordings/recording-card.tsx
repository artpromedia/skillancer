/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Recording Card Component
 *
 * Displays a session recording in card or list format with
 * thumbnail preview, metadata, and quick actions.
 *
 * @module components/recordings/recording-card
 */

import {
  Play,
  Download,
  Share2,
  Trash2,
  MoreVertical,
  User,
  Box,
  AlertTriangle,
  FileText,
  Clipboard,
  HardDrive,
  Shield,
  CheckSquare,
  Square,
  ExternalLink,
} from 'lucide-react';
import Image from 'next/image';
import { useState, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Recording {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  podId: string;
  podName: string;
  templateName: string;
  contractId?: string;
  contractName?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  thumbnailUrl?: string;
  videoUrl: string;
  fileSize: number;
  violations: ViolationSummary[];
  events: EventSummary;
  retentionPolicy: RetentionPolicy;
  status: 'processing' | 'ready' | 'archived' | 'pending_deletion';
}

interface ViolationSummary {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
}

interface EventSummary {
  fileTransfers: number;
  clipboardEvents: number;
  keystrokes: number;
  screenshots: number;
}

interface RetentionPolicy {
  id: string;
  name: string;
  retentionDays: number;
  expiresAt: Date;
  isOnHold: boolean;
  holdReason?: string;
}

interface RecordingCardProps {
  recording: Recording;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onPlay: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(date);
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'processing':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        text: 'text-yellow-700 dark:text-yellow-400',
        label: 'Processing',
      };
    case 'ready':
      return {
        bg: 'bg-green-100 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-400',
        label: 'Ready',
      };
    case 'archived':
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-700 dark:text-gray-400',
        label: 'Archived',
      };
    case 'pending_deletion':
      return {
        bg: 'bg-red-100 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        label: 'Pending Deletion',
      };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function ViolationIndicators({ violations }: Readonly<{ violations: ViolationSummary[] }>) {
  if (violations.length === 0) return null;

  // Group by severity
  const bySeverity = violations.reduce(
    (acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex items-center gap-1">
      <AlertTriangle className="h-4 w-4 text-red-500" />
      <div className="flex gap-0.5">
        {Object.entries(bySeverity).map(([severity, count]) => (
          <div
            key={severity}
            className={`h-2 w-2 rounded-full ${getSeverityColor(severity)}`}
            title={`${count} ${severity} violation${count > 1 ? 's' : ''}`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-red-600 dark:text-red-400">
        {violations.length}
      </span>
    </div>
  );
}

function ContextMenu({
  isOpen,
  onClose,
  onPlay,
  onDownload,
  onShare,
  onDelete,
  position,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onPlay: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  position: { x: number; y: number };
}>) {
  if (!isOpen) return null;

  const actions = [
    { icon: Play, label: 'Play', action: onPlay, color: 'text-gray-700 dark:text-gray-300' },
    {
      icon: Download,
      label: 'Download',
      action: onDownload,
      color: 'text-gray-700 dark:text-gray-300',
    },
    { icon: Share2, label: 'Share', action: onShare, color: 'text-gray-700 dark:text-gray-300' },
    {
      icon: ExternalLink,
      label: 'Open in new tab',
      action: onPlay,
      color: 'text-gray-700 dark:text-gray-300',
    },
    { icon: Trash2, label: 'Delete', action: onDelete, color: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        style={{ top: position.y, left: position.x }}
      >
        {actions.map((item, index) => (
          <button
            key={item.label}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${item.color} ${
              index === actions.length - 1 ? 'border-t border-gray-200 dark:border-gray-700' : ''
            }`}
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RecordingCard({
  recording,
  viewMode,
  isSelected,
  onSelect,
  onPlay,
  onDownload,
  onShare,
  onDelete,
}: Readonly<RecordingCardProps>) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const statusBadge = getStatusBadge(recording.status);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenuPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setShowContextMenu(true);
    }
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const cardRect = cardRef.current?.getBoundingClientRect();
    if (cardRect) {
      setContextMenuPosition({
        x: rect.right - cardRect.left - 160,
        y: rect.bottom - cardRect.top,
      });
      setShowContextMenu(true);
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        ref={cardRef}
        className={`relative rounded-lg border bg-white dark:bg-gray-800 ${
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
            : 'border-gray-200 dark:border-gray-700'
        } transition-all hover:border-gray-300 dark:hover:border-gray-600`}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center gap-4 p-3">
          {/* Selection Checkbox */}
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(!isSelected);
            }}
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-blue-600" />
            ) : (
              <Square className="h-5 w-5" />
            )}
          </button>

          {/* Thumbnail */}
          <div
            className="h-18 relative w-32 flex-shrink-0 cursor-pointer overflow-hidden rounded bg-gray-100 dark:bg-gray-700"
            onClick={onPlay}
          >
            {recording.thumbnailUrl ? (
              <Image
                fill
                alt={`Recording ${recording.id}`}
                className="object-cover"
                src={recording.thumbnailUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Box className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
              <Play className="h-8 w-8 text-white" />
            </div>
            <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
              {formatDuration(recording.duration)}
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="truncate font-medium text-gray-900 dark:text-white">
                {recording.podName}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${statusBadge.bg} ${statusBadge.text}`}
              >
                {statusBadge.label}
              </span>
              {recording.retentionPolicy.isOnHold && (
                <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                  <Shield className="h-3 w-3" />
                  Hold
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {recording.userName}
              </span>
              <span>{formatRelativeDate(recording.startTime)}</span>
              {recording.contractName && (
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {recording.contractName}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <ViolationIndicators violations={recording.violations} />
            <span className="flex items-center gap-1" title="File transfers">
              <FileText className="h-4 w-4" />
              {recording.events.fileTransfers}
            </span>
            <span className="flex items-center gap-1" title="Clipboard events">
              <Clipboard className="h-4 w-4" />
              {recording.events.clipboardEvents}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="h-4 w-4" />
              {formatFileSize(recording.fileSize)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
              title="Play"
              onClick={onPlay}
            >
              <Play className="h-5 w-5" />
            </button>
            <button
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title="Download"
              onClick={onDownload}
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title="Share"
              onClick={onShare}
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              onClick={handleMoreClick}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>

        <ContextMenu
          isOpen={showContextMenu}
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
          onDelete={onDelete}
          onDownload={onDownload}
          onPlay={onPlay}
          onShare={onShare}
        />
      </div>
    );
  }

  // Grid View
  return (
    <div
      ref={cardRef}
      className={`relative rounded-lg border bg-white dark:bg-gray-800 ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-gray-200 dark:border-gray-700'
      } overflow-hidden transition-all hover:border-gray-300 dark:hover:border-gray-600`}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video cursor-pointer bg-gray-100 dark:bg-gray-700"
        onClick={onPlay}
      >
        {recording.thumbnailUrl ? (
          <Image
            fill
            alt={`Recording ${recording.id}`}
            className="object-cover"
            src={recording.thumbnailUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Box className="h-12 w-12 text-gray-400" />
          </div>
        )}

        {/* Play Overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
            <Play className="ml-1 h-7 w-7 text-gray-900" />
          </div>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
          {formatDuration(recording.duration)}
        </div>

        {/* Selection Checkbox */}
        <div
          className={`absolute left-2 top-2 transition-opacity ${
            isHovered || isSelected ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            className="rounded bg-white/90 p-1 shadow dark:bg-gray-800/90"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(!isSelected);
            }}
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-blue-600" />
            ) : (
              <Square className="h-5 w-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Status Badge */}
        {recording.status !== 'ready' && (
          <div className="absolute right-2 top-2">
            <span
              className={`rounded-full px-2 py-1 text-xs ${statusBadge.bg} ${statusBadge.text}`}
            >
              {statusBadge.label}
            </span>
          </div>
        )}

        {/* Violations Badge */}
        {recording.violations.length > 0 && (
          <div className="absolute right-2 top-2">
            <div className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-xs text-white">
              <AlertTriangle className="h-3 w-3" />
              {recording.violations.length}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-gray-900 dark:text-white">
              {recording.podName}
            </h3>
            <p className="truncate text-sm text-gray-600 dark:text-gray-400">
              {recording.templateName}
            </p>
          </div>
          {recording.retentionPolicy.isOnHold && (
            <Shield className="h-4 w-4 flex-shrink-0 text-orange-500" title="On compliance hold" />
          )}
        </div>

        {/* User and Date */}
        <div className="mb-2 flex items-center gap-2">
          {recording.userAvatar ? (
            <Image
              alt={recording.userName}
              className="rounded-full"
              height={24}
              src={recording.userAvatar}
              width={24}
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
              <User className="h-4 w-4 text-gray-500" />
            </div>
          )}
          <span className="truncate text-sm text-gray-700 dark:text-gray-300">
            {recording.userName}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{formatRelativeDate(recording.startTime)}</span>
          <span>{formatFileSize(recording.fileSize)}</span>
        </div>

        {/* Contract Link */}
        {recording.contractName && (
          <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-700">
            <span className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
              <FileText className="h-3 w-3" />
              {recording.contractName}
            </span>
          </div>
        )}

        {/* Event Summary */}
        <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {recording.events.fileTransfers > 0 && (
            <span className="flex items-center gap-1" title="File transfers">
              <FileText className="h-3 w-3" />
              {recording.events.fileTransfers}
            </span>
          )}
          {recording.events.clipboardEvents > 0 && (
            <span className="flex items-center gap-1" title="Clipboard events">
              <Clipboard className="h-3 w-3" />
              {recording.events.clipboardEvents}
            </span>
          )}
          <ViolationIndicators violations={recording.violations} />
        </div>
      </div>

      {/* Quick Actions (on hover) */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white px-3 pb-3 pt-8 transition-opacity dark:from-gray-800 ${
          isHovered ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center justify-center gap-1">
          <button
            className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            onClick={onPlay}
          >
            <Play className="h-4 w-4" />
            Play
          </button>
          <button
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Download"
            onClick={onDownload}
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Share"
            onClick={onShare}
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            onClick={handleMoreClick}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ContextMenu
        isOpen={showContextMenu}
        position={contextMenuPosition}
        onClose={() => setShowContextMenu(false)}
        onDelete={onDelete}
        onDownload={onDownload}
        onPlay={onPlay}
        onShare={onShare}
      />
    </div>
  );
}

export default RecordingCard;
