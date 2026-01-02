/**
 * SOC 2 Control Mapping
 * Maps Skillancer features to SOC 2 Trust Service Criteria controls
 */

import { TrustServiceCriteria } from './evidence-collector';

export enum ControlStatus {
  IMPLEMENTED = 'implemented',
  PARTIAL = 'partial',
  NOT_IMPLEMENTED = 'not_implemented',
  NOT_APPLICABLE = 'not_applicable',
}

export interface Control {
  id: string;
  criteria: TrustServiceCriteria;
  name: string;
  description: string;
  status: ControlStatus;
  skillancerFeatures: string[];
  evidenceTypes: string[];
  testingProcedures: string[];
  gaps: string[];
  remediationPlan?: string;
  owner: string;
  lastReviewed?: Date;
}

export interface ControlCategory {
  id: string;
  name: string;
  criteria: TrustServiceCriteria;
  controls: Control[];
}

export interface GapAnalysis {
  totalControls: number;
  implemented: number;
  partial: number;
  notImplemented: number;
  notApplicable: number;
  compliancePercentage: number;
  criticalGaps: Control[];
  recommendations: string[];
}

// SOC 2 Control Definitions
export const SOC2_CONTROLS: ControlCategory[] = [
  // CC1: Control Environment
  {
    id: 'CC1',
    name: 'Control Environment',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC1.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 1',
        description: 'The entity demonstrates a commitment to integrity and ethical values',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Code of conduct', 'Employee handbook', 'Ethics training'],
        evidenceTypes: ['policy_acknowledgment', 'training_completion'],
        testingProcedures: ['Review code of conduct', 'Verify training completion'],
        gaps: [],
        owner: 'HR',
      },
      {
        id: 'CC1.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 2',
        description: 'The board of directors demonstrates independence from management',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Board charter', 'Audit committee'],
        evidenceTypes: ['policy_acknowledgment'],
        testingProcedures: ['Review board meeting minutes'],
        gaps: [],
        owner: 'Legal',
      },
      {
        id: 'CC1.3',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 3',
        description: 'Management establishes structures, reporting lines, and authorities',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Org chart', 'Admin roles', 'Approval workflows'],
        evidenceTypes: ['access_control_log'],
        testingProcedures: ['Review org structure', 'Verify role assignments'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC1.4',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 4',
        description: 'The entity demonstrates commitment to attract and retain competent individuals',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['HR policies', 'Performance reviews', 'Training programs'],
        evidenceTypes: ['training_completion'],
        testingProcedures: ['Review HR policies', 'Verify training records'],
        gaps: [],
        owner: 'HR',
      },
      {
        id: 'CC1.5',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 5',
        description: 'The entity holds individuals accountable for internal control responsibilities',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Job descriptions', 'Performance metrics', 'Audit logging'],
        evidenceTypes: ['audit_log', 'access_review'],
        testingProcedures: ['Review accountability structures'],
        gaps: [],
        owner: 'HR',
      },
    ],
  },
  // CC2: Communication and Information
  {
    id: 'CC2',
    name: 'Communication and Information',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC2.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 13',
        description: 'The entity obtains and uses relevant, quality information',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Audit logs', 'Metrics dashboard', 'Alerting system'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Review logging completeness', 'Verify alert configuration'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC2.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 14',
        description: 'The entity internally communicates information necessary for internal control',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Notification service', 'Slack integration', 'Email alerts'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Review communication channels'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC2.3',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 15',
        description: 'The entity communicates with external parties',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Status page', 'Customer notifications', 'Privacy policy'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Review external communications'],
        gaps: [],
        owner: 'Legal',
      },
    ],
  },
  // CC3: Risk Assessment
  {
    id: 'CC3',
    name: 'Risk Assessment',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC3.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 6',
        description: 'The entity specifies objectives with sufficient clarity',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Security objectives', 'SLAs', 'KPIs'],
        evidenceTypes: ['policy_acknowledgment'],
        testingProcedures: ['Review documented objectives'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC3.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 7',
        description: 'The entity identifies and analyzes risks',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Vulnerability scanning', 'Threat modeling', 'Risk register'],
        evidenceTypes: ['vulnerability_scan'],
        testingProcedures: ['Review risk assessments', 'Verify scan results'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC3.3',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 8',
        description: 'The entity considers the potential for fraud',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Fraud detection', 'Anomaly alerts', 'Audit trails'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Review fraud controls'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC3.4',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 9',
        description: 'The entity identifies and assesses changes',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Change management', 'PR reviews', 'Deployment tracking'],
        evidenceTypes: ['change_management'],
        testingProcedures: ['Review change control process'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // CC4: Monitoring Activities
  {
    id: 'CC4',
    name: 'Monitoring Activities',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC4.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 16',
        description: 'The entity selects and develops ongoing and separate evaluations',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Datadog monitoring', 'Sentry error tracking', 'Health checks'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Review monitoring configuration'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC4.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 17',
        description: 'The entity evaluates and communicates deficiencies',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Alerting', 'Incident management', 'Post-mortems'],
        evidenceTypes: ['incident_response'],
        testingProcedures: ['Review incident response records'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // CC5: Control Activities
  {
    id: 'CC5',
    name: 'Control Activities',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC5.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 10',
        description: 'The entity selects and develops control activities',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Access controls', 'Encryption', 'Input validation'],
        evidenceTypes: ['access_control_log', 'encryption_status'],
        testingProcedures: ['Review control implementation'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC5.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 11',
        description: 'The entity deploys control activities through policies',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Security policies', 'Automated enforcement'],
        evidenceTypes: ['policy_acknowledgment'],
        testingProcedures: ['Review policy enforcement'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC5.3',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'COSO Principle 12',
        description: 'The entity uses technology controls',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['WAF', 'DDoS protection', 'SIEM'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Review technology controls'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // CC6: Logical and Physical Access Controls
  {
    id: 'CC6',
    name: 'Logical and Physical Access Controls',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC6.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Logical Access Security',
        description: 'Access to systems is restricted through logical access controls',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Auth service', 'RBAC', 'Session management'],
        evidenceTypes: ['access_control_log'],
        testingProcedures: ['Test authentication flows', 'Verify role enforcement'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC6.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Access Provisioning',
        description: 'New access is provisioned based on authorization',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['User management', 'Role assignment', 'Approval workflows'],
        evidenceTypes: ['access_control_log', 'access_review'],
        testingProcedures: ['Review provisioning process'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC6.3',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Access Removal',
        description: 'Access is removed when no longer needed',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Deprovisioning', 'Account termination'],
        evidenceTypes: ['access_control_log', 'access_review'],
        testingProcedures: ['Review deprovisioning process'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC6.6',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Multi-Factor Authentication',
        description: 'MFA protects against unauthorized access',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['MFA enrollment', 'TOTP', 'Recovery codes'],
        evidenceTypes: ['access_control_log'],
        testingProcedures: ['Test MFA enforcement'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'CC6.7',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Encryption',
        description: 'Data is protected using encryption',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['TLS 1.3', 'AES-256 at rest', 'Key management'],
        evidenceTypes: ['encryption_status'],
        testingProcedures: ['Verify encryption configuration'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // CC7: System Operations
  {
    id: 'CC7',
    name: 'System Operations',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC7.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Vulnerability Management',
        description: 'Vulnerabilities are identified and addressed',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Vulnerability scanning', 'Dependency updates', 'Patch management'],
        evidenceTypes: ['vulnerability_scan'],
        testingProcedures: ['Review scan results', 'Verify patch status'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC7.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Incident Detection',
        description: 'Security incidents are detected',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['SIEM', 'Alerting', 'Anomaly detection'],
        evidenceTypes: ['audit_log', 'incident_response'],
        testingProcedures: ['Test incident detection'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC7.3',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Incident Response',
        description: 'Security incidents are responded to',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Incident management', 'Playbooks', 'Post-mortems'],
        evidenceTypes: ['incident_response'],
        testingProcedures: ['Review incident response procedures'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC7.4',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'SkillPod Containment',
        description: 'Code execution is securely contained',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['SkillPod isolation', 'Seccomp', 'Network policies'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Test containment boundaries'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // CC8: Change Management
  {
    id: 'CC8',
    name: 'Change Management',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC8.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Change Control',
        description: 'Changes are authorized, tested, and documented',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['CI/CD', 'PR reviews', 'Automated testing', 'Deployment tracking'],
        evidenceTypes: ['change_management'],
        testingProcedures: ['Review change management process'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // CC9: Risk Mitigation
  {
    id: 'CC9',
    name: 'Risk Mitigation',
    criteria: TrustServiceCriteria.SECURITY,
    controls: [
      {
        id: 'CC9.1',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Risk Mitigation',
        description: 'Risks are mitigated to acceptable levels',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Risk register', 'Mitigation plans', 'Insurance'],
        evidenceTypes: ['policy_acknowledgment'],
        testingProcedures: ['Review risk mitigation'],
        gaps: [],
        owner: 'Security',
      },
      {
        id: 'CC9.2',
        criteria: TrustServiceCriteria.SECURITY,
        name: 'Business Continuity',
        description: 'Business continuity plans exist and are tested',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['DR plan', 'Backup systems', 'Failover testing'],
        evidenceTypes: ['backup_verification'],
        testingProcedures: ['Review BCP', 'Verify DR testing'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // Availability
  {
    id: 'A1',
    name: 'Availability',
    criteria: TrustServiceCriteria.AVAILABILITY,
    controls: [
      {
        id: 'A1.1',
        criteria: TrustServiceCriteria.AVAILABILITY,
        name: 'Capacity Planning',
        description: 'System capacity meets availability commitments',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Auto-scaling', 'Capacity monitoring', 'Load testing'],
        evidenceTypes: ['audit_log'],
        testingProcedures: ['Review capacity metrics'],
        gaps: [],
        owner: 'Engineering',
      },
      {
        id: 'A1.2',
        criteria: TrustServiceCriteria.AVAILABILITY,
        name: 'Backup and Recovery',
        description: 'Data is backed up and recoverable',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Automated backups', 'Cross-region replication', 'Recovery testing'],
        evidenceTypes: ['backup_verification'],
        testingProcedures: ['Verify backup status', 'Test restoration'],
        gaps: [],
        owner: 'Engineering',
      },
    ],
  },
  // Confidentiality
  {
    id: 'C1',
    name: 'Confidentiality',
    criteria: TrustServiceCriteria.CONFIDENTIALITY,
    controls: [
      {
        id: 'C1.1',
        criteria: TrustServiceCriteria.CONFIDENTIALITY,
        name: 'Data Protection',
        description: 'Confidential information is protected',
        status: ControlStatus.IMPLEMENTED,
        skillancerFeatures: ['Encryption', 'Access controls', 'Data classification'],
        evidenceTypes: ['encryption_status', 'access_control_log'],
        testingProcedures: ['Verify encryption', 'Test access controls'],
        gaps: [],
        owner: 'Security',
      },
    ],
  },
];

export class ControlMapper {
  private controls: Map<string, Control> = new Map();

  constructor() {
    this.loadControls();
  }

  private loadControls(): void {
    SOC2_CONTROLS.forEach((category) => {
      category.controls.forEach((control) => {
        this.controls.set(control.id, control);
      });
    });
  }

  /**
   * Get all control categories
   */
  getCategories(): ControlCategory[] {
    return SOC2_CONTROLS;
  }

  /**
   * Get a specific control
   */
  getControl(controlId: string): Control | undefined {
    return this.controls.get(controlId);
  }

  /**
   * Get controls by criteria
   */
  getControlsByCriteria(criteria: TrustServiceCriteria): Control[] {
    return Array.from(this.controls.values()).filter((c) => c.criteria === criteria);
  }

  /**
   * Get controls by status
   */
  getControlsByStatus(status: ControlStatus): Control[] {
    return Array.from(this.controls.values()).filter((c) => c.status === status);
  }

  /**
   * Update control status
   */
  updateControlStatus(controlId: string, status: ControlStatus, gaps?: string[]): void {
    const control = this.controls.get(controlId);
    if (control) {
      control.status = status;
      if (gaps) control.gaps = gaps;
      control.lastReviewed = new Date();
    }
  }

  /**
   * Generate gap analysis report
   */
  generateGapAnalysis(): GapAnalysis {
    const controls = Array.from(this.controls.values());
    const implemented = controls.filter((c) => c.status === ControlStatus.IMPLEMENTED).length;
    const partial = controls.filter((c) => c.status === ControlStatus.PARTIAL).length;
    const notImplemented = controls.filter((c) => c.status === ControlStatus.NOT_IMPLEMENTED).length;
    const notApplicable = controls.filter((c) => c.status === ControlStatus.NOT_APPLICABLE).length;

    const applicableControls = controls.length - notApplicable;
    const compliancePercentage = applicableControls > 0
      ? Math.round(((implemented + partial * 0.5) / applicableControls) * 100)
      : 0;

    const criticalGaps = controls.filter(
      (c) => c.status === ControlStatus.NOT_IMPLEMENTED && c.gaps.length > 0,
    );

    const recommendations = this.generateRecommendations(controls);

    return {
      totalControls: controls.length,
      implemented,
      partial,
      notImplemented,
      notApplicable,
      compliancePercentage,
      criticalGaps,
      recommendations,
    };
  }

  private generateRecommendations(controls: Control[]): string[] {
    const recommendations: string[] = [];

    const notImplemented = controls.filter((c) => c.status === ControlStatus.NOT_IMPLEMENTED);
    if (notImplemented.length > 0) {
      recommendations.push(
        `Prioritize implementation of ${notImplemented.length} controls that are not yet implemented`,
      );
    }

    const partial = controls.filter((c) => c.status === ControlStatus.PARTIAL);
    if (partial.length > 0) {
      recommendations.push(
        `Complete implementation of ${partial.length} partially implemented controls`,
      );
    }

    const noRecentReview = controls.filter(
      (c) => !c.lastReviewed || Date.now() - c.lastReviewed.getTime() > 90 * 24 * 60 * 60 * 1000,
    );
    if (noRecentReview.length > 0) {
      recommendations.push(
        `Review ${noRecentReview.length} controls that haven't been reviewed in 90+ days`,
      );
    }

    return recommendations;
  }

  /**
   * Export control matrix for auditors
   */
  exportControlMatrix(): Record<string, unknown>[] {
    return Array.from(this.controls.values()).map((c) => ({
      controlId: c.id,
      category: c.criteria,
      name: c.name,
      description: c.description,
      status: c.status,
      features: c.skillancerFeatures.join(', '),
      evidenceTypes: c.evidenceTypes.join(', '),
      gaps: c.gaps.join(', '),
      owner: c.owner,
      lastReviewed: c.lastReviewed?.toISOString() || 'Never',
    }));
  }
}

// Singleton instance
export const controlMapper = new ControlMapper();
