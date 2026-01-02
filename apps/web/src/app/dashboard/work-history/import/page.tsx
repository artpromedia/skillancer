'use client';

/**
 * Work History Import Wizard
 * Multi-step wizard for importing work history
 * Sprint M4: Portable Verified Work History
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Upload,
  Link2,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Star,
  Briefcase,
  Building2,
  Globe,
  Shield,
} from 'lucide-react';

type ImportMethod = 'platform' | 'manual' | 'upload';
type WizardStep = 'method' | 'platform' | 'manual' | 'upload' | 'review' | 'complete';

interface ManualEntry {
  id: string;
  title: string;
  client: string;
  platform: string;
  category: string;
  startDate: string;
  endDate: string;
  amount: number;
  currency: string;
  description: string;
  skills: string[];
  outcome: string;
}

const platforms = [
  { id: 'upwork', name: 'Upwork', icon: '💼', connected: true },
  { id: 'fiverr', name: 'Fiverr', icon: '🎨', connected: true },
  { id: 'freelancer', name: 'Freelancer.com', icon: '🌐', connected: false },
  { id: 'toptal', name: 'Toptal', icon: '🔷', connected: false },
  { id: 'guru', name: 'Guru', icon: '🧘', connected: false },
  { id: 'peopleperhour', name: 'PeoplePerHour', icon: '⏰', connected: false },
];

const categories = [
  'Web Development',
  'Mobile Development',
  'UI/UX Design',
  'Graphic Design',
  'Content Writing',
  'Digital Marketing',
  'Data Science',
  'DevOps',
  'Consulting',
  'Other',
];

const skillSuggestions = [
  'JavaScript',
  'TypeScript',
  'React',
  'Vue.js',
  'Angular',
  'Node.js',
  'Python',
  'Django',
  'FastAPI',
  'PostgreSQL',
  'MongoDB',
  'AWS',
  'Docker',
  'Kubernetes',
  'Figma',
  'Adobe XD',
  'Tailwind CSS',
];

export default function ImportWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('method');
  const [method, setMethod] = useState<ImportMethod | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Partial<ManualEntry>>({
    currency: 'USD',
    skills: [],
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'method', label: 'Import Method' },
    {
      id: method === 'platform' ? 'platform' : method === 'manual' ? 'manual' : 'upload',
      label: 'Add Work',
    },
    { id: 'review', label: 'Review' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const handleMethodSelect = (m: ImportMethod) => {
    setMethod(m);
    if (m === 'platform') setStep('platform');
    else if (m === 'manual') setStep('manual');
    else setStep('upload');
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const addManualEntry = () => {
    if (currentEntry.title && currentEntry.client) {
      const entry: ManualEntry = {
        id: `entry-${Date.now()}`,
        title: currentEntry.title || '',
        client: currentEntry.client || '',
        platform: currentEntry.platform || 'Direct Client',
        category: currentEntry.category || 'Other',
        startDate: currentEntry.startDate || '',
        endDate: currentEntry.endDate || '',
        amount: currentEntry.amount || 0,
        currency: currentEntry.currency || 'USD',
        description: currentEntry.description || '',
        skills: currentEntry.skills || [],
        outcome: currentEntry.outcome || '',
      };
      setManualEntries((prev) => [...prev, entry]);
      setCurrentEntry({ currency: 'USD', skills: [] });
    }
  };

  const removeEntry = (id: string) => {
    setManualEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const toggleSkill = (skill: string) => {
    setCurrentEntry((prev) => ({
      ...prev,
      skills: prev.skills?.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...(prev.skills || []), skill],
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleNext = () => {
    if (step === 'platform' || step === 'manual' || step === 'upload') {
      setStep('review');
    } else if (step === 'review') {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setStep('complete');
      }, 2000);
    }
  };

  const handleBack = () => {
    if (step === 'review') {
      if (method === 'platform') setStep('platform');
      else if (method === 'manual') setStep('manual');
      else setStep('upload');
    } else if (step === 'platform' || step === 'manual' || step === 'upload') {
      setStep('method');
      setMethod(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <button
            onClick={() => router.push('/dashboard/work-history')}
            className="flex items-center text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Work History
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Progress Steps */}
        {step !== 'complete' && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.slice(0, 3).map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-medium ${
                      i < currentStepIndex
                        ? 'bg-indigo-600 text-white'
                        : i === currentStepIndex
                          ? 'border-2 border-indigo-600 bg-indigo-100 text-indigo-600'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {i < currentStepIndex ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      i <= currentStepIndex ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {s.label}
                  </span>
                  {i < steps.length - 2 && (
                    <div
                      className={`mx-4 h-0.5 w-24 ${
                        i < currentStepIndex ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {/* Method Selection */}
          {step === 'method' && (
            <div className="p-8">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Import Work History</h2>
              <p className="mb-8 text-gray-600">Choose how you'd like to add your work history</p>

              <div className="grid gap-4">
                <button
                  onClick={() => handleMethodSelect('platform')}
                  className="flex items-start gap-4 rounded-xl border-2 p-6 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                    <Link2 className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Connect Platforms</h3>
                    <p className="mt-1 text-gray-600">
                      Automatically import verified work history from Upwork, Fiverr, and other
                      platforms
                    </p>
                    <div className="mt-3 flex gap-2">
                      <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Highest Verification
                      </span>
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        Automatic
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleMethodSelect('manual')}
                  className="flex items-start gap-4 rounded-xl border-2 p-6 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Manual Entry</h3>
                    <p className="mt-1 text-gray-600">
                      Add work history manually for direct clients or platforms we don't support yet
                    </p>
                    <div className="mt-3 flex gap-2">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        Self-Reported
                      </span>
                      <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                        Upgrade Later
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleMethodSelect('upload')}
                  className="flex items-start gap-4 rounded-xl border-2 p-6 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                    <Upload className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Upload File</h3>
                    <p className="mt-1 text-gray-600">
                      Import from CSV, PDF invoices, or exported data from other platforms
                    </p>
                    <div className="mt-3 flex gap-2">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        CSV, PDF, JSON
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Platform Selection */}
          {step === 'platform' && (
            <div className="p-8">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Select Platforms</h2>
              <p className="mb-8 text-gray-600">
                Choose which platforms to sync. Already connected platforms will refresh their data.
              </p>

              <div className="mb-8 grid grid-cols-2 gap-4">
                {platforms.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      selectedPlatforms.includes(platform.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{platform.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{platform.name}</div>
                      {platform.connected && (
                        <span className="text-xs text-green-600">Connected</span>
                      )}
                    </div>
                    {selectedPlatforms.includes(platform.id) && (
                      <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="rounded-xl border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={selectedPlatforms.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Manual Entry */}
          {step === 'manual' && (
            <div className="p-8">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Add Work History</h2>
              <p className="mb-8 text-gray-600">Enter details about your projects and clients</p>

              {/* Entry Form */}
              <div className="mb-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Project Title *
                    </label>
                    <input
                      type="text"
                      value={currentEntry.title || ''}
                      onChange={(e) => setCurrentEntry({ ...currentEntry, title: e.target.value })}
                      placeholder="e.g., E-commerce Website Redesign"
                      className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      value={currentEntry.client || ''}
                      onChange={(e) => setCurrentEntry({ ...currentEntry, client: e.target.value })}
                      placeholder="e.g., Acme Corp"
                      className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Platform/Source
                    </label>
                    <select
                      value={currentEntry.platform || ''}
                      onChange={(e) =>
                        setCurrentEntry({ ...currentEntry, platform: e.target.value })
                      }
                      className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select platform</option>
                      <option value="Direct Client">Direct Client</option>
                      <option value="Referral">Referral</option>
                      <option value="Agency">Agency</option>
                      {platforms.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                    <select
                      value={currentEntry.category || ''}
                      onChange={(e) =>
                        setCurrentEntry({ ...currentEntry, category: e.target.value })
                      }
                      className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={currentEntry.startDate || ''}
                      onChange={(e) =>
                        setCurrentEntry({ ...currentEntry, startDate: e.target.value })
                      }
                      className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      value={currentEntry.endDate || ''}
                      onChange={(e) =>
                        setCurrentEntry({ ...currentEntry, endDate: e.target.value })
                      }
                      className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Project Value
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        value={currentEntry.amount || ''}
                        onChange={(e) =>
                          setCurrentEntry({ ...currentEntry, amount: parseFloat(e.target.value) })
                        }
                        placeholder="0.00"
                        className="w-full rounded-lg border py-2 pl-10 pr-4 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                    <select
                      value={currentEntry.currency || 'USD'}
                      onChange={(e) =>
                        setCurrentEntry({ ...currentEntry, currency: e.target.value })
                      }
                      className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={currentEntry.description || ''}
                    onChange={(e) =>
                      setCurrentEntry({ ...currentEntry, description: e.target.value })
                    }
                    rows={3}
                    placeholder="Describe the project and your role..."
                    className="w-full rounded-lg border px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Skills Used
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {skillSuggestions.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          currentEntry.skills?.includes(skill)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addManualEntry}
                  disabled={!currentEntry.title || !currentEntry.client}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-3 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                  Add This Project
                </button>
              </div>

              {/* Added Entries */}
              {manualEntries.length > 0 && (
                <div className="mb-8">
                  <h3 className="mb-4 font-semibold text-gray-900">
                    Added Projects ({manualEntries.length})
                  </h3>
                  <div className="space-y-3">
                    {manualEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-4 rounded-xl bg-gray-50 p-4"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                          <Briefcase className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{entry.title}</div>
                          <div className="text-sm text-gray-500">
                            {entry.client} • ${entry.amount.toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="rounded-xl border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={manualEntries.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Review Entries
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* File Upload */}
          {step === 'upload' && (
            <div className="p-8">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Upload Work History</h2>
              <p className="mb-8 text-gray-600">
                Upload a CSV, PDF invoice, or JSON export from another platform
              </p>

              {/* Upload Area */}
              <div className="mb-8">
                <label className="block">
                  <div
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                      uploadedFile
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-indigo-300'
                    }`}
                  >
                    {uploadedFile ? (
                      <>
                        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
                        <div className="font-medium text-gray-900">{uploadedFile.name}</div>
                        <div className="mt-1 text-sm text-gray-500">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setUploadedFile(null);
                          }}
                          className="mt-4 text-sm text-red-600 hover:text-red-700"
                        >
                          Remove file
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                        <div className="font-medium text-gray-900">
                          Drop file here or click to upload
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          Supports CSV, PDF, JSON (max 10MB)
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".csv,.pdf,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Format Guide */}
              <div className="mb-8 rounded-xl bg-gray-50 p-4">
                <h3 className="mb-3 font-medium text-gray-900">Supported Formats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-200 px-2 py-0.5 font-mono">.csv</span>
                    <span className="text-gray-600">
                      Spreadsheet with columns: title, client, amount, date
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-200 px-2 py-0.5 font-mono">.pdf</span>
                    <span className="text-gray-600">
                      Invoices will be parsed automatically (AI-powered)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-200 px-2 py-0.5 font-mono">.json</span>
                    <span className="text-gray-600">
                      Platform export files from supported providers
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="rounded-xl border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!uploadedFile}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Process File
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Review */}
          {step === 'review' && (
            <div className="p-8">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Review Import</h2>
              <p className="mb-8 text-gray-600">Confirm the work history you're about to import</p>

              {/* Summary */}
              <div className="mb-8 grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {method === 'platform' ? selectedPlatforms.length : manualEntries.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    {method === 'platform' ? 'Platforms' : 'Projects'}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    $
                    {method === 'manual'
                      ? manualEntries.reduce((sum, e) => sum + e.amount, 0).toLocaleString()
                      : '0'}
                  </div>
                  <div className="text-sm text-gray-600">Total Value</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {method === 'platform' ? 'Verified' : 'Self-Reported'}
                  </div>
                  <div className="text-sm text-gray-600">Verification Level</div>
                </div>
              </div>

              {/* Details */}
              <div className="mb-8">
                {method === 'platform' && (
                  <div className="space-y-3">
                    {selectedPlatforms.map((pId) => {
                      const p = platforms.find((pl) => pl.id === pId);
                      return p ? (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-xl bg-gray-50 p-4"
                        >
                          <span className="text-2xl">{p.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{p.name}</div>
                            <div className="text-sm text-gray-500">
                              {p.connected
                                ? 'Will sync existing connection'
                                : 'Will prompt for OAuth'}
                            </div>
                          </div>
                          <Shield className="h-5 w-5 text-green-500" />
                        </div>
                      ) : null;
                    })}
                  </div>
                )}

                {method === 'manual' && (
                  <div className="space-y-3">
                    {manualEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-4 rounded-xl bg-gray-50 p-4"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                          <Briefcase className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{entry.title}</div>
                          <div className="text-sm text-gray-500">
                            {entry.client} • ${entry.amount.toLocaleString()} • {entry.category}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {method === 'upload' && uploadedFile && (
                  <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{uploadedFile.name}</div>
                      <div className="text-sm text-gray-500">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • Will be parsed and imported
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning */}
              {method !== 'platform' && (
                <div className="mb-8 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="font-medium text-yellow-800">Self-Reported Data</div>
                    <div className="mt-1 text-sm text-yellow-700">
                      Manually entered work history is marked as "Self-Reported" until verified.
                      Connect platforms to upgrade to "Platform Verified" status.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="rounded-xl border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={isProcessing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Import Work History
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Complete */}
          {step === 'complete' && (
            <div className="p-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Import Complete!</h2>
              <p className="mb-8 text-gray-600">
                Your work history has been imported and is being verified.
              </p>

              <div className="mx-auto flex max-w-md gap-3">
                <button
                  onClick={() => router.push('/dashboard/work-history')}
                  className="flex-1 rounded-xl border border-gray-300 py-3 font-medium hover:bg-gray-50"
                >
                  View Work History
                </button>
                <button
                  onClick={() => router.push('/dashboard/credentials')}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
                >
                  Generate Credentials
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
