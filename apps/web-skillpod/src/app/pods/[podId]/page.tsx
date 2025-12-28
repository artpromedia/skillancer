/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import Link from 'next/link';
import { Suspense } from 'react';

import { PodDetails } from '@/components/pods/pod-details';
import { PodSessionLauncher } from '@/components/pods/pod-session-launcher';
import { podsApi, type PodDetails as PodDetailsType } from '@/lib/api/pods';

// ============================================================================
// TYPES
// ============================================================================

interface PodPageProps {
  params: Promise<{
    podId: string;
  }>;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getPodDetails(podId: string): Promise<PodDetailsType | null> {
  try {
    return await podsApi.getPodDetails(podId);
  } catch (error) {
    console.error('Failed to fetch pod details:', error);
    return null;
  }
}

// ============================================================================
// LOADING STATE
// ============================================================================

function PodLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
        <p className="text-white/70">Loading pod details...</p>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

function PodError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="max-w-md rounded-lg bg-red-900/20 p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-400">Pod Not Found</h1>
        <p className="mb-6 text-gray-400">{message}</p>
        <Link
          className="inline-block rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
          href="/pods"
        >
          Back to Pods
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default async function PodPage({ params }: Readonly<PodPageProps>) {
  const { podId } = await params;

  const pod = await getPodDetails(podId);

  if (!pod) {
    return (
      <PodError message="The pod you're looking for doesn't exist or you don't have access." />
    );
  }

  // Determine status badge color
  const getStatusColor = () => {
    switch (pod.status) {
      case 'running':
        return 'bg-green-500';
      case 'starting':
        return 'animate-pulse bg-yellow-500';
      case 'stopped':
        return 'bg-gray-500';
      default:
        return 'bg-red-500';
    }
  };

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link className="text-gray-400 hover:text-white" href="/pods">
              ← Back to Pods
            </Link>
            <div className="h-6 w-px bg-gray-700" />
            <div>
              <h1 className="text-lg font-semibold text-white">{pod.name}</h1>
              <p className="text-sm text-gray-400">{pod.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Pod status badge */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
              <span className="text-sm capitalize text-gray-400">{pod.status}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <Suspense fallback={<PodLoading />}>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Pod Details */}
            <div className="lg:col-span-2">
              <PodDetails pod={pod} />
            </div>

            {/* Session Launcher */}
            <div className="space-y-6">
              <PodSessionLauncher
                activeSessionId={pod.activeSessionId}
                containmentLevel={pod.containmentLevel}
                podId={podId}
                podStatus={pod.status}
              />

              {/* Recent Sessions */}
              {pod.recentSessions && pod.recentSessions.length > 0 && (
                <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-white">Recent Sessions</h3>
                  <ul className="space-y-3">
                    {pod.recentSessions.slice(0, 5).map((session) => (
                      <li key={session.id}>
                        <Link
                          className="flex items-center justify-between rounded-lg bg-gray-700/50 p-3 hover:bg-gray-700"
                          href={`/viewer/${session.id}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-white">
                              {new Date(session.startTime).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-400">
                              Duration: {formatDuration(session.duration)}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500">{session.status}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recordings link */}
              {pod.hasRecordings && (
                <Link
                  className="block rounded-lg border border-gray-800 bg-gray-800/50 p-4 text-center hover:border-gray-700"
                  href={`/recordings?podId=${podId}`}
                >
                  <span className="text-sm text-gray-400">View session recordings →</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </Suspense>
    </main>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// METADATA
// ============================================================================

export async function generateMetadata({ params }: PodPageProps) {
  const { podId } = await params;
  const pod = await getPodDetails(podId);

  if (!pod) {
    return {
      title: 'Pod Not Found | SkillPod',
    };
  }

  return {
    title: `${pod.name} | SkillPod`,
    description: pod.description,
  };
}
