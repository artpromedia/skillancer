/**
 * @module @skillancer/bi/reports
 * Report type definitions
 */

export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'json';
export type ReportSchedule = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  template: string;
  kpiIds: string[];
  dimensions?: string[];
  defaultFormat: ReportFormat;
  supportedFormats: ReportFormat[];
  isSchedulable: boolean;
  visibility: 'public' | 'internal' | 'executive';
}

export interface ReportRequest {
  reportId: string;
  format: ReportFormat;
  dateRange: {
    start: Date;
    end: Date;
  };
  dimensions?: string[];
  filters?: Record<string, string[]>;
  recipients?: string[];
  customTitle?: string;
}

export interface ReportResult {
  id: string;
  reportId: string;
  format: ReportFormat;
  status: ReportStatus;
  generatedAt: Date;
  expiresAt: Date;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
}

export interface ScheduledReport {
  id: string;
  reportId: string;
  schedule: ReportSchedule;
  format: ReportFormat;
  recipients: string[];
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdBy: string;
  createdAt: Date;
}

export interface ReportSection {
  title: string;
  type: 'summary' | 'table' | 'chart' | 'kpi_grid';
  data: unknown;
}

export interface ReportData {
  title: string;
  subtitle: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  sections: ReportSection[];
  metadata: Record<string, unknown>;
}
