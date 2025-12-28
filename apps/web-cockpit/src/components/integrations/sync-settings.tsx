/* eslint-disable @typescript-eslint/no-misused-promises */
'use client';

import { cn } from '@skillancer/ui';
import {
  Settings,
  Clock,
  RefreshCw,
  Bell,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

interface SyncSettingsProps {
  platform: {
    id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
    status: 'connected' | 'disconnected' | 'error' | 'syncing';
    lastSync?: string;
  };
  onDisconnect?: () => void;
  onSyncNow?: () => void;
}

export function SyncSettings({ platform, onDisconnect, onSyncNow }: Readonly<SyncSettingsProps>) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    autoSync: true,
    syncFrequency: 'hourly' as 'realtime' | 'hourly' | 'daily' | 'weekly',
    syncClients: true,
    syncProjects: true,
    syncEarnings: true,
    syncMessages: false,
    notifyOnNewClient: true,
    notifyOnNewProject: true,
    notifyOnSyncError: true,
    conflictResolution: 'ask' as 'local' | 'remote' | 'ask',
  });

  const handleSyncNow = async () => {
    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSyncing(false);
    onSyncNow?.();
  };

  const handleDisconnect = () => {
    setShowDisconnectConfirm(false);
    onDisconnect?.();
  };

  const syncFrequencyOptions = [
    { value: 'realtime', label: 'Real-time', description: 'Instant updates via webhooks' },
    { value: 'hourly', label: 'Hourly', description: 'Every hour on the hour' },
    { value: 'daily', label: 'Daily', description: 'Once per day at midnight' },
    { value: 'weekly', label: 'Weekly', description: 'Every Monday at midnight' },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: `${platform.color}15` }}
          >
            {platform.icon}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{platform.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {platform.status === 'connected' && (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Connected</span>
                  {platform.lastSync && (
                    <>
                      <span>•</span>
                      <span>Last sync: {new Date(platform.lastSync).toLocaleString()}</span>
                    </>
                  )}
                </>
              )}
              {platform.status === 'syncing' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span>Syncing...</span>
                </>
              )}
              {platform.status === 'error' && (
                <>
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span className="text-red-600">Sync error</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-400" />
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-6 border-t border-gray-100 p-4">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isSyncing ? 'bg-blue-50 text-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
              disabled={isSyncing}
              onClick={handleSyncNow}
            >
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              onClick={() => setShowDisconnectConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              Disconnect
            </button>
          </div>

          {/* Sync Frequency */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Sync Frequency</h4>
              <label className="flex items-center gap-2 text-sm" htmlFor="auto-sync-toggle">
                <input
                  checked={settings.autoSync}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  id="auto-sync-toggle"
                  type="checkbox"
                  onChange={(e) => setSettings({ ...settings, autoSync: e.target.checked })}
                />
                <span className="text-gray-600">Auto-sync enabled</span>
              </label>
            </div>
            {settings.autoSync && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {syncFrequencyOptions.map((option) => (
                  <button
                    key={option.value}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      settings.syncFrequency === option.value
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        syncFrequency: option.value as typeof settings.syncFrequency,
                      })
                    }
                  >
                    <div className="text-sm font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Data to Sync */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Data to Sync</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'syncClients', label: 'Clients', description: 'Names, contact info' },
                { key: 'syncProjects', label: 'Projects', description: 'Contracts, milestones' },
                { key: 'syncEarnings', label: 'Earnings', description: 'Payments, invoices' },
                { key: 'syncMessages', label: 'Messages', description: 'Chat history' },
              ].map((item) => (
                <label
                  key={item.key}
                  aria-label={`Sync ${item.label}: ${item.description}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    settings[item.key as keyof typeof settings]
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <input
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                    type="checkbox"
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-400" />
              <h4 className="font-medium text-gray-900">Notifications</h4>
            </div>
            <div className="space-y-2">
              {[
                { key: 'notifyOnNewClient', label: 'New client imported' },
                { key: 'notifyOnNewProject', label: 'New project imported' },
                { key: 'notifyOnSyncError', label: 'Sync errors' },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <input
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    type="checkbox"
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Conflict Resolution */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Conflict Resolution</h4>
            <p className="text-sm text-gray-500">
              When data differs between Skillancer and {platform.name}:
            </p>
            <div className="flex gap-2">
              {[
                { value: 'ask', label: 'Ask me' },
                { value: 'local', label: 'Keep Skillancer data' },
                { value: 'remote', label: `Use ${platform.name} data` },
              ].map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    settings.conflictResolution === option.value
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  )}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      conflictResolution: option.value as typeof settings.conflictResolution,
                    })
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sync History */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <h4 className="font-medium text-gray-900">Recent Syncs</h4>
            </div>
            <div className="space-y-2">
              {[
                { time: '2024-12-26T10:30:00Z', status: 'success', items: '3 clients, 5 projects' },
                { time: '2024-12-26T09:30:00Z', status: 'success', items: '0 clients, 2 projects' },
                { time: '2024-12-26T08:30:00Z', status: 'success', items: '1 client, 0 projects' },
              ].map((sync) => (
                <div key={sync.time} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600">{new Date(sync.time).toLocaleString()}</span>
                  </div>
                  <span className="text-gray-500">{sync.items}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Disconnect {platform.name}?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Disconnecting will stop all syncing. Your imported data will remain in Skillancer, but
              will no longer receive updates from {platform.name}.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                onClick={() => setShowDisconnectConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyncSettings;
