import { prisma } from '@skillancer/database';
import { EventEmitter } from 'node:events';

// Compliance Tracker Service for CISO Suite
// Manages compliance frameworks, controls, and evidence

export type FrameworkType =
  | 'SOC2_TYPE1'
  | 'SOC2_TYPE2'
  | 'HIPAA'
  | 'PCI_DSS'
  | 'ISO27001'
  | 'GDPR'
  | 'NIST_CSF'
  | 'CIS_CONTROLS'
  | 'CUSTOM';

export type ControlStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'NOT_APPLICABLE'
  | 'FAILED';

export type EvidenceType =
  | 'DOCUMENT'
  | 'SCREENSHOT'
  | 'POLICY'
  | 'LOG'
  | 'CERTIFICATE'
  | 'EXTERNAL_LINK';

export interface ControlInput {
  controlId: string;
  title: string;
  description?: string;
  category?: string;
}

export interface ControlUpdate {
  status?: ControlStatus;
  implementationNotes?: string;
  ownerId?: string;
}

export interface EvidenceInput {
  title: string;
  type: EvidenceType;
  url?: string;
  fileKey?: string;
  uploadedBy: string;
}

export interface ComplianceProgress {
  frameworkId: string;
  framework: FrameworkType;
  totalControls: number;
  implemented: number;
  inProgress: number;
  notStarted: number;
  notApplicable: number;
  failed: number;
  progressPercentage: number;
  targetDate: Date | null;
}

class ComplianceTrackerService extends EventEmitter {
  // Add a compliance framework to an engagement
  async addFramework(engagementId: string, framework: FrameworkType, targetDate?: Date) {
    const created = await prisma.complianceFramework.create({
      data: {
        engagementId,
        framework,
        targetDate,
      },
    });

    // Initialize with default controls for the framework
    await this.initializeControls(created.id, framework);

    this.emit('framework:added', { engagementId, framework });
    return created;
  }

  // Get all frameworks for an engagement
  async getFrameworks(engagementId: string) {
    return prisma.complianceFramework.findMany({
      where: { engagementId },
      include: {
        controls: {
          include: { evidence: true },
        },
      },
    });
  }

  // Get a single framework with controls
  async getFramework(frameworkId: string) {
    return prisma.complianceFramework.findUnique({
      where: { id: frameworkId },
      include: {
        controls: {
          include: { evidence: true },
          orderBy: { controlId: 'asc' },
        },
      },
    });
  }

