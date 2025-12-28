/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Suspense } from 'react';

import { RecordingPlayer } from '@/components/recordings/recording-player';
import { recordingsApi, type RecordingDetails } from '@/lib/api/recordings';

// ============================================================================
// TYPES
// ============================================================================

interface RecordingPageProps {
  params: Promise<{
    recordingId: string;
  }>;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getRecordingDetails(recordingId: string): Promise<RecordingDetails | null> {
  try {
    return await recordingsApi.getRecordingDetails(recordingId);
  } catch (error) {
    console.error('Failed to fetch recording details:', error);
    return null;
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

function RecordingLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
        <p className="text-white/70">Loading recording...</p>
      </div>
    </div>
  );
}

function RecordingError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="max-w-md rounded-lg bg-red-900/20 p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-400">Recording Not Found</h1>
        <p className="mb-6 text-gray-400">{message}</p>
        <a
          className="inline-block rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
          href="/recordings"
        >
          Back to Recordings
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default async function RecordingPage({ params }: Readonly<RecordingPageProps>) {
  const { recordingId } = await params;

  const recording = await getRecordingDetails(recordingId);

  if (!recording) {
    return (
      <RecordingError message="The recording you're looking for doesn't exist or has expired." />
    );
  }

  // Check if recording is still processing
  if (recording.status === 'processing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="max-w-md rounded-lg bg-gray-800 p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
          <h1 className="mb-4 text-2xl font-bold text-white">Processing Recording</h1>
          <p className="mb-6 text-gray-400">
            Your recording is being processed. This may take a few minutes.
          </p>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${recording.processingProgress || 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{recording.processingProgress || 0}% complete</p>
        </div>
      </div>
    );
  }

  // Check if recording has expired
  if (recording.status === 'expired') {
    return <RecordingError message="This recording has expired and is no longer available." />;
  }

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <a className="text-gray-400 hover:text-white" href="/recordings">
              ← Back to Recordings
            </a>
            <div className="h-6 w-px bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">{recording.name}</h1>
              <p className="text-sm text-gray-400">
                Recorded on {new Date(recording.recordedAt).toLocaleDateString()} •{' '}
                {formatDuration(recording.duration)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Recording metadata */}
            <div className="hidden items-center gap-4 text-sm text-gray-400 sm:flex">
              <span>Pod: {recording.podName}</span>
              <span>•</span>
              <span>User: {recording.userName}</span>
            </div>

            {/* Download button */}
            {recording.downloadUrl && (
              <a
                download
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                href={recording.downloadUrl}
              >
                Download
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Player */}
      <Suspense fallback={<RecordingLoading />}>
        <div className="relative aspect-video w-full">
          <RecordingPlayer
            chapters={recording.chapters}
            duration={recording.duration}
            recordingId={recordingId}
            streamUrl={recording.streamUrl}
            thumbnailUrl={recording.thumbnailUrl}
          />
        </div>
      </Suspense>

      {/* Details section */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Session info */}
          <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Session Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">Session ID</dt>
                <dd className="font-mono text-white">{recording.sessionId.slice(0, 8)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Pod</dt>
                <dd className="text-white">{recording.podName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">User</dt>
                <dd className="text-white">{recording.userName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Recorded</dt>
                <dd className="text-white">{new Date(recording.recordedAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Duration</dt>
                <dd className="text-white">{formatDuration(recording.duration)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Resolution</dt>
                <dd className="text-white">{recording.resolution}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Size</dt>
                <dd className="text-white">{formatFileSize(recording.fileSize)}</dd>
              </div>
            </dl>
          </div>

          {/* Chapters */}
          {recording.chapters && recording.chapters.length > 0 && (
            <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Chapters</h2>
              <ul className="space-y-2">
                {recording.chapters.map((chapter) => (
                  <li key={`chapter-${chapter.startTime}`}>
                    <button
                      className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-gray-700"
                      onClick={() => {
                        // Seek to chapter
                        const event = new CustomEvent('seek-to-time', {
                          detail: { time: chapter.startTime },
                        });
                        globalThis.dispatchEvent(event);
                      }}
                    >
                      <span className="text-white">{chapter.title}</span>
                      <span className="text-sm text-gray-400">{formatTime(chapter.startTime)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Audit log */}
          <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Activity Log</h2>
            {recording.auditLog && recording.auditLog.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {recording.auditLog.slice(0, 10).map((entry) => (
                  <li key={`audit-${entry.timestamp}`} className="flex items-start gap-2">
                    <span className="text-gray-500">{formatTime(entry.timestamp)}</span>
                    <span className="text-gray-300">{entry.action}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No activity recorded</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// ============================================================================
// METADATA
// ============================================================================

export async function generateMetadata({ params }: RecordingPageProps) {
  const { recordingId } = await params;
  const recording = await getRecordingDetails(recordingId);

  if (!recording) {
    return {
      title: 'Recording Not Found | SkillPod',
    };
  }

  return {
    title: `${recording.name} | SkillPod Recording`,
    description: `Recording of ${recording.podName} session from ${new Date(recording.recordedAt).toLocaleDateString()}`,
  };
}
