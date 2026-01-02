/**
 * SkillPod Launcher Component
 *
 * Button and modal for launching a SkillPod session
 * from within an executive workspace context.
 */

'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@skillancer/ui';
import { Play, Terminal, Shield, Clock, ExternalLink, Loader2, CheckCircle, X } from 'lucide-react';
import { useState } from 'react';

// Types
interface SkillPodLauncherProps {
  engagementId: string;
  accessLevel: string;
  disabled?: boolean;
}

interface SkillPodSession {
  sessionId: string;
  sessionUrl: string;
  status: 'initializing' | 'ready' | 'active';
  startedAt?: Date;
}

// Access level descriptions
const ACCESS_LEVELS: Record<string, { label: string; description: string; color: string }> = {
  ADMIN: {
    label: 'Admin Access',
    description: 'Full administrative access to client systems',
    color: 'bg-red-100 text-red-800',
  },
  DEVELOPER: {
    label: 'Developer Access',
    description: 'Code access with deployment capabilities',
    color: 'bg-blue-100 text-blue-800',
  },
  VIEWER: {
    label: 'View Only',
    description: 'Read-only access to systems and dashboards',
    color: 'bg-gray-100 text-gray-800',
  },
  CUSTOM: {
    label: 'Custom Access',
    description: 'Custom permissions defined by client',
    color: 'bg-purple-100 text-purple-800',
  },
};

export function SkillPodLauncher({
  engagementId,
  accessLevel,
  disabled = false,
}: SkillPodLauncherProps) {
  const [showModal, setShowModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [session, setSession] = useState<SkillPodSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accessConfig = ACCESS_LEVELS[accessLevel] || ACCESS_LEVELS.CUSTOM;

  const handleLaunch = async () => {
    setIsLaunching(true);
    setError(null);

    try {
      // Simulate API call to launch SkillPod
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock session response
      const mockSession: SkillPodSession = {
        sessionId: crypto.randomUUID(),
        sessionUrl: `https://skillpod.skillancer.dev/session/${crypto.randomUUID()}`,
        status: 'ready',
        startedAt: new Date(),
      };

      setSession(mockSession);
    } catch (err) {
      setError('Failed to launch SkillPod session. Please try again.');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleOpenSession = () => {
    if (session?.sessionUrl) {
      window.open(session.sessionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setSession(null);
    setError(null);
  };

  return (
    <>
      {/* Launch Button */}
      <Button
        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        disabled={disabled}
        onClick={() => setShowModal(true)}
      >
        <Terminal className="mr-2 h-4 w-4" />
        Launch SkillPod
      </Button>

      {/* Launch Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                SkillPod Session
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!session ? (
                <>
                  {/* Pre-launch State */}
                  <div className="py-4 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-600">
                      <Terminal className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">Ready to Launch SkillPod</h3>
                    <p className="text-muted-foreground text-sm">
                      A secure development environment connected to the client&apos;s systems.
                    </p>
                  </div>

                  {/* Access Level */}
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <Shield className="h-4 w-4" />
                        Access Level
                      </span>
                      <Badge className={accessConfig?.color ?? 'bg-gray-100 text-gray-800'}>
                        {accessConfig?.label ?? 'Custom'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {accessConfig?.description ?? 'Custom permissions'}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-sm">
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Session time is automatically tracked</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>All actions are audited and logged</span>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
                      disabled={isLaunching}
                      onClick={handleLaunch}
                    >
                      {isLaunching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Launching...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Launch Session
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Session Ready State */}
                  <div className="py-4 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-green-600">Session Ready!</h3>
                    <p className="text-muted-foreground text-sm">
                      Your SkillPod environment is ready to use.
                    </p>
                  </div>

                  {/* Session Details */}
                  <div className="bg-muted space-y-2 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session ID</span>
                      <span className="font-mono text-xs">{session.sessionId.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span>{session.startedAt?.toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className="bg-green-100 text-green-800">Ready</Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" variant="outline" onClick={handleClose}>
                      Close
                    </Button>
                    <Button className="flex-1" onClick={handleOpenSession}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open SkillPod
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
