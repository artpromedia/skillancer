/* eslint-disable @typescript-eslint/no-misused-promises */
'use client';

import { cn } from '@skillancer/ui';
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Shield,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';

interface PlatformConnectFlowProps {
  platform: {
    id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
    features: string[];
  };
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'intro' | 'auth' | 'permissions' | 'import' | 'complete';

export function PlatformConnectFlow({
  platform,
  onClose,
  onSuccess,
}: Readonly<PlatformConnectFlowProps>) {
  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'clients',
    'projects',
    'earnings',
  ]);
  const [importOptions, setImportOptions] = useState({
    importClients: true,
    importProjects: true,
    importEarnings: true,
    autoSync: true,
    syncFrequency: 'hourly' as 'realtime' | 'hourly' | 'daily',
  });
  const [importProgress, setImportProgress] = useState(0);

  const steps: { id: Step; label: string }[] = [
    { id: 'intro', label: 'Introduction' },
    { id: 'auth', label: 'Authenticate' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'import', label: 'Import' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleAuth = async () => {
    setIsLoading(true);
    // Simulate OAuth flow
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);
    setCurrentStep('permissions');
  };

  const handleStartImport = async () => {
    setCurrentStep('import');
    // Simulate import progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setImportProgress(i);
    }
    setCurrentStep('complete');
  };

  const permissions = [
    {
      id: 'clients',
      label: 'Client Information',
      description: 'Names, contact details, and company info',
    },
    {
      id: 'projects',
      label: 'Projects & Contracts',
      description: 'Active and past projects, milestones',
    },
    {
      id: 'earnings',
      label: 'Earnings & Payments',
      description: 'Invoice history and payment records',
    },
    { id: 'messages', label: 'Messages', description: 'Communication history with clients' },
    {
      id: 'reviews',
      label: 'Reviews & Ratings',
      description: 'Client feedback and job success scores',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${platform.color}15` }}
            >
              {platform.icon}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Connect {platform.name}</h2>
              <p className="text-xs text-gray-500">
                Step {currentStepIndex + 1} of {steps.length}
              </p>
            </div>
          </div>
          <button
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 pt-4">
          <div className="flex gap-1">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  index <= currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Intro Step */}
          {currentStep === 'intro' && (
            <div className="space-y-6">
              <div className="text-center">
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                  style={{ backgroundColor: `${platform.color}15` }}
                >
                  {platform.icon}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  Connect your {platform.name} account
                </h3>
                <p className="text-gray-500">
                  Import your clients, projects, and earnings data to manage everything in one
                  place.
                </p>
              </div>

              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <h4 className="font-medium text-gray-900">What you&apos;ll get:</h4>
                {platform.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {feature} sync
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-gray-500">
                <Shield className="h-4 w-4 text-blue-600" />
                <span>Your data is encrypted and never shared</span>
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white transition-colors"
                style={{ backgroundColor: platform.color }}
                onClick={() => setCurrentStep('auth')}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Auth Step */}
          {currentStep === 'auth' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  Authenticate with {platform.name}
                </h3>
                <p className="text-gray-500">
                  You&apos;ll be redirected to {platform.name} to authorize access.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-6 text-center">
                <div className="mb-4 flex items-center justify-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                    🛡️
                  </div>
                  <ArrowRight className="h-6 w-6 text-gray-300" />
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: `${platform.color}15` }}
                  >
                    {platform.icon}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  We use OAuth 2.0 for secure authentication. We never see your password.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200"
                  onClick={() => setCurrentStep('intro')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white transition-colors disabled:opacity-50"
                  disabled={isLoading}
                  style={{ backgroundColor: platform.color }}
                  onClick={handleAuth}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      Open {platform.name}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Permissions Step */}
          {currentStep === 'permissions' && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Select what to import</h3>
                <p className="text-gray-500">
                  Choose which data you&apos;d like to sync from {platform.name}.
                </p>
              </div>

              <div className="space-y-2">
                {permissions.map((permission) => (
                  <label
                    key={permission.id}
                    aria-label={permission.label}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                      selectedPermissions.includes(permission.id)
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <input
                      checked={selectedPermissions.includes(permission.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPermissions([...selectedPermissions, permission.id]);
                        } else {
                          setSelectedPermissions(
                            selectedPermissions.filter((p) => p !== permission.id)
                          );
                        }
                      }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{permission.label}</div>
                      <div className="text-sm text-gray-500">{permission.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="mb-3 font-medium text-gray-900">Sync Settings</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between" htmlFor="auto-sync-enable">
                    <span className="text-sm text-gray-700">Enable automatic sync</span>
                    <input
                      checked={importOptions.autoSync}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      id="auto-sync-enable"
                      type="checkbox"
                      onChange={(e) =>
                        setImportOptions({ ...importOptions, autoSync: e.target.checked })
                      }
                    />
                  </label>
                  {importOptions.autoSync && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Sync frequency</span>
                      <select
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                        value={importOptions.syncFrequency}
                        onChange={(e) =>
                          setImportOptions({
                            ...importOptions,
                            syncFrequency: e.target.value as 'realtime' | 'hourly' | 'daily',
                          })
                        }
                      >
                        <option value="realtime">Real-time</option>
                        <option value="hourly">Every hour</option>
                        <option value="daily">Daily</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200"
                  onClick={() => setCurrentStep('auth')}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white transition-colors disabled:opacity-50"
                  disabled={selectedPermissions.length === 0}
                  style={{ backgroundColor: platform.color }}
                  onClick={handleStartImport}
                >
                  Start Import
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Import Step */}
          {currentStep === 'import' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="relative mx-auto mb-4 h-16 w-16">
                  <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Importing your data...</h3>
                <p className="text-gray-500">
                  This may take a few moments. Please don&apos;t close this window.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">{importProgress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {importProgress >= 20 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Connected to {platform.name}
                  </div>
                )}
                {importProgress >= 50 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Importing clients...
                  </div>
                )}
                {importProgress >= 80 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Importing projects...
                  </div>
                )}
                {importProgress >= 100 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Syncing earnings data...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  Successfully connected!
                </h3>
                <p className="text-gray-500">
                  Your {platform.name} account is now synced with Skillancer.
                </p>
              </div>

              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <h4 className="font-medium text-gray-900">Import Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">12</div>
                    <div className="text-xs text-gray-500">Clients</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">28</div>
                    <div className="text-xs text-gray-500">Projects</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">$24.5k</div>
                    <div className="text-xs text-gray-500">Earnings</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                <span>You may need to review and merge duplicate clients</span>
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white transition-colors"
                style={{ backgroundColor: platform.color }}
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
              >
                View My Clients
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlatformConnectFlow;