  // Get controls for a framework
  async getControls(frameworkId: string, filters?: { status?: ControlStatus; category?: string }) {
    return prisma.complianceControl.findMany({
      where: {
        frameworkId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.category && { category: filters.category }),
      },
      include: { evidence: true },
      orderBy: { controlId: 'asc' },
    });
  }

  // Update control status
  async updateControl(controlId: string, updates: ControlUpdate) {
    const control = await prisma.complianceControl.update({
      where: { id: controlId },
      data: updates,
    });

    this.emit('control:updated', { controlId, updates });
    return control;
  }

  // Assign control to an owner
  async assignControl(controlId: string, ownerId: string) {
    return this.updateControl(controlId, { ownerId });
  }

  // Get control gaps (not implemented)
  async getControlGaps(frameworkId: string) {
    return prisma.complianceControl.findMany({
      where: {
        frameworkId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'FAILED'] },
      },
      orderBy: { controlId: 'asc' },
    });
  }

  // Upload evidence for a control
  async uploadEvidence(controlId: string, evidence: EvidenceInput) {
    return prisma.complianceEvidence.create({
      data: {
        controlId,
        title: evidence.title,
        type: evidence.type,
        url: evidence.url,
        fileKey: evidence.fileKey,
        uploadedBy: evidence.uploadedBy,
      },
    });
  }

  // Link external evidence
  async linkEvidence(controlId: string, title: string, url: string, uploadedBy: string) {
    return this.uploadEvidence(controlId, {
      title,
      type: 'EXTERNAL_LINK',
      url,
      uploadedBy,
    });
  }

  // Get evidence for a control
  async getEvidenceByControl(controlId: string) {
    return prisma.complianceEvidence.findMany({
      where: { controlId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  // Calculate compliance progress for a framework
  async calculateComplianceProgress(frameworkId: string): Promise<ComplianceProgress> {
    const framework = await prisma.complianceFramework.findUnique({
      where: { id: frameworkId },
      include: { controls: true },
    });

    if (!framework) {
      throw new Error('Framework not found');
    }

    const controls = framework.controls;
    const total = controls.length;

    const stats = {
      implemented: 0,
      inProgress: 0,
      notStarted: 0,
      notApplicable: 0,
      failed: 0,
    };

    for (const control of controls) {
      switch (control.status) {
        case 'IMPLEMENTED':
          stats.implemented++;
          break;
        case 'IN_PROGRESS':
          stats.inProgress++;
          break;
        case 'NOT_STARTED':
          stats.notStarted++;
          break;
        case 'NOT_APPLICABLE':
          stats.notApplicable++;
          break;
        case 'FAILED':
          stats.failed++;
          break;
      }
    }

    const applicableControls = total - stats.notApplicable;
    const progressPercentage =
      applicableControls > 0 ? (stats.implemented / applicableControls) * 100 : 0;

    return {
      frameworkId,
      framework: framework.framework as FrameworkType,
      totalControls: total,
      ...stats,
      progressPercentage: Math.round(progressPercentage),
      targetDate: framework.targetDate,
    };
  }

  // Get compliance score across all frameworks
  async getComplianceScore(engagementId: string): Promise<number> {
    const frameworks = await this.getFrameworks(engagementId);

    if (frameworks.length === 0) return 0;

    let totalProgress = 0;
    for (const framework of frameworks) {
      const progress = await this.calculateComplianceProgress(framework.id);
      totalProgress += progress.progressPercentage;
    }

    return Math.round(totalProgress / frameworks.length);
  }

  // Get upcoming compliance deadlines
  async getUpcomingDeadlines(engagementId: string, days = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return prisma.complianceFramework.findMany({
      where: {
        engagementId,
        targetDate: {
          gte: new Date(),
          lte: cutoff,
        },
      },
      orderBy: { targetDate: 'asc' },
    });
  }

  // Generate compliance report data
  async generateComplianceReport(frameworkId: string) {
    const framework = await this.getFramework(frameworkId);
    const progress = await this.calculateComplianceProgress(frameworkId);
    const gaps = await this.getControlGaps(frameworkId);

    return {
      framework,
      progress,
      gaps,
      generatedAt: new Date(),
    };
  }

  // Generate gap analysis
  async generateGapAnalysis(frameworkId: string) {
    const gaps = await this.getControlGaps(frameworkId);

    return {
      totalGaps: gaps.length,
      byStatus: {
        notStarted: gaps.filter((g) => g.status === 'NOT_STARTED').length,
        inProgress: gaps.filter((g) => g.status === 'IN_PROGRESS').length,
        failed: gaps.filter((g) => g.status === 'FAILED').length,
      },
      gaps: gaps.map((g) => ({
        controlId: g.controlId,
        title: g.title,
        category: g.category,
        status: g.status,
        owner: g.ownerId,
      })),
    };
  }

  // Initialize default controls for a framework
  private async initializeControls(frameworkId: string, framework: FrameworkType) {
    const controls = this.getDefaultControls(framework);

    for (const control of controls) {
      await prisma.complianceControl.create({
        data: {
          frameworkId,
          controlId: control.controlId,
          title: control.title,
          description: control.description,
          category: control.category,
          status: 'NOT_STARTED',
        },
      });
    }
  }

  // Default control definitions
  private getDefaultControls(framework: FrameworkType): ControlInput[] {
    const controlSets: Record<string, ControlInput[]> = {
      SOC2_TYPE2: [
        {
          controlId: 'CC1.1',
          title: 'COSO Principle 1',
          category: 'Control Environment',
          description: '',
        },
        {
          controlId: 'CC1.2',
          title: 'COSO Principle 2',
          category: 'Control Environment',
          description: '',
        },
        {
          controlId: 'CC2.1',
          title: 'COSO Principle 13',
          category: 'Communication',
          description: '',
        },
        {
          controlId: 'CC3.1',
          title: 'COSO Principle 6',
          category: 'Risk Assessment',
          description: '',
        },
        { controlId: 'CC4.1', title: 'COSO Principle 16', category: 'Monitoring', description: '' },
        {
          controlId: 'CC5.1',
          title: 'COSO Principle 10',
          category: 'Control Activities',
          description: '',
        },
        {
          controlId: 'CC6.1',
          title: 'Logical Access',
          category: 'Logical Access',
          description: '',
        },
        {
          controlId: 'CC7.1',
          title: 'System Operations',
          category: 'System Operations',
          description: '',
        },
        {
          controlId: 'CC8.1',
          title: 'Change Management',
          category: 'Change Management',
          description: '',
        },
        {
          controlId: 'CC9.1',
          title: 'Risk Mitigation',
          category: 'Risk Mitigation',
          description: '',
        },
      ],
      HIPAA: [
        {
          controlId: '164.308(a)(1)',
          title: 'Security Management Process',
          category: 'Administrative',
          description: '',
        },
        {
          controlId: '164.308(a)(2)',
          title: 'Assigned Security Responsibility',
          category: 'Administrative',
          description: '',
        },
        {
          controlId: '164.308(a)(3)',
          title: 'Workforce Security',
          category: 'Administrative',
          description: '',
        },
        {
          controlId: '164.308(a)(4)',
          title: 'Information Access Management',
          category: 'Administrative',
        },
        { controlId: '164.310(a)(1)', title: 'Facility Access Controls', category: 'Physical' },
        { controlId: '164.310(b)', title: 'Workstation Use', category: 'Physical' },
        { controlId: '164.312(a)(1)', title: 'Access Control', category: 'Technical' },
        { controlId: '164.312(b)', title: 'Audit Controls', category: 'Technical' },
        { controlId: '164.312(c)(1)', title: 'Integrity Controls', category: 'Technical' },
        { controlId: '164.312(e)(1)', title: 'Transmission Security', category: 'Technical' },
      ],
    };

    return controlSets[framework] || controlSets['SOC2_TYPE2'];
  }
}

export const complianceTrackerService = new ComplianceTrackerService();
