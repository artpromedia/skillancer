import { prisma } from '@skillancer/database';
import { EventEmitter } from 'events';

// Incident Response Service for CISO Suite
// Manages security incidents, playbooks, and post-mortems

export type IncidentSeverity = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';

export type IncidentStatus =
  | 'DETECTED'
  | 'TRIAGED'
  | 'CONTAINMENT'
  | 'ERADICATION'
  | 'RECOVERY'
  | 'POST_INCIDENT'
  | 'CLOSED';

export interface TimelineEvent {
  timestamp: Date;
  action: string;
  description: string;
  performedBy?: string;
}

export interface IncidentInput {
  title: string;
  description?: string;
  severity: IncidentSeverity;
  detectedAt: Date;
  assignedTo?: string;
  affectedSystems?: string[];
}

export interface IncidentUpdate {
  title?: string;
  description?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  assignedTo?: string;
  affectedSystems?: string[];
  containedAt?: Date;
  resolvedAt?: Date;
}

export interface PlaybookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  incidentTypes: string[];
  steps: PlaybookStep[];
}

class IncidentResponseService extends EventEmitter {
  // Create a new incident
  async createIncident(engagementId: string, incident: IncidentInput) {
    const timeline: TimelineEvent[] = [
      {
        timestamp: new Date(),
        action: 'INCIDENT_CREATED',
        description: `Incident detected: ${incident.title}`,
      },
    ];

    const created = await prisma.securityIncident.create({
      data: {
        engagementId,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: 'DETECTED',
        detectedAt: incident.detectedAt,
        assignedTo: incident.assignedTo,
        affectedSystems: incident.affectedSystems || [],
        timeline: timeline as any,
        lessonsLearned: [],
      },
    });

    this.emit('incident:created', {
      engagementId,
      incidentId: created.id,
      severity: incident.severity,
    });
    return created;
  }

  // Update an incident
  async updateIncident(incidentId: string, updates: IncidentUpdate) {
    const existing = await prisma.securityIncident.findUnique({ where: { id: incidentId } });
    if (!existing) throw new Error('Incident not found');

    // Add timeline event for status changes
    const timeline = (existing.timeline as unknown as TimelineEvent[]) || [];
    if (updates.status && updates.status !== existing.status) {
      timeline.push({
        timestamp: new Date(),
        action: 'STATUS_CHANGED',
        description: `Status changed from ${existing.status} to ${updates.status}`,
      });
    }

    const updated = await prisma.securityIncident.update({
      where: { id: incidentId },
      data: {
        ...updates,
        timeline: timeline as any,
      },
    });

    this.emit('incident:updated', { incidentId, updates });
    return updated;
  }

