/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Create Compliance Report Page
 *
 * Wizard-style form for generating new compliance reports
 * with framework selection, date range, and customization.
 *
 * @module app/compliance/reports/new/page
 */

import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Calendar,
  Settings,
  Clock,
  Shield,
  Database,
  Users,
  Activity,
  AlertTriangle,
  Download,
  Mail,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ReportConfig {
  name: string;
  framework: string;
  dateRange: {
    start: string;
    end: string;
  };
  sections: string[];
  includeEvidence: boolean;
  includeRecommendations: boolean;
  format: 'pdf' | 'excel' | 'json';
  schedule: {
    enabled: boolean;
    frequency: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
    scheduledDate?: string;
  };
  recipients: string[];
}

// ============================================================================
// Constants
// ============================================================================

const FRAMEWORKS = [
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    description: 'Service organization controls for security, availability, and confidentiality',
    icon: Shield,
    sections: [
      'trust_services',
      'security_controls',
      'access_management',
      'incident_response',
      'vendor_management',
    ],
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act compliance',
    icon: Activity,
    sections: [
      'privacy_rule',
      'security_rule',
      'breach_notification',
      'access_controls',
      'audit_controls',
    ],
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    description: 'General Data Protection Regulation for EU data subjects',
    icon: Database,
    sections: [
      'data_processing',
      'consent_management',
      'data_subject_rights',
      'breach_reporting',
      'dpia',
    ],
  },
  {
    id: 'pci',
    name: 'PCI DSS',
    description: 'Payment Card Industry Data Security Standard',
    icon: Shield,
    sections: [
      'network_security',
      'cardholder_data',
      'vulnerability_management',
      'access_control',
      'monitoring',
    ],
  },
  {
    id: 'custom',
    name: 'Custom Report',
    description: 'Create a custom compliance report with selected sections',
    icon: FileText,
    sections: ['overview', 'security_events', 'access_logs', 'violations', 'recommendations'],
  },
];

const SECTION_LABELS: Record<string, string> = {
  trust_services: 'Trust Services Criteria',
  security_controls: 'Security Controls',
  access_management: 'Access Management',
  incident_response: 'Incident Response',
  vendor_management: 'Vendor Management',
  privacy_rule: 'Privacy Rule Compliance',
  security_rule: 'Security Rule Compliance',
  breach_notification: 'Breach Notification',
  access_controls: 'Access Controls',
  audit_controls: 'Audit Controls',
  data_processing: 'Data Processing Activities',
  consent_management: 'Consent Management',
  data_subject_rights: 'Data Subject Rights',
  breach_reporting: 'Breach Reporting',
  dpia: 'Data Protection Impact Assessment',
  network_security: 'Network Security',
  cardholder_data: 'Cardholder Data Protection',
  vulnerability_management: 'Vulnerability Management',
  access_control: 'Access Control',
  monitoring: 'Monitoring & Testing',
  overview: 'Executive Overview',
  security_events: 'Security Events',
  access_logs: 'Access Logs',
  violations: 'Violations & Incidents',
  recommendations: 'Recommendations',
};

const STEPS = [
  { id: 'framework', label: 'Framework' },
  { id: 'period', label: 'Report Period' },
  { id: 'sections', label: 'Sections' },
  { id: 'options', label: 'Options' },
  { id: 'review', label: 'Review' },
];

// ============================================================================
// Sub-Components
// ============================================================================

