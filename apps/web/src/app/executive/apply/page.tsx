'use client';

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  BriefcaseIcon,
  UserCircleIcon,
  DocumentCheckIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Executive types
const EXECUTIVE_TYPES = [
  { value: 'FRACTIONAL_CTO', label: 'Fractional CTO', description: 'Chief Technology Officer' },
  { value: 'FRACTIONAL_CFO', label: 'Fractional CFO', description: 'Chief Financial Officer' },
  { value: 'FRACTIONAL_CMO', label: 'Fractional CMO', description: 'Chief Marketing Officer' },
  {
    value: 'FRACTIONAL_CISO',
    label: 'Fractional CISO',
    description: 'Chief Information Security Officer',
  },
  { value: 'FRACTIONAL_COO', label: 'Fractional COO', description: 'Chief Operating Officer' },
  {
    value: 'FRACTIONAL_CHRO',
    label: 'Fractional CHRO',
    description: 'Chief Human Resources Officer',
  },
  { value: 'FRACTIONAL_CPO', label: 'Fractional CPO', description: 'Chief Product Officer' },
  { value: 'FRACTIONAL_CRO', label: 'Fractional CRO', description: 'Chief Revenue Officer' },
  { value: 'FRACTIONAL_CLO', label: 'Fractional CLO', description: 'Chief Legal Officer' },
  { value: 'FRACTIONAL_CDO', label: 'Fractional CDO', description: 'Chief Data Officer' },
  { value: 'BOARD_ADVISOR', label: 'Board Advisor', description: 'Board of Directors / Advisory' },
  {
    value: 'INTERIM_EXECUTIVE',
    label: 'Interim Executive',
    description: 'Full-time interim leadership',
  },
];

const COMPANY_STAGES = [
  { value: 'PRE_SEED', label: 'Pre-Seed', description: 'Idea stage' },
  { value: 'SEED', label: 'Seed', description: 'Early product' },
  { value: 'SERIES_A', label: 'Series A', description: 'Product-market fit' },
  { value: 'SERIES_B', label: 'Series B', description: 'Scaling' },
  { value: 'SERIES_C_PLUS', label: 'Series C+', description: 'Growth' },
  { value: 'GROWTH', label: 'Growth', description: 'Late stage' },
  { value: 'ENTERPRISE', label: 'Enterprise', description: 'Large organizations' },
  { value: 'PUBLIC', label: 'Public', description: 'Public companies' },
  { value: 'TURNAROUND', label: 'Turnaround', description: 'Restructuring' },
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'E-commerce',
  'SaaS',
  'Manufacturing',
  'Real Estate',
  'Education',
  'Media & Entertainment',
  'Consumer Products',
  'Energy',
  'Telecommunications',
  'Retail',
];

interface FormData {
  // Step 1: Role Selection
  executiveType: string;
  headline: string;
  yearsExecutiveExp: number;

  // Step 2: Experience
  industriesServed: string[];
  companyStagesServed: string[];
  specializations: string[];
  linkedinUrl: string;

  // Step 3: Availability & Pricing
  hoursPerWeekMin: number;
  hoursPerWeekMax: number;
  hourlyRateMin: number;
  hourlyRateMax: number;
  monthlyRateMin: number;
  monthlyRateMax: number;
  availableStartDate: string;
  timezone: string;
  remoteOnly: boolean;
  willingToTravel: boolean;

  // Step 4: Bio
  bio: string;
}

const initialFormData: FormData = {
  executiveType: '',
  headline: '',
  yearsExecutiveExp: 5,
  industriesServed: [],
  companyStagesServed: [],
  specializations: [],
  linkedinUrl: '',
  hoursPerWeekMin: 10,
  hoursPerWeekMax: 30,
  hourlyRateMin: 250,
  hourlyRateMax: 500,
  monthlyRateMin: 5000,
  monthlyRateMax: 20000,
  availableStartDate: '',
  timezone: '',
  remoteOnly: false,
  willingToTravel: true,
  bio: '',
};

const STEPS = [
  { id: 1, name: 'Role', icon: UserCircleIcon },
  { id: 2, name: 'Experience', icon: BriefcaseIcon },
  { id: 3, name: 'Availability', icon: CurrencyDollarIcon },
  { id: 4, name: 'Bio', icon: DocumentCheckIcon },
];

