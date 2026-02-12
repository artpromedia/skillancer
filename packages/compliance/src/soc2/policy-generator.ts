/**
 * SOC 2 Policy Document Generator
 * Generates required compliance policy documents from templates
 */

import { v4 as uuidv4 } from 'uuid';

export enum PolicyType {
  INFORMATION_SECURITY = 'information_security',
  ACCESS_CONTROL = 'access_control',
  CHANGE_MANAGEMENT = 'change_management',
  INCIDENT_RESPONSE = 'incident_response',
  BUSINESS_CONTINUITY = 'business_continuity',
  DATA_CLASSIFICATION = 'data_classification',
  ACCEPTABLE_USE = 'acceptable_use',
  VENDOR_MANAGEMENT = 'vendor_management',
  DATA_RETENTION = 'data_retention',
  PASSWORD_POLICY = 'password_policy',
}

export enum PolicyStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  ARCHIVED = 'archived',
}

export interface Policy {
  id: string;
  type: PolicyType;
  title: string;
  version: string;
  status: PolicyStatus;
  content: string;
  effectiveDate: Date;
  nextReviewDate: Date;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyAcknowledgment {
  id: string;
  policyId: string;
  userId: string;
  userName: string;
  acknowledgedAt: Date;
  version: string;
}

export interface PolicyTemplate {
  type: PolicyType;
  title: string;
  sections: PolicySection[];
}

export interface PolicySection {
  heading: string;
  content: string;
  variables: string[];
}

// Policy Templates
const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    type: PolicyType.INFORMATION_SECURITY,
    title: 'Information Security Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy establishes the framework for protecting {{COMPANY_NAME}}'s information assets, systems, and data from unauthorized access, disclosure, modification, or destruction.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. Scope',
        content: `This policy applies to all employees, contractors, and third parties who access {{COMPANY_NAME}} systems and data.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '3. Roles and Responsibilities',
        content: `- **CISO**: Overall responsibility for information security\n- **Engineering**: Implementation of security controls\n- **All Employees**: Compliance with security policies`,
        variables: [],
      },
      {
        heading: '4. Data Protection',
        content: `All data must be classified and protected according to the Data Classification Policy. Encryption is required for data at rest (AES-256) and in transit (TLS 1.3).`,
        variables: [],
      },
      {
        heading: '5. Access Control',
        content: `Access to systems follows the principle of least privilege. Multi-factor authentication is required for all privileged access.`,
        variables: [],
      },
      {
        heading: '6. Incident Response',
        content: `Security incidents must be reported immediately to {{SECURITY_EMAIL}}. See Incident Response Policy for procedures.`,
        variables: ['SECURITY_EMAIL'],
      },
      {
        heading: '7. Compliance',
        content: `Violations of this policy may result in disciplinary action up to and including termination.`,
        variables: [],
      },
    ],
  },
  {
    type: PolicyType.ACCESS_CONTROL,
    title: 'Access Control Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy defines requirements for controlling access to {{COMPANY_NAME}} systems and data.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. User Account Management',
        content: `- Unique user IDs required for all users\n- Accounts provisioned based on manager approval\n- Accounts disabled within 24 hours of termination\n- Quarterly access reviews required`,
        variables: [],
      },
      {
        heading: '3. Authentication Requirements',
        content: `- Minimum password length: 12 characters\n- Password complexity required\n- MFA required for: Admin access, VPN, Production systems\n- Session timeout: 30 minutes idle`,
        variables: [],
      },
      {
        heading: '4. Privileged Access',
        content: `- Just-in-time access for admin functions\n- Maximum 4-hour sessions\n- All privileged actions logged\n- Break-glass procedures documented`,
        variables: [],
      },
      {
        heading: '5. Remote Access',
        content: `- VPN required for remote access to internal systems\n- Company-managed devices only\n- Split tunneling prohibited`,
        variables: [],
      },
    ],
  },
  {
    type: PolicyType.CHANGE_MANAGEMENT,
    title: 'Change Management Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy ensures changes to {{COMPANY_NAME}} systems are properly authorized, tested, and documented.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. Change Categories',
        content: `- **Standard**: Pre-approved, low-risk changes\n- **Normal**: Require CAB approval\n- **Emergency**: Expedited approval process`,
        variables: [],
      },
      {
        heading: '3. Change Process',
        content: `1. Submit change request with business justification\n2. Impact and risk assessment\n3. Approval from change owner\n4. Testing in staging environment\n5. Scheduled deployment with rollback plan\n6. Post-implementation review`,
        variables: [],
      },
      {
        heading: '4. Code Review Requirements',
        content: `- All code changes require peer review\n- Minimum one approval required\n- Security review for sensitive changes\n- Automated testing must pass`,
        variables: [],
      },
      {
        heading: '5. Rollback Procedures',
        content: `All changes must have documented rollback procedures. Rollbacks can be initiated by on-call engineers.`,
        variables: [],
      },
    ],
  },
  {
    type: PolicyType.INCIDENT_RESPONSE,
    title: 'Incident Response Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy establishes procedures for detecting, responding to, and recovering from security incidents at {{COMPANY_NAME}}.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. Incident Classification',
        content: `- **P0 Critical**: Data breach, complete outage (24hr SLA)\n- **P1 High**: Partial outage, security event (7 day SLA)\n- **P2 Medium**: Degraded performance (30 day SLA)\n- **P3 Low**: Minor issues (90 day SLA)`,
        variables: [],
      },
      {
        heading: '3. Incident Response Team',
        content: `- Incident Commander: Coordinates response\n- Technical Lead: Leads investigation\n- Communications Lead: Internal/external comms\n- Security Lead: Security-specific incidents`,
        variables: [],
      },
      {
        heading: '4. Response Phases',
        content: `1. **Detection**: Identify and validate incident\n2. **Triage**: Assess severity and impact\n3. **Containment**: Limit incident spread\n4. **Eradication**: Remove threat\n5. **Recovery**: Restore normal operations\n6. **Post-mortem**: Document lessons learned`,
        variables: [],
      },
      {
        heading: '5. Communication',
        content: `- Internal: #incidents channel\n- Customer: Status page updates\n- Regulatory: As required by law`,
        variables: [],
      },
    ],
  },
  {
    type: PolicyType.BUSINESS_CONTINUITY,
    title: 'Business Continuity Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy ensures {{COMPANY_NAME}} can continue critical operations during and after a disaster.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. Recovery Objectives',
        content: `- Recovery Point Objective (RPO): 1 hour\n- Recovery Time Objective (RTO): 4 hours\n- Maximum Tolerable Downtime: 24 hours`,
        variables: [],
      },
      {
        heading: '3. Backup Requirements',
        content: `- Database: Continuous replication + daily snapshots\n- File storage: Cross-region replication\n- Configuration: Version controlled\n- Retention: Minimum 30 days`,
        variables: [],
      },
      {
        heading: '4. Disaster Recovery',
        content: `- Primary region: {{PRIMARY_REGION}}\n- DR region: {{DR_REGION}}\n- Failover: Automated via Route53\n- Testing: Quarterly DR drills`,
        variables: ['PRIMARY_REGION', 'DR_REGION'],
      },
      {
        heading: '5. Critical Services',
        content: `Priority 1: Authentication, Core API\nPriority 2: Payments, Messaging\nPriority 3: Analytics, Reporting`,
        variables: [],
      },
    ],
  },
  {
    type: PolicyType.DATA_CLASSIFICATION,
    title: 'Data Classification Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy defines how {{COMPANY_NAME}} classifies and handles data based on sensitivity.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. Classification Levels',
        content: `- **Public**: Information intended for public release\n- **Internal**: General business information\n- **Confidential**: Sensitive business data\n- **Restricted**: Highly sensitive (PII, PHI, financial)`,
        variables: [],
      },
      {
        heading: '3. Handling Requirements',
        content: `| Level | Encryption | Access | Retention |\n|-------|------------|--------|----------|\n| Public | Optional | Unrestricted | Business need |\n| Internal | In transit | Employees | 3 years |\n| Confidential | At rest + transit | Need to know | 7 years |\n| Restricted | At rest + transit + app | Explicit approval | Legal requirement |`,
        variables: [],
      },
      {
        heading: '4. PII and PHI',
        content: `Personal Identifiable Information and Protected Health Information are classified as Restricted and subject to additional HIPAA requirements.`,
        variables: [],
      },
    ],
  },
  {
    type: PolicyType.ACCEPTABLE_USE,
    title: 'Acceptable Use Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy defines acceptable use of {{COMPANY_NAME}} technology resources.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. Acceptable Use',
        content: `- Business purposes\n- Professional communication\n- Authorized software only\n- Following security policies`,
        variables: [],
      },
      {
        heading: '3. Prohibited Activities',
        content: `- Unauthorized access attempts\n- Sharing credentials\n- Installing unapproved software\n- Accessing inappropriate content\n- Circumventing security controls`,
        variables: [],
      },
      {
        heading: '4. Monitoring',
        content: `{{COMPANY_NAME}} reserves the right to monitor use of company resources. Users have no expectation of privacy.`,
        variables: ['COMPANY_NAME'],
      },
    ],
  },
  {
    type: PolicyType.VENDOR_MANAGEMENT,
    title: 'Vendor Management Policy',
    sections: [
      {
        heading: '1. Purpose',
        content: `This policy establishes requirements for managing third-party vendors at {{COMPANY_NAME}}.`,
        variables: ['COMPANY_NAME'],
      },
      {
        heading: '2. Vendor Assessment',
        content: `All vendors with access to company data must complete:\n- Security questionnaire\n- SOC 2 report review (if applicable)\n- Contract review`,
        variables: [],
      },
      {
        heading: '3. Contractual Requirements',
        content: `Vendor contracts must include:\n- Data protection obligations\n- Breach notification requirements\n- Right to audit\n- Termination and data return`,
        variables: [],
      },
      {
        heading: '4. Ongoing Monitoring',
        content: `- Annual vendor reviews\n- Security incident monitoring\n- Performance tracking`,
        variables: [],
      },
    ],
  },
];

