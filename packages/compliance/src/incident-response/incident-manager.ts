/**
 * Incident Response System
 * SOC 2 compliant security incident management
 */

import { randomBytes } from 'crypto';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  type: IncidentType;
  classification: IncidentClassification;
  detectedAt: Date;
  reportedAt: Date;
  reportedBy: string;
  assignedTo?: string;
  affectedSystems: string[];
  affectedUsers: number;
  timeline: IncidentTimelineEntry[];
  containmentActions: string[];
  eradicationActions: string[];
  recoveryActions: string[];
  lessonsLearned?: string;
  rootCause?: string;
  preventiveMeasures?: string[];
  notificationsRequired: NotificationRequirement[];
  regulatoryReporting: RegulatoryReport[];
  resolvedAt?: Date;
  closedAt?: Date;
  metrics: IncidentMetrics;
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  notes?: string;
  evidenceIds?: string[];
}

export interface NotificationRequirement {
  type: 'internal' | 'customer' | 'regulatory' | 'law_enforcement' | 'media';
  recipient: string;
  requiredBy: Date;
  sentAt?: Date;
  acknowledgedAt?: Date;
  content?: string;
}

export interface RegulatoryReport {
  regulation: 'gdpr' | 'hipaa' | 'ccpa' | 'pci_dss' | 'soc2' | 'other';
  authority: string;
  requiredBy: Date;
  submittedAt?: Date;
  referenceNumber?: string;
  status: 'pending' | 'submitted' | 'acknowledged' | 'closed';
}

export interface IncidentMetrics {
  timeToDetect: number; // minutes from occurrence to detection
  timeToRespond: number; // minutes from detection to first response
  timeToContain: number; // minutes from detection to containment
  timeToResolve?: number; // minutes from detection to resolution
  estimatedImpact?: string;
  actualImpact?: string;
}

export enum IncidentSeverity {
  CRITICAL = 'critical', // Business-critical, immediate response
  HIGH = 'high', // Significant impact, urgent
  MEDIUM = 'medium', // Moderate impact
  LOW = 'low', // Minor impact
}

export enum IncidentStatus {
  DETECTED = 'detected',
  TRIAGED = 'triaged',
  CONTAINED = 'contained',
  ERADICATED = 'eradicated',
  RECOVERED = 'recovered',
  CLOSED = 'closed',
}

export enum IncidentType {
  SECURITY_BREACH = 'security_breach',
  DATA_BREACH = 'data_breach',
  MALWARE = 'malware',
  PHISHING = 'phishing',
  DDOS = 'ddos',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  INSIDER_THREAT = 'insider_threat',
  DATA_LOSS = 'data_loss',
  SERVICE_OUTAGE = 'service_outage',
  POLICY_VIOLATION = 'policy_violation',
  OTHER = 'other',
}

export enum IncidentClassification {
  CONFIRMED = 'confirmed',
  SUSPECTED = 'suspected',
  FALSE_POSITIVE = 'false_positive',
  UNDER_INVESTIGATION = 'under_investigation',
}

export interface PlaybookStep {
  order: number;
  title: string;
  description: string;
  responsible: string;
  estimatedMinutes: number;
  required: boolean;
  automatable: boolean;
  checklist: string[];
}

export interface Playbook {
  id: string;
  name: string;
  incidentType: IncidentType;
  severity: IncidentSeverity[];
  steps: PlaybookStep[];
  escalationPath: string[];
  communicationTemplates: Record<string, string>;
  lastUpdated: Date;
  version: string;
}

// Response time SLAs (in minutes)
const RESPONSE_SLA: Record<IncidentSeverity, { respond: number; contain: number }> = {
  [IncidentSeverity.CRITICAL]: { respond: 15, contain: 60 },
  [IncidentSeverity.HIGH]: { respond: 60, contain: 240 },
  [IncidentSeverity.MEDIUM]: { respond: 240, contain: 1440 },
  [IncidentSeverity.LOW]: { respond: 1440, contain: 4320 },
};

// Notification timelines (in hours)
const NOTIFICATION_TIMELINES = {
  gdpr: 72, // 72 hours to DPA
  hipaa: 60 * 24, // 60 days to HHS (converted to hours for simplicity)
  ccpa: 72,
  pci_dss: 24,
};

