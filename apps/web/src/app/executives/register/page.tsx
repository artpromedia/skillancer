'use client';

import {
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Building2,
  Clock,
  DollarSign,
  CheckCircle,
  Linkedin,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Types
type ExecutiveType =
  | 'FRACTIONAL_CTO'
  | 'FRACTIONAL_CFO'
  | 'FRACTIONAL_CMO'
  | 'FRACTIONAL_CISO'
  | 'FRACTIONAL_COO'
  | 'FRACTIONAL_CHRO'
  | 'FRACTIONAL_CPO'
  | 'FRACTIONAL_CRO'
  | 'BOARD_ADVISOR'
  | 'INTERIM_EXECUTIVE';

interface ExecutiveHistory {
  id: string;
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  companyStage: string;
  companySize: string;
  achievements: string[];
}

interface FormData {
  executiveType: ExecutiveType | null;
  headline: string;
  yearsExecutiveExp: number;
  totalYearsExp: number;
  linkedinUrl: string;
  bio: string;
  history: ExecutiveHistory[];
  industries: string[];
  specializations: string[];
  companyStages: string[];
  companySizes: string[];
  hoursPerWeekMin: number;
  hoursPerWeekMax: number;
  maxClients: number;
  hourlyRateMin: number;
  hourlyRateMax: number;
  monthlyRetainerMin: number;
  monthlyRetainerMax: number;
  availableFrom: string;
  timezone: string;
}

const EXECUTIVE_TYPES: { value: ExecutiveType; label: string; description: string }[] = [
  {
    value: 'FRACTIONAL_CTO',
    label: 'Fractional CTO',
    description: 'Technology strategy, engineering leadership, technical vision',
  },
  {
    value: 'FRACTIONAL_CFO',
    label: 'Fractional CFO',
    description: 'Financial strategy, fundraising, financial operations',
  },
  {
    value: 'FRACTIONAL_CMO',
    label: 'Fractional CMO',
    description: 'Marketing strategy, brand building, growth',
  },
  {
    value: 'FRACTIONAL_COO',
    label: 'Fractional COO',
    description: 'Operations, scaling, process optimization',
  },
  {
    value: 'FRACTIONAL_CISO',
    label: 'Fractional CISO',
    description: 'Security strategy, compliance, risk management',
  },
  {
    value: 'FRACTIONAL_CHRO',
    label: 'Fractional CHRO',
    description: 'People strategy, culture, talent acquisition',
  },
  {
    value: 'FRACTIONAL_CPO',
    label: 'Fractional CPO',
    description: 'Product strategy, roadmap, product-market fit',
  },
  {
    value: 'FRACTIONAL_CRO',
    label: 'Fractional CRO',
    description: 'Revenue strategy, sales leadership, go-to-market',
  },
  {
    value: 'BOARD_ADVISOR',
    label: 'Board Advisor',
    description: 'Strategic guidance, governance, investor relations',
  },
  {
    value: 'INTERIM_EXECUTIVE',
    label: 'Interim Executive',
    description: 'Full-time temporary leadership during transitions',
  },
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'E-commerce',
  'SaaS',
  'Manufacturing',
  'Retail',
  'Education',
  'Real Estate',
  'Energy',
  'Media & Entertainment',
  'Professional Services',
  'Non-profit',
  'Government',
];

const COMPANY_STAGES = [
  { value: 'PRE_SEED', label: 'Pre-seed' },
  { value: 'SEED', label: 'Seed' },
  { value: 'SERIES_A', label: 'Series A' },
  { value: 'SERIES_B', label: 'Series B' },
  { value: 'SERIES_C_PLUS', label: 'Series C+' },
  { value: 'GROWTH', label: 'Growth Stage' },
  { value: 'PUBLIC', label: 'Public Company' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

const STEPS = [
  { id: 1, title: 'Executive Type', icon: Briefcase },
  { id: 2, title: 'Background', icon: Building2 },
  { id: 3, title: 'History', icon: Clock },
  { id: 4, title: 'Expertise', icon: CheckCircle },
  { id: 5, title: 'Availability', icon: DollarSign },
  { id: 6, title: 'Review', icon: CheckCircle },
];

export default function ExecutiveRegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    executiveType: null,
    headline: '',
    yearsExecutiveExp: 0,
    totalYearsExp: 0,
    linkedinUrl: '',
    bio: '',
    history: [],
    industries: [],
    specializations: [],
    companyStages: [],
    companySizes: [],
    hoursPerWeekMin: 5,
    hoursPerWeekMax: 20,
    maxClients: 3,
    hourlyRateMin: 200,
    hourlyRateMax: 500,
    monthlyRetainerMin: 5000,
    monthlyRetainerMax: 15000,
    availableFrom: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const addHistoryEntry = () => {
    const newEntry: ExecutiveHistory = {
      id: crypto.randomUUID(),
      title: '',
      company: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      companyStage: '',
      companySize: '',
      achievements: [''],
    };
    updateFormData({ history: [...formData.history, newEntry] });
  };

  const updateHistoryEntry = (id: string, updates: Partial<ExecutiveHistory>) => {
    updateFormData({
      history: formData.history.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    });
  };

  const removeHistoryEntry = (id: string) => {
    updateFormData({ history: formData.history.filter((h) => h.id !== id) });
  };

  const toggleArrayItem = (field: keyof FormData, value: string) => {
    const current = formData[field] as string[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFormData({ [field]: updated });
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return formData.executiveType !== null;
      case 2:
        return formData.yearsExecutiveExp > 0 && formData.linkedinUrl.includes('linkedin.com');
      case 3:
        return formData.history.length >= 2;
      case 4:
        return formData.industries.length > 0 && formData.companyStages.length > 0;
      case 5:
        return formData.hourlyRateMin > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/executives/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/executives/vetting');
      }
    } catch (error) {
      console.error('Application failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Executive Application</h1>
          <p className="mt-1 text-gray-500">Join Skillancer's vetted executive network</p>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    currentStep > step.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : currentStep === step.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-gray-300 text-gray-400'
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`ml-2 hidden text-sm font-medium sm:block ${
                    currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </span>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-8 sm:w-16 ${
                      currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          {/* Step 1: Executive Type */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  What type of executive are you?
                </h2>
                <p className="mt-1 text-gray-500">
                  Select the role that best describes your expertise
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {EXECUTIVE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    className={`rounded-lg border-2 p-4 text-left transition-colors ${
                      formData.executiveType === type.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateFormData({ executiveType: type.value })}
                  >
                    <p className="font-medium text-gray-900">{type.label}</p>
                    <p className="mt-1 text-sm text-gray-500">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Background */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Professional Background</h2>
                <p className="mt-1 text-gray-500">Tell us about your executive experience</p>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Years of Executive Experience *
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    min="0"
                    type="number"
                    value={formData.yearsExecutiveExp}
                    onChange={(e) =>
                      updateFormData({ yearsExecutiveExp: Number.parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Total Years of Experience *
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    min="0"
                    type="number"
                    value={formData.totalYearsExp}
                    onChange={(e) =>
                      updateFormData({ totalYearsExp: Number.parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <Linkedin className="mr-1 inline h-4 w-4" />
                  LinkedIn Profile URL *
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="https://linkedin.com/in/yourprofile"
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => updateFormData({ linkedinUrl: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Professional Headline
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Fractional CTO | 3x Startup Exit | Enterprise Scale"
                  type="text"
                  value={formData.headline}
                  onChange={(e) => updateFormData({ headline: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief overview of your executive career and what you bring to companies..."
                  rows={4}
                  value={formData.bio}
                  onChange={(e) => updateFormData({ bio: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Step 3: History */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Executive History</h2>
                  <p className="mt-1 text-gray-500">Add at least 2 executive positions</p>
                </div>
                <button
                  className="flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
                  onClick={addHistoryEntry}
                >
                  <Plus className="h-4 w-4" />
                  Add Position
                </button>
              </div>

              {formData.history.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
                  <Briefcase className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <p className="text-gray-500">No positions added yet</p>
                  <button className="mt-4 text-blue-600 hover:underline" onClick={addHistoryEntry}>
                    Add your first executive position
                  </button>
                </div>
              )}

              {formData.history.map((entry, index) => (
                <div key={entry.id} className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">Position {index + 1}</h3>
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeHistoryEntry(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Chief Technology Officer"
                        type="text"
                        value={entry.title}
                        onChange={(e) => updateHistoryEntry(entry.id, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Company
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        type="text"
                        value={entry.company}
                        onChange={(e) => updateHistoryEntry(entry.id, { company: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Start Date
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        type="month"
                        value={entry.startDate}
                        onChange={(e) =>
                          updateHistoryEntry(entry.id, { startDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        End Date
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                        disabled={entry.isCurrent}
                        type="month"
                        value={entry.endDate}
                        onChange={(e) => updateHistoryEntry(entry.id, { endDate: e.target.value })}
                      />
                      <label className="mt-2 flex items-center gap-2">
                        <input
                          checked={entry.isCurrent}
                          className="rounded"
                          type="checkbox"
                          onChange={(e) =>
                            updateHistoryEntry(entry.id, {
                              isCurrent: e.target.checked,
                              endDate: '',
                            })
                          }
                        />
                        <span className="text-sm text-gray-600">Current position</span>
                      </label>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Company Stage
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        value={entry.companyStage}
                        onChange={(e) =>
                          updateHistoryEntry(entry.id, { companyStage: e.target.value })
                        }
                      >
                        <option value="">Select stage...</option>
                        {COMPANY_STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Company Size
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        value={entry.companySize}
                        onChange={(e) =>
                          updateHistoryEntry(entry.id, { companySize: e.target.value })
                        }
                      >
                        <option value="">Select size...</option>
                        {COMPANY_SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s} employees
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {formData.history.length > 0 && formData.history.length < 2 && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <p className="text-yellow-800">
                    Please add at least 2 executive positions to continue
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Expertise */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Expertise & Focus</h2>
                <p className="mt-1 text-gray-500">Define your areas of expertise</p>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">Industries *</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((industry) => (
                    <button
                      key={industry}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        formData.industries.includes(industry)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => toggleArrayItem('industries', industry)}
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                  Company Stages *
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPANY_STAGES.map((stage) => (
                    <button
                      key={stage.value}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        formData.companyStages.includes(stage.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => toggleArrayItem('companyStages', stage.value)}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                  Company Sizes
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPANY_SIZES.map((size) => (
                    <button
                      key={size}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        formData.companySizes.includes(size)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => toggleArrayItem('companySizes', size)}
                    >
                      {size} employees
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Availability & Pricing */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Availability & Pricing</h2>
                <p className="mt-1 text-gray-500">Set your capacity and rates</p>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Hours per Week (Min)
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                    max="40"
                    min="1"
                    type="number"
                    value={formData.hoursPerWeekMin}
                    onChange={(e) =>
                      updateFormData({ hoursPerWeekMin: Number.parseInt(e.target.value) || 5 })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Hours per Week (Max)
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                    max="40"
                    min="1"
                    type="number"
                    value={formData.hoursPerWeekMax}
                    onChange={(e) =>
                      updateFormData({ hoursPerWeekMax: Number.parseInt(e.target.value) || 20 })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Max Concurrent Clients
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                    max="10"
                    min="1"
                    type="number"
                    value={formData.maxClients}
                    onChange={(e) => updateFormData({ maxClients: Number.parseInt(e.target.value) || 3 })}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Available From
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                    type="date"
                    value={formData.availableFrom}
                    onChange={(e) => updateFormData({ availableFrom: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="mb-4 font-medium text-gray-900">Pricing</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Hourly Rate Range (USD)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                        placeholder="Min"
                        type="number"
                        value={formData.hourlyRateMin}
                        onChange={(e) =>
                          updateFormData({ hourlyRateMin: Number.parseInt(e.target.value) || 0 })
                        }
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                        placeholder="Max"
                        type="number"
                        value={formData.hourlyRateMax}
                        onChange={(e) =>
                          updateFormData({ hourlyRateMax: Number.parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Monthly Retainer Range (USD)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                        placeholder="Min"
                        type="number"
                        value={formData.monthlyRetainerMin}
                        onChange={(e) =>
                          updateFormData({ monthlyRetainerMin: Number.parseInt(e.target.value) || 0 })
                        }
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-4 py-2"
                        placeholder="Max"
                        type="number"
                        value={formData.monthlyRetainerMax}
                        onChange={(e) =>
                          updateFormData({ monthlyRetainerMax: Number.parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Review Your Application</h2>
                <p className="mt-1 text-gray-500">
                  Please verify all information before submitting
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 font-medium text-gray-900">Executive Type</h3>
                  <p className="text-gray-600">
                    {EXECUTIVE_TYPES.find((t) => t.value === formData.executiveType)?.label}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 font-medium text-gray-900">Experience</h3>
                  <p className="text-gray-600">
                    {formData.yearsExecutiveExp} years executive, {formData.totalYearsExp} years
                    total
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 font-medium text-gray-900">Executive History</h3>
                  <ul className="space-y-2">
                    {formData.history.map((h) => (
                      <li key={h.id} className="text-gray-600">
                        {h.title} at {h.company}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 font-medium text-gray-900">Rates</h3>
                  <p className="text-gray-600">
                    ${formData.hourlyRateMin} - ${formData.hourlyRateMax}/hour
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-2 font-medium text-blue-900">What happens next?</h3>
                <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800">
                  <li>Our team will review your application (1-2 business days)</li>
                  <li>You'll be invited to a brief screening interview</li>
                  <li>We'll verify your references and background</li>
                  <li>Once approved, your profile becomes searchable</li>
                </ol>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
            <button
              className="flex items-center gap-2 px-4 py-2 text-gray-600 disabled:opacity-50"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            {currentStep < 6 ? (
              <button
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={!canProceed()}
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