export default function ExecutiveApplyPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const toggleArrayItem = (field: keyof FormData, value: string) => {
    const current = formData[field] as string[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFormData({ [field]: updated });
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/executives/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit application');
      }

      router.push('/executive/vetting/status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2" href="/">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
              <span className="text-xl font-bold text-white">S</span>
            </div>
            <span className="text-xl font-semibold text-slate-900">Skillancer</span>
          </Link>
          <div className="text-sm text-slate-600">
            Already a member?{' '}
            <Link className="font-medium text-indigo-600 hover:text-indigo-500" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Join Our Elite Executive Network</h1>
          <p className="mt-2 text-slate-600">
            We carefully vet every executive to ensure the highest quality for our clients.
          </p>
        </div>

        {/* Progress Steps */}
        <nav className="mb-8">
          <ol className="flex items-center justify-center space-x-8">
            {STEPS.map((step, index) => {
              const isComplete = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <li key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center rounded-full p-3 ${
                      isComplete
                        ? 'bg-indigo-600 text-white'
                        : isCurrent
                          ? 'border-2 border-indigo-600 bg-white text-indigo-600'
                          : 'border-2 border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircleIcon className="h-6 w-6" />
                    ) : (
                      <step.icon className="h-6 w-6" />
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      isCurrent ? 'text-indigo-600' : 'text-slate-500'
                    }`}
                  >
                    {step.name}
                  </span>
                  {index < STEPS.length - 1 && <div className="ml-8 h-0.5 w-16 bg-slate-300" />}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Step 1: Role Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">
                What type of executive are you?
              </h2>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {EXECUTIVE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      formData.executiveType === type.value
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    type="button"
                    onClick={() => updateFormData({ executiveType: type.value })}
                  >
                    <div className="font-medium text-slate-900">{type.label}</div>
                    <div className="text-sm text-slate-500">{type.description}</div>
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Professional Headline *
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  maxLength={200}
                  placeholder="e.g., Seasoned CTO with 15+ years scaling B2B SaaS platforms"
                  type="text"
                  value={formData.headline}
                  onChange={(e) => updateFormData({ headline: e.target.value })}
                />
                <p className="mt-1 text-sm text-slate-500">
                  {formData.headline.length}/200 characters
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Years of Executive Experience *
                </label>
                <input
                  className="w-32 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  max={50}
                  min={3}
                  type="number"
                  value={formData.yearsExecutiveExp}
                  onChange={(e) => updateFormData({ yearsExecutiveExp: Number.parseInt(e.target.value) })}
                />
                <p className="mt-1 text-sm text-slate-500">Minimum 3 years required</p>
              </div>
            </div>
          )}

          {/* Step 2: Experience */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Tell us about your experience
              </h2>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Industries You&apos;ve Served *
                </label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((industry) => (
                    <button
                      key={industry}
                      className={`rounded-full px-4 py-2 text-sm transition-all ${
                        formData.industriesServed.includes(industry)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      type="button"
                      onClick={() => toggleArrayItem('industriesServed', industry)}
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Company Stages You Excel With *
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {COMPANY_STAGES.map((stage) => (
                    <button
                      key={stage.value}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        formData.companyStagesServed.includes(stage.value)
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      type="button"
                      onClick={() => toggleArrayItem('companyStagesServed', stage.value)}
                    >
                      <div className="font-medium text-slate-900">{stage.label}</div>
                      <div className="text-xs text-slate-500">{stage.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  LinkedIn Profile URL *
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://linkedin.com/in/yourprofile"
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => updateFormData({ linkedinUrl: e.target.value })}
                />
                <p className="mt-1 text-sm text-slate-500">
                  We&apos;ll verify your profile via LinkedIn OAuth
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Availability & Pricing */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">Availability & Rates</h2>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Hours per Week
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                      max={60}
                      min={5}
                      type="number"
                      value={formData.hoursPerWeekMin}
                      onChange={(e) =>
                        updateFormData({ hoursPerWeekMin: Number.parseInt(e.target.value) })
                      }
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                      max={60}
                      min={5}
                      type="number"
                      value={formData.hoursPerWeekMax}
                      onChange={(e) =>
                        updateFormData({ hoursPerWeekMax: Number.parseInt(e.target.value) })
                      }
                    />
                    <span className="text-slate-500">hrs/week</span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Hourly Rate (USD)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">$</span>
                    <input
                      className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                      min={100}
                      step={25}
                      type="number"
                      value={formData.hourlyRateMin}
                      onChange={(e) => updateFormData({ hourlyRateMin: Number.parseInt(e.target.value) })}
                    />
                    <span className="text-slate-500">to $</span>
                    <input
                      className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                      min={100}
                      step={25}
                      type="number"
                      value={formData.hourlyRateMax}
                      onChange={(e) => updateFormData({ hourlyRateMax: Number.parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Available to Start
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 sm:w-auto"
                  value={formData.availableStartDate}
                  onChange={(e) => updateFormData({ availableStartDate: e.target.value })}
                >
                  <option value="">Select availability</option>
                  <option value="immediate">Immediately</option>
                  <option value="1_week">Within 1 week</option>
                  <option value="2_weeks">Within 2 weeks</option>
                  <option value="1_month">Within 1 month</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Timezone</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 sm:w-auto"
                  value={formData.timezone}
                  onChange={(e) => updateFormData({ timezone: e.target.value })}
                >
                  <option value="">Select timezone</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Central European (CET)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    checked={formData.remoteOnly}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    type="checkbox"
                    onChange={(e) => updateFormData({ remoteOnly: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Remote work only</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    checked={formData.willingToTravel}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    type="checkbox"
                    onChange={(e) => updateFormData({ willingToTravel: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Willing to travel</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Bio */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">Tell Your Story</h2>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Professional Bio *
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  maxLength={3000}
                  minLength={100}
                  placeholder="Share your executive journey, key accomplishments, leadership philosophy, and what makes you uniquely qualified to help companies succeed..."
                  rows={8}
                  value={formData.bio}
                  onChange={(e) => updateFormData({ bio: e.target.value })}
                />
                <p className="mt-1 text-sm text-slate-500">
                  {formData.bio.length}/3000 characters (minimum 100)
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 p-4">
                <h3 className="font-medium text-amber-800">What happens next?</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
                  <li>We&apos;ll review your application within 2-3 business days</li>
                  <li>
                    If you pass initial screening, you&apos;ll be invited to a video interview
                  </li>
                  <li>We&apos;ll request 3 professional references</li>
                  <li>Background check through our partner Checkr</li>
                  <li>Final review and approval by our talent team</li>
                </ul>
              </div>

              {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
            <button
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              disabled={currentStep === 1}
              type="button"
              onClick={prevStep}
            >
              <ArrowLeftIcon className="h-5 w-5" />
              Back
            </button>

            {currentStep < 4 ? (
              <button
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
                type="button"
                onClick={nextStep}
              >
                Continue
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={isSubmitting || formData.bio.length < 100}
                type="button"
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
                <CheckCircleIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