// In-memory stores
const incidents: Map<string, Incident> = new Map();
const playbooks: Map<string, Playbook> = new Map();

export class IncidentResponseSystem {
  constructor() {
    this.initializePlaybooks();
  }

  /**
   * Create a new incident
   */
  async createIncident(
    title: string,
    description: string,
    severity: IncidentSeverity,
    type: IncidentType,
    reportedBy: string,
    affectedSystems: string[],
    estimatedAffectedUsers: number = 0
  ): Promise<Incident> {
    const now = new Date();
    const id = `INC-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const incident: Incident = {
      id,
      title,
      description,
      severity,
      status: IncidentStatus.DETECTED,
      type,
      classification: IncidentClassification.UNDER_INVESTIGATION,
      detectedAt: now,
      reportedAt: now,
      reportedBy,
      affectedSystems,
      affectedUsers: estimatedAffectedUsers,
      timeline: [
        {
          id: randomBytes(8).toString('hex'),
          timestamp: now,
          action: 'Incident created',
          actor: reportedBy,
          notes: description,
        },
      ],
      containmentActions: [],
      eradicationActions: [],
      recoveryActions: [],
      notificationsRequired: [],
      regulatoryReporting: [],
      metrics: {
        timeToDetect: 0,
        timeToRespond: 0,
        timeToContain: 0,
      },
    };

    // Determine notification requirements based on type and severity
    if (type === IncidentType.DATA_BREACH && severity === IncidentSeverity.CRITICAL) {
      incident.notificationsRequired.push(
        {
          type: 'regulatory',
          recipient: 'Data Protection Authority',
          requiredBy: new Date(now.getTime() + NOTIFICATION_TIMELINES.gdpr * 60 * 60 * 1000),
        },
        {
          type: 'customer',
          recipient: 'Affected customers',
          requiredBy: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        }
      );

      incident.regulatoryReporting.push({
        regulation: 'gdpr',
        authority: 'ICO / Local DPA',
        requiredBy: new Date(now.getTime() + NOTIFICATION_TIMELINES.gdpr * 60 * 60 * 1000),
        status: 'pending',
      });
    }

    // Add internal notification
    incident.notificationsRequired.push({
      type: 'internal',
      recipient: this.getEscalationContact(severity),
      requiredBy: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes
    });

    incidents.set(id, incident);

    console.log(`[INCIDENT] Created ${id}: ${title} (${severity})`);

    return incident;
  }

  /**
   * Update incident status
   */
  async updateStatus(
    incidentId: string,
    status: IncidentStatus,
    actor: string,
    notes?: string
  ): Promise<Incident | null> {
    const incident = incidents.get(incidentId);
    if (!incident) return null;

    const now = new Date();
    const previousStatus = incident.status;
    incident.status = status;

    // Update timeline
    incident.timeline.push({
      id: randomBytes(8).toString('hex'),
      timestamp: now,
      action: `Status changed: ${previousStatus} → ${status}`,
      actor,
      notes,
    });

    // Update metrics
    const detectedTime = incident.detectedAt.getTime();
    if (status === IncidentStatus.TRIAGED && incident.metrics.timeToRespond === 0) {
      incident.metrics.timeToRespond = Math.round((now.getTime() - detectedTime) / 60000);
    }
    if (status === IncidentStatus.CONTAINED && incident.metrics.timeToContain === 0) {
      incident.metrics.timeToContain = Math.round((now.getTime() - detectedTime) / 60000);
    }
    if (status === IncidentStatus.RECOVERED) {
      incident.resolvedAt = now;
      incident.metrics.timeToResolve = Math.round((now.getTime() - detectedTime) / 60000);
    }
    if (status === IncidentStatus.CLOSED) {
      incident.closedAt = now;
    }

    incidents.set(incidentId, incident);
    return incident;
  }

  /**
   * Add timeline entry
   */
  async addTimelineEntry(
    incidentId: string,
    action: string,
    actor: string,
    notes?: string,
    evidenceIds?: string[]
  ): Promise<IncidentTimelineEntry | null> {
    const incident = incidents.get(incidentId);
    if (!incident) return null;

    const entry: IncidentTimelineEntry = {
      id: randomBytes(8).toString('hex'),
      timestamp: new Date(),
      action,
      actor,
      notes,
      evidenceIds,
    };

    incident.timeline.push(entry);
    incidents.set(incidentId, incident);

    return entry;
  }

  /**
   * Record containment action
   */
  async addContainmentAction(incidentId: string, action: string, actor: string): Promise<boolean> {
    const incident = incidents.get(incidentId);
    if (!incident) return false;

    incident.containmentActions.push(action);
    await this.addTimelineEntry(incidentId, `Containment: ${action}`, actor);

    return true;
  }

  /**
   * Record eradication action
   */
  async addEradicationAction(incidentId: string, action: string, actor: string): Promise<boolean> {
    const incident = incidents.get(incidentId);
    if (!incident) return false;

    incident.eradicationActions.push(action);
    await this.addTimelineEntry(incidentId, `Eradication: ${action}`, actor);

    return true;
  }

  /**
   * Record recovery action
   */
  async addRecoveryAction(incidentId: string, action: string, actor: string): Promise<boolean> {
    const incident = incidents.get(incidentId);
    if (!incident) return false;

    incident.recoveryActions.push(action);
    await this.addTimelineEntry(incidentId, `Recovery: ${action}`, actor);

    return true;
  }

  /**
   * Close incident with lessons learned
   */
  async closeIncident(
    incidentId: string,
    actor: string,
    rootCause: string,
    lessonsLearned: string,
    preventiveMeasures: string[]
  ): Promise<Incident | null> {
    const incident = incidents.get(incidentId);
    if (!incident) return null;

    incident.rootCause = rootCause;
    incident.lessonsLearned = lessonsLearned;
    incident.preventiveMeasures = preventiveMeasures;

    await this.updateStatus(
      incidentId,
      IncidentStatus.CLOSED,
      actor,
      'Incident closed with post-mortem'
    );

    return incidents.get(incidentId) || null;
  }

  /**
   * Record notification sent
   */
  async recordNotification(
    incidentId: string,
    notificationType: NotificationRequirement['type'],
    recipient: string
  ): Promise<boolean> {
    const incident = incidents.get(incidentId);
    if (!incident) return false;

    const notification = incident.notificationsRequired.find(
      (n) => n.type === notificationType && n.recipient === recipient
    );

    if (notification) {
      notification.sentAt = new Date();
    }

    incidents.set(incidentId, incident);
    return true;
  }

  /**
   * Get incident by ID
   */
  async getIncident(id: string): Promise<Incident | null> {
    return incidents.get(id) || null;
  }

  /**
   * Get all incidents with filters
   */
  async getIncidents(filters?: {
    severity?: IncidentSeverity[];
    status?: IncidentStatus[];
    type?: IncidentType[];
    startDate?: Date;
    endDate?: Date;
  }): Promise<Incident[]> {
    let results = Array.from(incidents.values());

    if (filters) {
      if (filters.severity) {
        results = results.filter((i) => filters.severity!.includes(i.severity));
      }
      if (filters.status) {
        results = results.filter((i) => filters.status!.includes(i.status));
      }
      if (filters.type) {
        results = results.filter((i) => filters.type!.includes(i.type));
      }
      if (filters.startDate) {
        results = results.filter((i) => i.detectedAt >= filters.startDate!);
      }
      if (filters.endDate) {
        results = results.filter((i) => i.detectedAt <= filters.endDate!);
      }
    }

    return results.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  /**
   * Get active incidents (not closed)
   */
  async getActiveIncidents(): Promise<Incident[]> {
    return this.getIncidents({
      status: [
        IncidentStatus.DETECTED,
        IncidentStatus.TRIAGED,
        IncidentStatus.CONTAINED,
        IncidentStatus.ERADICATED,
        IncidentStatus.RECOVERED,
      ],
    });
  }

  /**
   * Get playbook for incident type
   */
  async getPlaybook(incidentType: IncidentType): Promise<Playbook | null> {
    for (const playbook of playbooks.values()) {
      if (playbook.incidentType === incidentType) {
        return playbook;
      }
    }
    return playbooks.get('default') || null;
  }

  /**
   * Check SLA compliance
   */
  async checkSLACompliance(incidentId: string): Promise<{
    respondSLA: { target: number; actual: number; compliant: boolean };
    containSLA: { target: number; actual: number; compliant: boolean };
  }> {
    const incident = incidents.get(incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }

    const sla = RESPONSE_SLA[incident.severity];
    const now = new Date();
    const detectedTime = incident.detectedAt.getTime();

    const actualRespond =
      incident.metrics.timeToRespond || Math.round((now.getTime() - detectedTime) / 60000);
    const actualContain =
      incident.metrics.timeToContain || Math.round((now.getTime() - detectedTime) / 60000);

    return {
      respondSLA: {
        target: sla.respond,
        actual: actualRespond,
        compliant: actualRespond <= sla.respond,
      },
      containSLA: {
        target: sla.contain,
        actual: actualContain,
        compliant: incident.status === IncidentStatus.DETECTED || actualContain <= sla.contain,
      },
    };
  }

  /**
   * Get metrics for dashboard
   */
  async getMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalIncidents: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    avgTimeToDetect: number;
    avgTimeToRespond: number;
    avgTimeToContain: number;
    avgTimeToResolve: number;
    slaCompliance: number;
  }> {
    const all = Array.from(incidents.values()).filter(
      (i) => i.detectedAt >= startDate && i.detectedAt <= endDate
    );

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalDetect = 0,
      totalRespond = 0,
      totalContain = 0,
      totalResolve = 0;
    let countDetect = 0,
      countRespond = 0,
      countContain = 0,
      countResolve = 0;
    let slaCompliant = 0;

    for (const incident of all) {
      bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
      byType[incident.type] = (byType[incident.type] || 0) + 1;
      byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;

      if (incident.metrics.timeToDetect > 0) {
        totalDetect += incident.metrics.timeToDetect;
        countDetect++;
      }
      if (incident.metrics.timeToRespond > 0) {
        totalRespond += incident.metrics.timeToRespond;
        countRespond++;
        if (incident.metrics.timeToRespond <= RESPONSE_SLA[incident.severity].respond) {
          slaCompliant++;
        }
      }
      if (incident.metrics.timeToContain > 0) {
        totalContain += incident.metrics.timeToContain;
        countContain++;
      }
      if (incident.metrics.timeToResolve) {
        totalResolve += incident.metrics.timeToResolve;
        countResolve++;
      }
    }

    return {
      totalIncidents: all.length,
      bySeverity,
      byType,
      byStatus,
      avgTimeToDetect: countDetect > 0 ? Math.round(totalDetect / countDetect) : 0,
      avgTimeToRespond: countRespond > 0 ? Math.round(totalRespond / countRespond) : 0,
      avgTimeToContain: countContain > 0 ? Math.round(totalContain / countContain) : 0,
      avgTimeToResolve: countResolve > 0 ? Math.round(totalResolve / countResolve) : 0,
      slaCompliance: countRespond > 0 ? Math.round((slaCompliant / countRespond) * 100) : 100,
    };
  }

  // Private helpers

  private getEscalationContact(severity: IncidentSeverity): string {
    switch (severity) {
      case IncidentSeverity.CRITICAL:
        return 'CISO + VP Engineering + CEO';
      case IncidentSeverity.HIGH:
        return 'Security Team Lead + Engineering Manager';
      case IncidentSeverity.MEDIUM:
        return 'Security Team';
      case IncidentSeverity.LOW:
        return 'On-call Engineer';
    }
  }

  private initializePlaybooks(): void {
    // Data breach playbook
    playbooks.set('data_breach', {
      id: 'pb_data_breach',
      name: 'Data Breach Response',
      incidentType: IncidentType.DATA_BREACH,
      severity: [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH],
      steps: [
        {
          order: 1,
          title: 'Initial Assessment',
          description: 'Determine scope and type of data potentially exposed',
          responsible: 'Security Team',
          estimatedMinutes: 30,
          required: true,
          automatable: false,
          checklist: [
            'Identify affected systems',
            'Estimate number of affected users',
            'Classify exposed data types',
            'Document initial findings',
          ],
        },
        {
          order: 2,
          title: 'Containment',
          description: 'Stop the breach and prevent further data loss',
          responsible: 'Security Team + DevOps',
          estimatedMinutes: 60,
          required: true,
          automatable: true,
          checklist: [
            'Isolate affected systems',
            'Revoke compromised credentials',
            'Block suspicious IPs',
            'Enable enhanced monitoring',
          ],
        },
        {
          order: 3,
          title: 'Evidence Collection',
          description: 'Preserve forensic evidence',
          responsible: 'Security Team',
          estimatedMinutes: 120,
          required: true,
          automatable: true,
          checklist: [
            'Capture system logs',
            'Preserve database audit logs',
            'Create disk images if needed',
            'Document attack vectors',
          ],
        },
        {
          order: 4,
          title: 'Regulatory Notification',
          description: 'Notify relevant authorities within required timeframes',
          responsible: 'Legal + CISO',
          estimatedMinutes: 240,
          required: true,
          automatable: false,
          checklist: [
            'Prepare breach notification',
            'Submit to DPA (within 72 hours for GDPR)',
            'Document notification timeline',
          ],
        },
        {
          order: 5,
          title: 'Customer Notification',
          description: 'Notify affected customers',
          responsible: 'Legal + Customer Success',
          estimatedMinutes: 480,
          required: true,
          automatable: true,
          checklist: [
            'Prepare customer communication',
            'Set up support resources',
            'Send notifications',
            'Monitor for inquiries',
          ],
        },
      ],
      escalationPath: ['Security Team Lead', 'CISO', 'CEO', 'Board of Directors'],
      communicationTemplates: {
        internal: 'Security incident detected. Classification: [SEVERITY]. All hands on deck.',
        customer: 'We are writing to inform you of a security incident...',
        regulatory: 'Data Breach Notification per [REGULATION]...',
      },
      lastUpdated: new Date(),
      version: '1.0.0',
    });

    // Default playbook
    playbooks.set('default', {
      id: 'pb_default',
      name: 'General Incident Response',
      incidentType: IncidentType.OTHER,
      severity: [
        IncidentSeverity.CRITICAL,
        IncidentSeverity.HIGH,
        IncidentSeverity.MEDIUM,
        IncidentSeverity.LOW,
      ],
      steps: [
        {
          order: 1,
          title: 'Detection & Triage',
          description: 'Confirm and classify the incident',
          responsible: 'On-call Engineer',
          estimatedMinutes: 15,
          required: true,
          automatable: false,
          checklist: ['Verify the incident', 'Classify severity', 'Assign incident commander'],
        },
        {
          order: 2,
          title: 'Containment',
          description: 'Limit the impact',
          responsible: 'Incident Commander',
          estimatedMinutes: 60,
          required: true,
          automatable: false,
          checklist: ['Identify containment strategy', 'Execute containment', 'Verify containment'],
        },
        {
          order: 3,
          title: 'Eradication',
          description: 'Remove the threat',
          responsible: 'Security Team',
          estimatedMinutes: 120,
          required: true,
          automatable: false,
          checklist: ['Identify root cause', 'Remove threat', 'Verify eradication'],
        },
        {
          order: 4,
          title: 'Recovery',
          description: 'Restore normal operations',
          responsible: 'DevOps + Engineering',
          estimatedMinutes: 240,
          required: true,
          automatable: false,
          checklist: ['Restore systems', 'Verify functionality', 'Monitor for recurrence'],
        },
        {
          order: 5,
          title: 'Post-Incident Review',
          description: 'Document lessons learned',
          responsible: 'Incident Commander',
          estimatedMinutes: 120,
          required: true,
          automatable: false,
          checklist: ['Conduct post-mortem', 'Document lessons learned', 'Update procedures'],
        },
      ],
      escalationPath: ['Team Lead', 'Engineering Manager', 'VP Engineering', 'CEO'],
      communicationTemplates: {
        internal: 'Incident [ID] detected. Severity: [SEVERITY]. Updates to follow.',
      },
      lastUpdated: new Date(),
      version: '1.0.0',
    });
  }
}

export const incidentResponseSystem = new IncidentResponseSystem();
