/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Compliance Report Viewer Component
 *
 * Displays generated compliance reports with sections,
 * findings, and export capabilities.
 *
 * @module components/compliance/report-viewer
 */

import {
  FileText,
  Download,
  Share2,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Calendar,
  User,
  Building,
  Shield,
  ExternalLink,
  Copy,
  Eye,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ComplianceReport {
  id: string;
  name: string;
  framework: string;
  frameworkVersion: string;
  status: 'draft' | 'final' | 'archived';
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  organization: {
    name: string;
    address: string;
  };
  preparedBy: string;
  summary: ReportSummary;
  sections: ReportSection[];
  findings: Finding[];
  recommendations: Recommendation[];
  metadata: ReportMetadata;
}

interface ReportSummary {
  overallScore: number;
  status: 'compliant' | 'at_risk' | 'non_compliant';
  totalControls: number;
  controlsMet: number;
  controlsPartial: number;
  controlsUnmet: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
}

interface ReportSection {
  id: string;
  title: string;
  description: string;
  score: number;
  status: 'compliant' | 'at_risk' | 'non_compliant';
  controls: Control[];
}

interface Control {
  id: string;
  name: string;
  description: string;
  status: 'met' | 'partial' | 'unmet';
  evidence: string[];
  notes: string;
}

interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  control: string;
  impact: string;
  remediation: string;
  dueDate?: Date;
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

interface ReportMetadata {
  version: string;
  confidentiality: 'public' | 'internal' | 'confidential' | 'restricted';
  approvedBy?: string;
  approvedAt?: Date;
  watermark?: string;
}

interface ReportViewerProps {
  report: ComplianceReport;
  onExport: (format: 'pdf' | 'excel' | 'json') => void;
  onShare: () => void;
  onPrint: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG = {
  compliant: {
    label: 'Compliant',
    icon: CheckCircle,
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
  },
  at_risk: {
    label: 'At Risk',
    icon: AlertTriangle,
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  non_compliant: {
    label: 'Non-Compliant',
    icon: XCircle,
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
  },
};

const CONTROL_STATUS_CONFIG = {
  met: { label: 'Met', icon: CheckCircle, color: 'text-green-600' },
  partial: { label: 'Partial', icon: AlertTriangle, color: 'text-yellow-600' },
  unmet: { label: 'Unmet', icon: XCircle, color: 'text-red-600' },
};

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ReportHeader({ report }: { report: ComplianceReport }) {
  const statusConfig = STATUS_CONFIG[report.summary.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 print:border-0">
      <div className="p-6">
        {/* Title */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <span className="text-sm font-medium uppercase tracking-wide text-blue-600">
                {report.framework} v{report.frameworkVersion}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{report.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Report Period: {formatDate(report.period.start)} - {formatDate(report.period.end)}
            </p>
          </div>
          <span
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}
          >
            <StatusIcon className="h-4 w-4" />
            {statusConfig.label}
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 md:grid-cols-4 dark:bg-gray-900">
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-gray-500">
              <Building className="h-3 w-3" />
              Organization
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {report.organization.name}
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-gray-500">
              <User className="h-3 w-3" />
              Prepared By
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{report.preparedBy}</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              Generated
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDateShort(report.generatedAt)}
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-gray-500">
              <Info className="h-3 w-3" />
              Classification
            </div>
            <p className="text-sm font-medium capitalize text-gray-900 dark:text-white">
              {report.metadata.confidentiality}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecutiveSummary({ summary }: { summary: ReportSummary }) {
  const scoreColor =
    summary.overallScore >= 90
      ? 'text-green-600'
      : summary.overallScore >= 70
        ? 'text-yellow-600'
        : 'text-red-600';

  const scoreBg =
    summary.overallScore >= 90
      ? 'bg-green-500'
      : summary.overallScore >= 70
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="border-b border-gray-200 p-6 dark:border-gray-700">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Executive Summary
      </h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Score Gauge */}
        <div className="flex items-center gap-6">
          <div className="relative h-32 w-32">
            <svg className="h-full w-full -rotate-90 transform">
              <circle
                className="text-gray-200 dark:text-gray-700"
                cx="64"
                cy="64"
                fill="none"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
              />
              <circle
                className={scoreColor}
                cx="64"
                cy="64"
                fill="none"
                r="56"
                stroke="currentColor"
                strokeDasharray={`${summary.overallScore * 3.52} 352`}
                strokeLinecap="round"
                strokeWidth="12"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${scoreColor}`}>{summary.overallScore}%</span>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-medium text-gray-900 dark:text-white">Compliance Score</h3>
            <p className="text-sm text-gray-500">
              Based on {summary.totalControls} controls evaluated
            </p>
          </div>
        </div>

        {/* Controls Breakdown */}
        <div>
          <h3 className="mb-3 font-medium text-gray-900 dark:text-white">Controls Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Met</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${(summary.controlsMet / summary.totalControls) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white">
                  {summary.controlsMet}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Partial</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-yellow-500"
                    style={{ width: `${(summary.controlsPartial / summary.totalControls) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white">
                  {summary.controlsPartial}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Unmet</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${(summary.controlsUnmet / summary.totalControls) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white">
                  {summary.controlsUnmet}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Findings Summary */}
      <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <h3 className="mb-3 font-medium text-gray-900 dark:text-white">Findings Summary</h3>
        <div className="flex gap-4">
          {[
            { label: 'Critical', count: summary.criticalFindings, color: 'bg-red-500' },
            { label: 'High', count: summary.highFindings, color: 'bg-orange-500' },
            { label: 'Medium', count: summary.mediumFindings, color: 'bg-yellow-500' },
            { label: 'Low', count: summary.lowFindings, color: 'bg-blue-500' },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${color}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {label}: <strong className="text-gray-900 dark:text-white">{count}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  isExpanded,
  onToggle,
}: {
  section: ReportSection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig = STATUS_CONFIG[section.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`rounded-lg p-2 ${statusConfig.bg}`}>
            <StatusIcon className={`h-5 w-5 ${statusConfig.text}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{section.title}</h3>
            <p className="text-sm text-gray-500">{section.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span
              className={`text-lg font-bold ${
                section.score >= 90
                  ? 'text-green-600'
                  : section.score >= 70
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {section.score}%
            </span>
            <p className="text-xs text-gray-500">
              {section.controls.filter((c) => c.status === 'met').length}/{section.controls.length}{' '}
              controls
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {section.controls.map((control) => {
              const controlStatus = CONTROL_STATUS_CONFIG[control.status];
              const ControlIcon = controlStatus.icon;

              return (
                <div key={control.id} className="bg-gray-50 p-4 dark:bg-gray-900/50">
                  <div className="flex items-start gap-3">
                    <ControlIcon className={`mt-0.5 h-5 w-5 ${controlStatus.color}`} />
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {control.name}
                        </h4>
                        <span className={`text-sm ${controlStatus.color}`}>
                          {controlStatus.label}
                        </span>
                      </div>
                      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        {control.description}
                      </p>
                      {control.notes && (
                        <p className="text-sm italic text-gray-500">Note: {control.notes}</p>
                      )}
                      {control.evidence.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Evidence:</span>
                          {control.evidence.map((ev, i) => (
                            <button
                              key={i}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {ev}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-500" />
        <p>No findings identified</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {findings.map((finding) => {
        const severityConfig = SEVERITY_CONFIG[finding.severity];

        return (
          <div
            key={finding.id}
            className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${severityConfig.bg} ${severityConfig.text}`}
                >
                  {finding.severity}
                </span>
                <h4 className="font-medium text-gray-900 dark:text-white">{finding.title}</h4>
              </div>
              {finding.dueDate && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  Due: {formatDateShort(finding.dueDate)}
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{finding.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Control:</span>{' '}
                <span className="text-gray-900 dark:text-white">{finding.control}</span>
              </div>
              <div>
                <span className="text-gray-500">Impact:</span>{' '}
                <span className="text-gray-900 dark:text-white">{finding.impact}</span>
              </div>
            </div>
            <div className="mt-3 rounded bg-blue-50 p-3 dark:bg-blue-900/20">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Remediation:
              </span>
              <p className="mt-1 text-sm text-blue-600 dark:text-blue-300">{finding.remediation}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationsList({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <div className="space-y-3">
      {recommendations.map((rec, index) => (
        <div
          key={rec.id}
          className="flex items-start gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-600 dark:bg-blue-900/50">
            {index + 1}
          </div>
          <div className="flex-1">
            <h4 className="mb-1 font-medium text-gray-900 dark:text-white">{rec.title}</h4>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{rec.description}</p>
            <div className="flex gap-4 text-xs">
              <span className="text-gray-500">
                Priority:{' '}
                <span className="capitalize text-gray-900 dark:text-white">{rec.priority}</span>
              </span>
              <span className="text-gray-500">
                Effort:{' '}
                <span className="capitalize text-gray-900 dark:text-white">{rec.effort}</span>
              </span>
              <span className="text-gray-500">
                Impact:{' '}
                <span className="capitalize text-gray-900 dark:text-white">{rec.impact}</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReportViewer({ report, onExport, onShare, onPrint }: ReportViewerProps) {
  const [activeTab, setActiveTab] = useState<'sections' | 'findings' | 'recommendations'>(
    'sections'
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSections(newExpanded);
  };

  const expandAll = () => {
    setExpandedSections(new Set(report.sections.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <ReportHeader report={report} />

      {/* Actions Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-gray-700 dark:bg-gray-900 print:hidden">
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-white dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={() => onExport('pdf')}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-white dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={() => onExport('excel')}
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-white dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={onShare}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-white dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={onPrint}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
        <span className="text-sm text-gray-500">Version {report.metadata.version}</span>
      </div>

      {/* Executive Summary */}
      <ExecutiveSummary summary={report.summary} />

      {/* Content Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex px-6">
          {[
            { id: 'sections', label: 'Sections', count: report.sections.length },
            { id: 'findings', label: 'Findings', count: report.findings.length },
            {
              id: 'recommendations',
              label: 'Recommendations',
              count: report.recommendations.length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              {tab.label}
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'sections' && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detailed Sections
              </h2>
              <div className="flex items-center gap-2">
                <button className="text-sm text-blue-600 hover:underline" onClick={expandAll}>
                  Expand All
                </button>
                <span className="text-gray-300">|</span>
                <button className="text-sm text-blue-600 hover:underline" onClick={collapseAll}>
                  Collapse All
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {report.sections.map((section) => (
                <SectionCard
                  key={section.id}
                  isExpanded={expandedSections.has(section.id)}
                  section={section}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>
          </>
        )}

        {activeTab === 'findings' && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Findings & Issues
            </h2>
            <FindingsList findings={report.findings} />
          </>
        )}

        {activeTab === 'recommendations' && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Recommendations
            </h2>
            <RecommendationsList recommendations={report.recommendations} />
          </>
        )}
      </div>
    </div>
  );
}
