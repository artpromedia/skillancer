/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
/**
 * Compliance API Client
 *
 * Client library for compliance management, report generation,
 * framework assessment, and audit trail operations.
 *
 * @module lib/api/compliance
 */

// ============================================================================
// Types
// ============================================================================

export interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'active' | 'pending' | 'expired' | 'not_applicable';
  score: number;
  lastAssessment: Date;
  nextAssessment: Date;
  controls: FrameworkControl[];
}

export interface FrameworkControl {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_assessed';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence?: Evidence[];
  lastChecked: Date;
  remediation?: string;
}

export interface Evidence {
  id: string;
  type: 'document' | 'screenshot' | 'log' | 'configuration' | 'attestation';
  name: string;
  description: string;
  uploadedAt: Date;
  uploadedBy: string;
  url: string;
  verified: boolean;
}

export interface ComplianceReport {
  id: string;
  title: string;
  framework: string;
  type: 'assessment' | 'audit' | 'gap_analysis' | 'certification' | 'custom';
  status: 'draft' | 'generating' | 'completed' | 'approved' | 'archived';
  createdAt: Date;
  createdBy: string;
  completedAt?: Date;
  approvedBy?: string;
  periodStart: Date;
  periodEnd: Date;
  sections: ReportSection[];
  summary: ReportSummary;
}

export interface ReportSection {
  id: string;
  name: string;
  description: string;
  controls: FrameworkControl[];
  score: number;
  findings: Finding[];
  recommendations: Recommendation[];
}

export interface ReportSummary {
  overallScore: number;
  controlsTotal: number;
  controlsCompliant: number;
  controlsNonCompliant: number;
  controlsPartial: number;
  findingsTotal: number;
  findingsCritical: number;
  findingsHigh: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  controlId: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted' | 'false_positive';
  detectedAt: Date;
  resolvedAt?: Date;
  assignee?: string;
  remediation?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  controlIds: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: {
    id: string;
    name: string;
    email: string;
    type: 'user' | 'system' | 'api';
  };
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  details: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'partial';
  ip?: string;
  sessionId?: string;
  correlationId?: string;
}