export class PolicyGenerator {
  private policies: Map<string, Policy> = new Map();
  private acknowledgments: Map<string, PolicyAcknowledgment[]> = new Map();
  private variables: Map<string, string> = new Map();

  constructor() {
    this.setDefaultVariables();
  }

  private setDefaultVariables(): void {
    this.variables.set('COMPANY_NAME', 'Skillancer');
    this.variables.set('SECURITY_EMAIL', 'security@skillancer.com');
    this.variables.set('PRIMARY_REGION', 'us-east-1');
    this.variables.set('DR_REGION', 'us-west-2');
  }

  /**
   * Set template variables
   */
  setVariable(name: string, value: string): void {
    this.variables.set(name, value);
  }

  /**
   * Generate a policy from template
   */
  generatePolicy(type: PolicyType): Policy {
    const template = POLICY_TEMPLATES.find((t) => t.type === type);
    if (!template) {
      throw new Error(`No template found for policy type: ${type}`);
    }

    const content = this.renderTemplate(template);
    const now = new Date();
    const nextReview = new Date(now);
    nextReview.setFullYear(nextReview.getFullYear() + 1);

    const policy: Policy = {
      id: uuidv4(),
      type,
      title: template.title,
      version: '1.0.0',
      status: PolicyStatus.DRAFT,
      content,
      effectiveDate: now,
      nextReviewDate: nextReview,
      createdAt: now,
      updatedAt: now,
    };

    this.policies.set(policy.id, policy);
    return policy;
  }

