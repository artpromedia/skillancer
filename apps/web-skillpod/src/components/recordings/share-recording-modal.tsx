/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Share Recording Modal Component
 *
 * Modal for sharing session recordings with access controls,
 * expiry settings, and watermark requirements.
 *
 * @module components/recordings/share-recording-modal
 */

import {
  X,
  Link,
  Mail,
  Copy,
  Check,
  Clock,
  Shield,
  Eye,
  Download,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type ShareMethod = 'link' | 'email' | 'compliance';
type AccessLevel = 'view' | 'view_download';

interface Recording {
  id: string;
  podName: string;
  userName: string;
  startTime: Date;
  duration: number;
}

interface ShareSettings {
  method: ShareMethod;
  recipients: string[];
  accessLevel: AccessLevel;
  expiresIn: number | null; // hours, null = never
  requireWatermark: boolean;
  timeRestriction: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
  };
  notifyOnAccess: boolean;
}

interface ShareRecordingModalProps {
  recording: Recording;
  isOpen: boolean;
  onClose: () => void;
  onShare: (settings: ShareSettings) => Promise<{ shareUrl?: string; success: boolean }>;
}

// ============================================================================
// Constants
// ============================================================================

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
  { value: 720, label: '30 days' },
  { value: null, label: 'Never expires' },
];