export interface ComplianceTask {
  id: string;
  title: string;
  description: string;
  framework: string;
  controlId?: string;
  type: 'assessment' | 'evidence' | 'remediation' | 'review';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dueDate: Date;
  assignee: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ComplianceFilters {
  frameworks?: string[];
  status?: string[];
  severity?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ComplianceStats {
  overallScore: number;
  frameworkCount: number;
  activeFindings: number;
  pendingTasks: number;
  upcomingAudits: number;
  trends: {
    date: Date;
    score: number;
  }[];
}

// ============================================================================
// API Client Class
// ============================================================================

class ComplianceAPIClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '/api/compliance';
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(error.message || `API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // =========================================================================
  // Framework Operations
  // =========================================================================

  async getFrameworks(): Promise<ComplianceFramework[]> {
    return this.request<ComplianceFramework[]>('/frameworks');
  }

  async getFramework(id: string): Promise<ComplianceFramework> {
    return this.request<ComplianceFramework>(`/frameworks/${id}`);
  }

  async assessFramework(
    id: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ComplianceFramework> {
    return this.request<ComplianceFramework>(`/frameworks/${id}/assess`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async updateControlStatus(
    frameworkId: string,
    controlId: string,
    status: FrameworkControl['status'],
    evidence?: Partial<Evidence>
  ): Promise<FrameworkControl> {
    return this.request<FrameworkControl>(`/frameworks/${frameworkId}/controls/${controlId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, evidence }),
    });
  }

  // =========================================================================
  // Report Operations
  // =========================================================================

  async getReports(
    filters?: ComplianceFilters,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<ComplianceReport>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters?.frameworks?.length) {
      params.set('frameworks', filters.frameworks.join(','));
    }
    if (filters?.status?.length) {
      params.set('status', filters.status.join(','));
    }
    if (filters?.search) {
      params.set('search', filters.search);
    }

    return this.request<PaginatedResponse<ComplianceReport>>(`/reports?${params.toString()}`);
  }

  async getReport(id: string): Promise<ComplianceReport> {
    return this.request<ComplianceReport>(`/reports/${id}`);
  }

  async createReport(
    data: Pick<ComplianceReport, 'title' | 'framework' | 'type' | 'periodStart' | 'periodEnd'> & {
      sections?: string[];
      options?: {
        includeEvidence?: boolean;
        includeRemediation?: boolean;
        format?: 'pdf' | 'html' | 'json';
      };
    }
  ): Promise<ComplianceReport> {
    return this.request<ComplianceReport>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReport(id: string, data: Partial<ComplianceReport>): Promise<ComplianceReport> {
    return this.request<ComplianceReport>(`/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteReport(id: string): Promise<void> {
    return this.request<void>(`/reports/${id}`, {
      method: 'DELETE',
    });
  }

  async approveReport(id: string): Promise<ComplianceReport> {
    return this.request<ComplianceReport>(`/reports/${id}/approve`, {
      method: 'POST',
    });
  }

  async exportReport(id: string, format: 'pdf' | 'csv' | 'json'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/reports/${id}/export?format=${format}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  // =========================================================================
  // Finding Operations
  // =========================================================================

  async getFindings(
    filters?: ComplianceFilters,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Finding>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters?.severity?.length) {
      params.set('severity', filters.severity.join(','));
    }
    if (filters?.status?.length) {
      params.set('status', filters.status.join(','));
    }

    return this.request<PaginatedResponse<Finding>>(`/findings?${params.toString()}`);
  }

  async getFinding(id: string): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}`);
  }

  async updateFinding(id: string, data: Partial<Finding>): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async resolveFinding(id: string, resolution: string): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    });
  }

  // =========================================================================
  // Audit Log Operations
  // =========================================================================

  async getAuditLogs(
    filters?: {
      categories?: string[];
      severities?: string[];
      actors?: string[];
      dateRange?: { start: Date; end: Date };
    },
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<AuditLogEntry>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters?.categories?.length) {
      params.set('categories', filters.categories.join(','));
    }
    if (filters?.severities?.length) {
      params.set('severities', filters.severities.join(','));
    }
    if (filters?.dateRange) {
      params.set('startDate', filters.dateRange.start.toISOString());
      params.set('endDate', filters.dateRange.end.toISOString());
    }

    return this.request<PaginatedResponse<AuditLogEntry>>(`/audit-logs?${params.toString()}`);
  }

  async exportAuditLogs(
    filters?: {
      categories?: string[];
      severities?: string[];
      dateRange?: { start: Date; end: Date };
    },
    format: 'csv' | 'json' | 'siem' = 'csv'
  ): Promise<Blob> {
    const params = new URLSearchParams({ format });

    if (filters?.categories?.length) {
      params.set('categories', filters.categories.join(','));
    }
    if (filters?.dateRange) {
      params.set('startDate', filters.dateRange.start.toISOString());
      params.set('endDate', filters.dateRange.end.toISOString());
    }

    const response = await fetch(`${this.baseUrl}/audit-logs/export?${params.toString()}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }

  // =========================================================================
  // Task Operations
  // =========================================================================

  async getTasks(
    filters?: { status?: string[]; assignee?: string },
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<ComplianceTask>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters?.status?.length) {
      params.set('status', filters.status.join(','));
    }
    if (filters?.assignee) {
      params.set('assignee', filters.assignee);
    }

    return this.request<PaginatedResponse<ComplianceTask>>(`/tasks?${params.toString()}`);
  }

  async getTask(id: string): Promise<ComplianceTask> {
    return this.request<ComplianceTask>(`/tasks/${id}`);
  }

  async updateTask(id: string, data: Partial<ComplianceTask>): Promise<ComplianceTask> {
    return this.request<ComplianceTask>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async completeTask(id: string): Promise<ComplianceTask> {
    return this.request<ComplianceTask>(`/tasks/${id}/complete`, {
      method: 'POST',
    });
  }

  // =========================================================================
  // Statistics & Dashboard
  // =========================================================================

  async getStats(): Promise<ComplianceStats> {
    return this.request<ComplianceStats>('/stats');
  }

  async getDashboard(): Promise<{
    stats: ComplianceStats;
    frameworks: ComplianceFramework[];
    recentFindings: Finding[];
    upcomingTasks: ComplianceTask[];
  }> {
    return this.request('/dashboard');
  }

  // =========================================================================
  // Evidence Management
  // =========================================================================

  async uploadEvidence(
    controlId: string,
    file: File,
    metadata: Partial<Evidence>
  ): Promise<Evidence> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch(`${this.baseUrl}/controls/${controlId}/evidence`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json() as Promise<Evidence>;
  }

  async deleteEvidence(controlId: string, evidenceId: string): Promise<void> {
    return this.request<void>(`/controls/${controlId}/evidence/${evidenceId}`, {
      method: 'DELETE',
    });
  }

  async verifyEvidence(
    controlId: string,
    evidenceId: string,
    verified: boolean
  ): Promise<Evidence> {
    return this.request<Evidence>(`/controls/${controlId}/evidence/${evidenceId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verified }),
    });
  }
}

// ============================================================================
// Singleton Instance & Hooks
// ============================================================================

export const complianceApi = new ComplianceAPIClient();

export function useComplianceApi() {
  return complianceApi;
}

export default complianceApi;