  /**
   * Generate all required policies
   */
  generateAllPolicies(): Policy[] {
    return POLICY_TEMPLATES.map((template) => this.generatePolicy(template.type));
  }

  /**
   * Approve a policy
   */
  approvePolicy(policyId: string, approverName: string): void {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error('Policy not found');

    policy.status = PolicyStatus.APPROVED;
    policy.approvedBy = approverName;
    policy.approvedAt = new Date();
    policy.updatedAt = new Date();
  }

  /**
   * Record policy acknowledgment
   */
  acknowledgePolicy(policyId: string, userId: string, userName: string): PolicyAcknowledgment {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error('Policy not found');

    const ack: PolicyAcknowledgment = {
      id: uuidv4(),
      policyId,
      userId,
      userName,
      acknowledgedAt: new Date(),
      version: policy.version,
    };

    const existing = this.acknowledgments.get(policyId) || [];
    existing.push(ack);
    this.acknowledgments.set(policyId, existing);

    return ack;
  }

  /**
   * Get acknowledgments for a policy
   */
  getAcknowledgments(policyId: string): PolicyAcknowledgment[] {
    return this.acknowledgments.get(policyId) || [];
  }

  /**
   * Check if user has acknowledged policy
   */
  hasAcknowledged(policyId: string, userId: string): boolean {
    const acks = this.acknowledgments.get(policyId) || [];
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    return acks.some((a) => a.userId === userId && a.version === policy.version);
  }

  /**
   * Get policies due for review
   */
  getPoliciesDueForReview(): Policy[] {
    const now = new Date();
    return Array.from(this.policies.values()).filter(
      (p) => p.status === PolicyStatus.APPROVED && p.nextReviewDate <= now
    );
  }

  /**
   * Update policy version
   */
  updatePolicy(policyId: string, content: string): void {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error('Policy not found');

    const [major, minor, patch] = policy.version.split('.').map(Number);
    policy.version = `${major}.${minor}.${patch + 1}`;
    policy.content = content;
    policy.status = PolicyStatus.PENDING_REVIEW;
    policy.updatedAt = new Date();
  }

  /**
   * Export policy as Markdown
   */
  exportAsMarkdown(policyId: string): string {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error('Policy not found');

    const header =
      `# ${policy.title}\n\n` +
      `**Version:** ${policy.version}\n` +
      `**Status:** ${policy.status}\n` +
      `**Effective Date:** ${policy.effectiveDate.toISOString().split('T')[0]}\n` +
      `**Next Review:** ${policy.nextReviewDate.toISOString().split('T')[0]}\n\n---\n\n`;

    return header + policy.content;
  }

  private renderTemplate(template: PolicyTemplate): string {
    return template.sections
      .map((section) => {
        let content = section.content;
        section.variables.forEach((varName) => {
          const value = this.variables.get(varName) || `{{${varName}}}`;
          content = content.replace(new RegExp(`{{${varName}}}`, 'g'), value);
        });
        return `## ${section.heading}\n\n${content}`;
      })
      .join('\n\n');
  }
}

// Singleton instance
export const policyGenerator = new PolicyGenerator();