const ACCESS_LEVELS = [
  {
    value: 'view',
    label: 'View only',
    description: 'Recipients can watch the recording but cannot download',
    icon: Eye,
  },
  {
    value: 'view_download',
    label: 'View & Download',
    description: 'Recipients can watch and download the recording',
    icon: Download,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function MethodSelector({
  method,
  onChange,
}: Readonly<{
  method: ShareMethod;
  onChange: (method: ShareMethod) => void;
}>) {
  const methods = [
    { value: 'link', label: 'Generate Link', icon: Link },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'compliance', label: 'Add to Report', icon: FileText },
  ] as const;

  return (
    <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {methods.map((m) => (
        <button
          key={m.value}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm transition-colors ${
            method === m.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
          onClick={() => onChange(m.value)}
        >
          <m.icon className="h-4 w-4" />
          {m.label}
        </button>
      ))}
    </div>
  );
}

function RecipientInput({
  recipients,
  onChange,
}: Readonly<{
  recipients: string[];
  onChange: (recipients: string[]) => void;
}>) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const email = input.trim();
    if (!email) return;

    if (!validateEmail(email)) {
      setError('Invalid email address');
      return;
    }

    if (recipients.includes(email)) {
      setError('Email already added');
      return;
    }

    onChange([...recipients, email]);
    setInput('');
    setError(null);
  };

  const handleRemove = (email: string) => {
    onChange(recipients.filter((r) => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <label
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        htmlFor="share-recipients-email"
      >
        Recipients
      </label>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          id="share-recipients-email"
          placeholder="Enter email address"
          type="email"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {recipients.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {recipients.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            >
              {email}
              <button
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => handleRemove(email)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AccessLevelSelector({
  accessLevel,
  onChange,
}: Readonly<{
  accessLevel: AccessLevel;
  onChange: (level: AccessLevel) => void;
}>) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Access Level
      </span>
      <div className="space-y-2">
        {ACCESS_LEVELS.map((level) => (
          <label
            key={level.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              accessLevel === level.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
          >
            <span className="sr-only">{level.label}</span>
            <input
              checked={accessLevel === level.value}
              className="mt-1"
              name="accessLevel"
              type="radio"
              value={level.value}
              onChange={() => onChange(level.value as 'view' | 'view_download')}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <level.icon className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-900 dark:text-white">{level.label}</span>
              </div>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{level.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function ExpirySelector({
  expiresIn,
  onChange,
}: Readonly<{
  expiresIn: number | null;
  onChange: (hours: number | null) => void;
}>) {
  return (
    <div className="space-y-2">
      <label
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        htmlFor="share-link-expiry"
      >
        Link Expiry
      </label>
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          id="share-link-expiry"
          value={expiresIn ?? 'never'}
          onChange={(e) =>
            onChange(e.target.value === 'never' ? null : Number.parseInt(e.target.value, 10))
          }
        >
          {EXPIRY_OPTIONS.map((option) => (
            <option key={option.value ?? 'never'} value={option.value ?? 'never'}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TimeRestriction({
  enabled,
  startTime,
  endTime,
  onToggle,
  onChange,
}: Readonly<{
  enabled: boolean;
  startTime?: string;
  endTime?: string;
  onToggle: () => void;
  onChange: (start: string, end: string) => void;
}>) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <input
          checked={enabled}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          type="checkbox"
          onChange={onToggle}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Restrict viewing hours
        </span>
      </label>
      {enabled && (
        <div className="ml-6 flex items-center gap-2">
          <input
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            type="time"
            value={startTime || '09:00'}
            onChange={(e) => onChange(e.target.value, endTime || '17:00')}
          />
          <span className="text-gray-500">to</span>
          <input
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            type="time"
            value={endTime || '17:00'}
            onChange={(e) => onChange(startTime || '09:00', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function ShareLinkResult({
  shareUrl,
  onCopy,
  copied,
}: Readonly<{
  shareUrl: string;
  onCopy: () => void;
  copied: boolean;
}>) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
      <div className="mb-2 flex items-center gap-2 text-green-800 dark:text-green-400">
        <Check className="h-5 w-5" />
        <span className="font-medium">Share link generated</span>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          type="text"
          value={shareUrl}
        />
        <button
          className={`flex items-center gap-1 rounded-lg px-4 py-2 transition-colors ${
            copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          onClick={onCopy}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ShareRecordingModal({
  recording,
  isOpen,
  onClose,
  onShare,
}: Readonly<ShareRecordingModalProps>) {
  const [settings, setSettings] = useState<ShareSettings>({
    method: 'link',
    recipients: [],
    accessLevel: 'view',
    expiresIn: 168, // 7 days
    requireWatermark: true,
    timeRestriction: { enabled: false },
    notifyOnAccess: true,
  });

  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    if (settings.method === 'email' && settings.recipients.length === 0) {
      setError('Please add at least one recipient');
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      const result = await onShare(settings);
      if (result.success) {
        if (result.shareUrl) {
          setShareUrl(result.shareUrl);
        } else {
          // For email or compliance, just close
          onClose();
        }
      } else {
        setError('Failed to share recording');
      }
    } catch (err) {
      console.error('Share error:', err);
      setError('An error occurred while sharing');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Share Recording</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {recording.podName} • {recording.userName} • {formatDuration(recording.duration)}
            </p>
          </div>
          <button
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          {shareUrl ? (
            <ShareLinkResult copied={copied} shareUrl={shareUrl} onCopy={handleCopy} />
          ) : (
            <>
              {/* Share Method */}
              <MethodSelector
                method={settings.method}
                onChange={(method) => setSettings({ ...settings, method })}
              />

              {/* Recipients (for email) */}
              {settings.method === 'email' && (
                <RecipientInput
                  recipients={settings.recipients}
                  onChange={(recipients) => setSettings({ ...settings, recipients })}
                />
              )}

              {/* Access Level */}
              <AccessLevelSelector
                accessLevel={settings.accessLevel}
                onChange={(accessLevel) => setSettings({ ...settings, accessLevel })}
              />

              {/* Expiry */}
              {settings.method !== 'compliance' && (
                <ExpirySelector
                  expiresIn={settings.expiresIn}
                  onChange={(expiresIn) => setSettings({ ...settings, expiresIn })}
                />
              )}

              {/* Time Restriction */}
              <TimeRestriction
                enabled={settings.timeRestriction.enabled}
                endTime={settings.timeRestriction.endTime}
                startTime={settings.timeRestriction.startTime}
                onChange={(startTime, endTime) =>
                  setSettings({
                    ...settings,
                    timeRestriction: { enabled: true, startTime, endTime },
                  })
                }
                onToggle={() =>
                  setSettings({
                    ...settings,
                    timeRestriction: {
                      ...settings.timeRestriction,
                      enabled: !settings.timeRestriction.enabled,
                    },
                  })
                }
              />

              {/* Watermark */}
              <label className="flex items-center gap-2">
                <input
                  checked={settings.requireWatermark}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  type="checkbox"
                  onChange={(e) => setSettings({ ...settings, requireWatermark: e.target.checked })}
                />
                <Shield className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Require watermark overlay
                </span>
              </label>

              {/* Notify on access */}
              <label className="flex items-center gap-2">
                <input
                  checked={settings.notifyOnAccess}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  type="checkbox"
                  onChange={(e) => setSettings({ ...settings, notifyOnAccess: e.target.checked })}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Notify me when accessed
                </span>
              </label>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between rounded-b-xl border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Shield className="h-3 w-3" />
            All access is logged for audit
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={handleClose}
            >
              {shareUrl ? 'Close' : 'Cancel'}
            </button>
            {!shareUrl && (
              <button
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isSharing}
                onClick={handleShare}
              >
                {isSharing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sharing...
                  </>
                ) : (
                  <>
                    {settings.method === 'link' && <Link className="h-4 w-4" />}
                    {settings.method === 'email' && <Mail className="h-4 w-4" />}
                    {settings.method === 'compliance' && <FileText className="h-4 w-4" />}
                    {(() => {
                      if (settings.method === 'link') return 'Generate Link';
                      if (settings.method === 'email') return 'Send Email';
                      return 'Add to Report';
                    })()}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareRecordingModal;