function StepIndicator({ steps, currentStep }: { steps: typeof STEPS; currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
              }`}
            >
              {index < currentStep ? <Check className="h-5 w-5" /> : index + 1}
            </div>
            <span
              className={`ml-2 text-sm ${
                index <= currentStep ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`mx-4 h-0.5 w-16 ${
                index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FrameworkStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
        Select Compliance Framework
      </h2>
      <p className="mb-6 text-sm text-gray-500">Choose the compliance framework for your report</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {FRAMEWORKS.map((framework) => {
          const Icon = framework.icon;
          const isSelected = selected === framework.id;

          return (
            <button
              key={framework.id}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              }`}
              onClick={() => onSelect(framework.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    isSelected ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-medium ${
                      isSelected
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {framework.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{framework.description}</p>
                </div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PeriodStep({
  dateRange,
  onDateRangeChange,
  reportName,
  onReportNameChange,
}: {
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  reportName: string;
  onReportNameChange: (name: string) => void;
}) {
  const presets = [
    {
      label: 'Last Month',
      getValue: () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
        return {
          start: start.toISOString().split('T')[0],
          end: new Date(end.getFullYear(), end.getMonth(), 0).toISOString().split('T')[0],
        };
      },
    },
    {
      label: 'Last Quarter',
      getValue: () => {
        const now = new Date();
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        const end = new Date(now.getFullYear(), quarter * 3, 0);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      },
    },
    {
      label: 'Last Year',
      getValue: () => {
        const now = new Date();
        return {
          start: `${now.getFullYear() - 1}-01-01`,
          end: `${now.getFullYear() - 1}-12-31`,
        };
      },
    },
    {
      label: 'Year to Date',
      getValue: () => {
        const now = new Date();
        return {
          start: `${now.getFullYear()}-01-01`,
          end: now.toISOString().split('T')[0],
        };
      },
    },
  ];

  return (
    <div>
      <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">Report Period</h2>
      <p className="mb-6 text-sm text-gray-500">
        Select the time period for your compliance report
      </p>

      {/* Report Name */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Report Name
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="e.g., Q4 2024 SOC 2 Compliance Report"
          type="text"
          value={reportName}
          onChange={(e) => onReportNameChange(e.target.value)}
        />
      </div>

      {/* Quick Presets */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Quick Select
        </label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              onClick={() => onDateRangeChange(preset.getValue())}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Start Date
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            End Date
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function SectionsStep({
  framework,
  sections,
  onSectionsChange,
}: {
  framework: string;
  sections: string[];
  onSectionsChange: (sections: string[]) => void;
}) {
  const frameworkConfig = FRAMEWORKS.find((f) => f.id === framework);
  const availableSections = frameworkConfig?.sections || [];

  const toggleSection = (section: string) => {
    if (sections.includes(section)) {
      onSectionsChange(sections.filter((s) => s !== section));
    } else {
      onSectionsChange([...sections, section]);
    }
  };

  const selectAll = () => onSectionsChange([...availableSections]);
  const deselectAll = () => onSectionsChange([]);

  return (
    <div>
      <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">Report Sections</h2>
      <p className="mb-4 text-sm text-gray-500">Select which sections to include in your report</p>

      <div className="mb-4 flex items-center gap-2">
        <button className="text-sm text-blue-600 hover:underline" onClick={selectAll}>
          Select All
        </button>
        <span className="text-gray-300">|</span>
        <button className="text-sm text-blue-600 hover:underline" onClick={deselectAll}>
          Deselect All
        </button>
      </div>

      <div className="space-y-2">
        {availableSections.map((section) => (
          <label
            key={section}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <input
              checked={sections.includes(section)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              type="checkbox"
              onChange={() => toggleSection(section)}
            />
            <span className="text-gray-900 dark:text-white">
              {SECTION_LABELS[section] || section}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function OptionsStep({
  config,
  onConfigChange,
}: {
  config: ReportConfig;
  onConfigChange: (config: Partial<ReportConfig>) => void;
}) {
  const [newRecipient, setNewRecipient] = useState('');

  const addRecipient = () => {
    if (newRecipient && !config.recipients.includes(newRecipient)) {
      onConfigChange({ recipients: [...config.recipients, newRecipient] });
      setNewRecipient('');
    }
  };

  const removeRecipient = (email: string) => {
    onConfigChange({ recipients: config.recipients.filter((r) => r !== email) });
  };

  return (
    <div>
      <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">Report Options</h2>
      <p className="mb-6 text-sm text-gray-500">Configure additional options for your report</p>

      <div className="space-y-6">
        {/* Format */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Output Format
          </label>
          <div className="flex gap-4">
            {(['pdf', 'excel', 'json'] as const).map((format) => (
              <label key={format} className="flex cursor-pointer items-center gap-2">
                <input
                  checked={config.format === format}
                  className="h-4 w-4 text-blue-600"
                  name="format"
                  type="radio"
                  onChange={() => onConfigChange({ format })}
                />
                <span className="uppercase text-gray-700 dark:text-gray-300">{format}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Include Options */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Include
          </label>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                checked={config.includeEvidence}
                className="h-4 w-4 rounded text-blue-600"
                type="checkbox"
                onChange={(e) => onConfigChange({ includeEvidence: e.target.checked })}
              />
              <span className="text-gray-700 dark:text-gray-300">
                Supporting Evidence (screenshots, logs, etc.)
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                checked={config.includeRecommendations}
                className="h-4 w-4 rounded text-blue-600"
                type="checkbox"
                onChange={(e) => onConfigChange({ includeRecommendations: e.target.checked })}
              />
              <span className="text-gray-700 dark:text-gray-300">
                Recommendations & Action Items
              </span>
            </label>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="mb-4 flex cursor-pointer items-center gap-3">
            <input
              checked={config.schedule.enabled}
              className="h-4 w-4 rounded text-blue-600"
              type="checkbox"
              onChange={(e) =>
                onConfigChange({
                  schedule: { ...config.schedule, enabled: e.target.checked },
                })
              }
            />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Schedule recurring reports
            </span>
          </label>

          {config.schedule.enabled && (
            <div className="space-y-4 pl-7">
              <div>
                <label className="mb-2 block text-sm text-gray-600 dark:text-gray-400">
                  Frequency
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  value={config.schedule.frequency}
                  onChange={(e) =>
                    onConfigChange({
                      schedule: { ...config.schedule, frequency: e.target.value as any },
                    })
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Recipients */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email Recipients
          </label>
          <div className="mb-2 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
              placeholder="email@example.com"
              type="email"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
            />
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={addRecipient}
            >
              Add
            </button>
          </div>
          {config.recipients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {config.recipients.map((email) => (
                <span
                  key={email}
                  className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-700"
                >
                  {email}
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => removeRecipient(email)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ config }: { config: ReportConfig }) {
  const framework = FRAMEWORKS.find((f) => f.id === config.framework);

  return (
    <div>
      <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">Review & Generate</h2>
      <p className="mb-6 text-sm text-gray-500">
        Review your report configuration before generating
      </p>

      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-medium text-gray-500">Report Name</h3>
          <p className="text-gray-900 dark:text-white">{config.name || 'Untitled Report'}</p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-medium text-gray-500">Framework</h3>
          <p className="text-gray-900 dark:text-white">{framework?.name || config.framework}</p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-medium text-gray-500">Report Period</h3>
          <p className="text-gray-900 dark:text-white">
            {config.dateRange.start} to {config.dateRange.end}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-medium text-gray-500">
            Sections ({config.sections.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {config.sections.map((section) => (
              <span
                key={section}
                className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {SECTION_LABELS[section] || section}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-medium text-gray-500">Options</h3>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Format: {config.format.toUpperCase()}</li>
            <li>Include Evidence: {config.includeEvidence ? 'Yes' : 'No'}</li>
            <li>Include Recommendations: {config.includeRecommendations ? 'Yes' : 'No'}</li>
            {config.schedule.enabled && <li>Schedule: {config.schedule.frequency}</li>}
            {config.recipients.length > 0 && <li>Recipients: {config.recipients.join(', ')}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CreateComplianceReportPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    framework: '',
    dateRange: { start: '', end: '' },
    sections: [],
    includeEvidence: true,
    includeRecommendations: true,
    format: 'pdf',
    schedule: { enabled: false, frequency: 'monthly' },
    recipients: [],
  });

  const updateConfig = (updates: Partial<ReportConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleFrameworkSelect = (framework: string) => {
    const frameworkConfig = FRAMEWORKS.find((f) => f.id === framework);
    updateConfig({
      framework,
      sections: frameworkConfig?.sections || [],
    });
  };

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0:
        return !!config.framework;
      case 1:
        return !!config.dateRange.start && !!config.dateRange.end;
      case 2:
        return config.sections.length > 0;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  }, [currentStep, config]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      router.push('/compliance/reports');
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <button
            className="mb-4 flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            onClick={() => router.push('/compliance/reports')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Compliance Report
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={STEPS} />

        {/* Step Content */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          {currentStep === 0 && (
            <FrameworkStep selected={config.framework} onSelect={handleFrameworkSelect} />
          )}
          {currentStep === 1 && (
            <PeriodStep
              dateRange={config.dateRange}
              reportName={config.name}
              onDateRangeChange={(range) => updateConfig({ dateRange: range })}
              onReportNameChange={(name) => updateConfig({ name })}
            />
          )}
          {currentStep === 2 && (
            <SectionsStep
              framework={config.framework}
              sections={config.sections}
              onSectionsChange={(sections) => updateConfig({ sections })}
            />
          )}
          {currentStep === 3 && <OptionsStep config={config} onConfigChange={updateConfig} />}
          {currentStep === 4 && <ReviewStep config={config} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
            disabled={currentStep === 0}
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canProceed()}
              onClick={handleNext}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              disabled={isGenerating}
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