  // Get incidents for an engagement
  async getIncidents(
    engagementId: string,
    filters?: { status?: IncidentStatus; severity?: IncidentSeverity; active?: boolean }
  ) {
    const activeStatuses: IncidentStatus[] = [
      'DETECTED',
      'TRIAGED',
      'CONTAINMENT',
      'ERADICATION',
      'RECOVERY',
    ];

    return prisma.securityIncident.findMany({
      where: {
        engagementId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.active && { status: { in: activeStatuses } }),
      },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
    });
  }

  // Get a single incident
  async getIncident(incidentId: string) {
    return prisma.securityIncident.findUnique({ where: { id: incidentId } });
  }

  // Get active incidents count by severity
  async getActiveIncidentsSummary(engagementId: string) {
    const active = await this.getIncidents(engagementId, { active: true });

    const bySeverity: Record<IncidentSeverity, number> = {
      P1_CRITICAL: 0,
      P2_HIGH: 0,
      P3_MEDIUM: 0,
      P4_LOW: 0,
    };

    let oldestIncident: Date | null = null;
    let totalDuration = 0;

    for (const incident of active) {
      bySeverity[incident.severity as IncidentSeverity]++;

      if (!oldestIncident || incident.detectedAt < oldestIncident) {
        oldestIncident = incident.detectedAt;
      }

      totalDuration += Date.now() - incident.detectedAt.getTime();
    }

    return {
      total: active.length,
      bySeverity,
      oldestIncident,
      averageDurationHours:
        active.length > 0 ? Math.round(totalDuration / active.length / 3600000) : 0,
    };
  }

  // Add timeline event
  async addTimelineEvent(incidentId: string, event: Omit<TimelineEvent, 'timestamp'>) {
    const incident = await this.getIncident(incidentId);
    if (!incident) throw new Error('Incident not found');

    const timeline = (incident.timeline as unknown as TimelineEvent[]) || [];
    timeline.push({
      ...event,
      timestamp: new Date(),
    });

    return prisma.securityIncident.update({
      where: { id: incidentId },
      data: { timeline: timeline as any },
    });
  }

  // Transition incident to containment
  async markContained(incidentId: string) {
    return this.updateIncident(incidentId, {
      status: 'CONTAINMENT',
      containedAt: new Date(),
    });
  }

  // Resolve incident
  async resolveIncident(incidentId: string) {
    return this.updateIncident(incidentId, {
      status: 'POST_INCIDENT',
      resolvedAt: new Date(),
    });
  }

  // Close incident
  async closeIncident(incidentId: string) {
    return this.updateIncident(incidentId, { status: 'CLOSED' });
  }

  // Get available playbooks
  getPlaybooks(): Playbook[] {
    return [
      {
        id: 'pb-malware',
        name: 'Malware Response',
        description: 'Standard playbook for malware incidents',
        incidentTypes: ['malware', 'ransomware', 'virus'],
        steps: [
          {
            id: 's1',
            order: 1,
            title: 'Isolate affected systems',
            description: 'Disconnect from network',
            completed: false,
          },
          {
            id: 's2',
            order: 2,
            title: 'Preserve evidence',
            description: 'Create forensic images',
            completed: false,
          },
          {
            id: 's3',
            order: 3,
            title: 'Identify malware type',
            description: 'Analyze samples',
            completed: false,
          },
          {
            id: 's4',
            order: 4,
            title: 'Eradicate malware',
            description: 'Remove from all systems',
            completed: false,
          },
          {
            id: 's5',
            order: 5,
            title: 'Restore systems',
            description: 'Restore from clean backups',
            completed: false,
          },
          {
            id: 's6',
            order: 6,
            title: 'Update defenses',
            description: 'Add signatures, update rules',
            completed: false,
          },
        ],
      },
      {
        id: 'pb-phishing',
        name: 'Phishing Response',
        description: 'Response playbook for phishing attacks',
        incidentTypes: ['phishing', 'spear-phishing', 'BEC'],
        steps: [
          {
            id: 's1',
            order: 1,
            title: 'Block sender',
            description: 'Add to block list',
            completed: false,
          },
          {
            id: 's2',
            order: 2,
            title: 'Identify recipients',
            description: 'Check mail logs',
            completed: false,
          },
          {
            id: 's3',
            order: 3,
            title: 'Reset compromised credentials',
            description: 'Force password reset',
            completed: false,
          },
          {
            id: 's4',
            order: 4,
            title: 'Scan for IOCs',
            description: 'Check for malicious payloads',
            completed: false,
          },
          {
            id: 's5',
            order: 5,
            title: 'User notification',
            description: 'Alert affected users',
            completed: false,
          },
        ],
      },
      {
        id: 'pb-data-breach',
        name: 'Data Breach Response',
        description: 'Response for data breach incidents',
        incidentTypes: ['data-breach', 'data-leak', 'unauthorized-access'],
        steps: [
          {
            id: 's1',
            order: 1,
            title: 'Contain breach',
            description: 'Stop ongoing exfiltration',
            completed: false,
          },
          {
            id: 's2',
            order: 2,
            title: 'Assess scope',
            description: 'Determine affected data',
            completed: false,
          },
          {
            id: 's3',
            order: 3,
            title: 'Notify legal',
            description: 'Engage legal counsel',
            completed: false,
          },
          {
            id: 's4',
            order: 4,
            title: 'Regulatory notification',
            description: 'File required notifications',
            completed: false,
          },
          {
            id: 's5',
            order: 5,
            title: 'Customer notification',
            description: 'Notify affected parties',
            completed: false,
          },
          {
            id: 's6',
            order: 6,
            title: 'Remediation',
            description: 'Fix vulnerability',
            completed: false,
          },
        ],
      },
    ];
  }

  // Get playbook by ID
  getPlaybook(playbookId: string): Playbook | undefined {
    return this.getPlaybooks().find((p) => p.id === playbookId);
  }

  // Create post-mortem
  async createPostMortem(incidentId: string, postMortem: string) {
    return prisma.securityIncident.update({
      where: { id: incidentId },
      data: { postMortem },
    });
  }

  // Add lessons learned
  async addLessonsLearned(incidentId: string, lessons: string[]) {
    const incident = await this.getIncident(incidentId);
    if (!incident) throw new Error('Incident not found');

    const existing = incident.lessonsLearned || [];
    const updated = [...existing, ...lessons];

    return prisma.securityIncident.update({
      where: { id: incidentId },
      data: { lessonsLearned: updated },
    });
  }

  // Get incident metrics
  async getIncidentMetrics(engagementId: string, dateRange: { start: Date; end: Date }) {
    const incidents = await prisma.securityIncident.findMany({
      where: {
        engagementId,
        detectedAt: { gte: dateRange.start, lte: dateRange.end },
      },
    });

    let totalTimeToContain = 0;
    let totalTimeToResolve = 0;
    let containedCount = 0;
    let resolvedCount = 0;

    for (const incident of incidents) {
      if (incident.containedAt) {
        totalTimeToContain += incident.containedAt.getTime() - incident.detectedAt.getTime();
        containedCount++;
      }
      if (incident.resolvedAt) {
        totalTimeToResolve += incident.resolvedAt.getTime() - incident.detectedAt.getTime();
        resolvedCount++;
      }
    }

    return {
      total: incidents.length,
      mttr: resolvedCount > 0 ? Math.round(totalTimeToResolve / resolvedCount / 3600000) : 0, // Mean time to resolve (hours)
      mttc: containedCount > 0 ? Math.round(totalTimeToContain / containedCount / 3600000) : 0, // Mean time to contain (hours)
      bySeverity: {
        P1_CRITICAL: incidents.filter((i) => i.severity === 'P1_CRITICAL').length,
        P2_HIGH: incidents.filter((i) => i.severity === 'P2_HIGH').length,
        P3_MEDIUM: incidents.filter((i) => i.severity === 'P3_MEDIUM').length,
        P4_LOW: incidents.filter((i) => i.severity === 'P4_LOW').length,
      },
    };
  }
}

export const incidentResponseService = new IncidentResponseService();
