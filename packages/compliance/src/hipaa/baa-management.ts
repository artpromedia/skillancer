/**
 * HIPAA Business Associate Agreement Management
 * Manages BAAs for customers handling PHI
 */

import { v4 as uuidv4 } from 'uuid';

export enum BAAStatus {
  PENDING = 'pending',
  SENT = 'sent',
  SIGNED = 'signed',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
}

export interface BusinessAssociateAgreement {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: BAAStatus;
  version: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  signedAt?: Date;
  signedBy?: string;
  documentUrl?: string;
  renewalReminder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BreachNotification {
  id: string;
  baaId: string;
  customerId: string;
  breachDate: Date;
  discoveryDate: Date;
  description: string;
  affectedIndividuals: number;
  phiTypes: string[];
  notificationsSent: BreachNotificationRecord[];
  status: BreachNotificationStatus;
  createdAt: Date;
}

export interface BreachNotificationRecord {
  recipientType: 'individual' | 'hhs' | 'media' | 'customer';
  recipientId?: string;
  sentAt: Date;
  method: 'email' | 'mail' | 'portal';
  acknowledged?: boolean;
}

export enum BreachNotificationStatus {
  DETECTED = 'detected',
  INVESTIGATING = 'investigating',
  NOTIFYING = 'notifying',
  COMPLETE = 'complete',
}

export interface PHIAccessLog {
  id: string;
  userId: string;
  customerId: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'export';
  phiType: string;
  recordId: string;
  accessedAt: Date;
  ipAddress: string;
  userAgent: string;
  minimumNecessary: boolean;
  justification?: string;
}

const BAA_TEMPLATE = `
BUSINESS ASSOCIATE AGREEMENT

This Business Associate Agreement ("Agreement") is entered into by and between:

Covered Entity: {{CUSTOMER_NAME}} ("Customer")
Business Associate: Skillancer, Inc. ("Skillancer")

Effective Date: {{EFFECTIVE_DATE}}

1. DEFINITIONS
Terms used in this Agreement shall have the same meaning as those terms in the HIPAA Rules.

2. OBLIGATIONS OF BUSINESS ASSOCIATE
Skillancer agrees to:
a) Not use or disclose PHI other than as permitted by this Agreement
b) Use appropriate safeguards to prevent unauthorized use or disclosure
c) Report any security incidents or breaches
d) Ensure subcontractors agree to the same restrictions
e) Make PHI available to individuals upon request
f) Make internal practices available to HHS
g) Return or destroy all PHI upon termination

3. PERMITTED USES AND DISCLOSURES
Skillancer may use or disclose PHI:
a) As necessary to perform services under the Service Agreement
b) For Skillancer's proper management and administration
c) To provide data aggregation services (de-identified only)

4. SECURITY REQUIREMENTS
Skillancer shall:
a) Implement administrative, physical, and technical safeguards
b) Encrypt all PHI at rest and in transit
c) Maintain audit logs of PHI access
d) Conduct annual security assessments

5. BREACH NOTIFICATION
Skillancer shall notify Customer within 24 hours of discovering a breach.

6. TERM AND TERMINATION
This Agreement is effective until terminated or the underlying Service Agreement ends.

7. SIGNATURES

Customer: _______________________  Date: ___________
Skillancer: ____________________  Date: ___________
`;

export class BAAManager {
  private agreements: Map<string, BusinessAssociateAgreement> = new Map();
  private breachNotifications: Map<string, BreachNotification> = new Map();
  private phiAccessLogs: PHIAccessLog[] = [];

  /**
   * Generate a new BAA for a customer
   */
  generateBAA(
    customerId: string,
    customerName: string,
    customerEmail: string
  ): BusinessAssociateAgreement {
    const now = new Date();
    const expiration = new Date(now);
    expiration.setFullYear(expiration.getFullYear() + 1);

    const baa: BusinessAssociateAgreement = {
      id: uuidv4(),
      customerId,
      customerName,
      customerEmail,
      status: BAAStatus.PENDING,
      version: '2.0',
      expirationDate: expiration,
      renewalReminder: true,
      createdAt: now,
      updatedAt: now,
    };

    this.agreements.set(baa.id, baa);
    return baa;
  }

  /**
   * Get BAA document content
   */
  getBAADocument(baaId: string): string {
    const baa = this.agreements.get(baaId);
    if (!baa) throw new Error('BAA not found');

    return BAA_TEMPLATE.replace('{{CUSTOMER_NAME}}', baa.customerName).replace(
      '{{EFFECTIVE_DATE}}',
      new Date().toISOString().split('T')[0]
    );
  }

  /**
   * Send BAA to customer for signing
   */
  async sendBAA(baaId: string): Promise<void> {
    const baa = this.agreements.get(baaId);
    if (!baa) throw new Error('BAA not found');

    // In production, this would send via DocuSign or similar
    baa.status = BAAStatus.SENT;
    baa.updatedAt = new Date();

    console.log(`BAA sent to ${baa.customerEmail}`);
  }

  /**
   * Record BAA signature
   */
  signBAA(baaId: string, signedBy: string): void {
    const baa = this.agreements.get(baaId);
    if (!baa) throw new Error('BAA not found');

    baa.status = BAAStatus.SIGNED;
    baa.signedAt = new Date();
    baa.signedBy = signedBy;
    baa.effectiveDate = new Date();
    baa.updatedAt = new Date();
  }

  /**
   * Get BAA by customer
   */
  getBAAByCustomer(customerId: string): BusinessAssociateAgreement | undefined {
    return Array.from(this.agreements.values()).find(
      (baa) => baa.customerId === customerId && baa.status === BAAStatus.SIGNED
    );
  }

  /**
   * Get BAAs due for renewal
   */
  getBAAsDueForRenewal(daysBeforeExpiration: number = 30): BusinessAssociateAgreement[] {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysBeforeExpiration);

    return Array.from(this.agreements.values()).filter(
      (baa) =>
        baa.status === BAAStatus.SIGNED &&
        baa.expirationDate &&
        baa.expirationDate <= threshold &&
        baa.renewalReminder
    );
  }

  /**
   * Log PHI access (minimum necessary enforcement)
   */
  logPHIAccess(
    userId: string,
    customerId: string,
    action: PHIAccessLog['action'],
    phiType: string,
    recordId: string,
    ipAddress: string,
    userAgent: string,
    justification?: string
  ): PHIAccessLog {
    // Check if user has valid reason (minimum necessary)
    const minimumNecessary = this.validateMinimumNecessary(userId, action, phiType);

    const log: PHIAccessLog = {
      id: uuidv4(),
      userId,
      customerId,
      action,
      phiType,
      recordId,
      accessedAt: new Date(),
      ipAddress,
      userAgent,
      minimumNecessary,
      justification,
    };

    this.phiAccessLogs.push(log);

    if (!minimumNecessary && !justification) {
      console.warn(`PHI access without minimum necessary justification: ${log.id}`);
    }

    return log;
  }

  /**
   * Get PHI access logs for audit
   */
  getPHIAccessLogs(customerId?: string, startDate?: Date, endDate?: Date): PHIAccessLog[] {
    return this.phiAccessLogs.filter((log) => {
      if (customerId && log.customerId !== customerId) return false;
      if (startDate && log.accessedAt < startDate) return false;
      if (endDate && log.accessedAt > endDate) return false;
      return true;
    });
  }

  /**
   * Report a breach
   */
  reportBreach(
    baaId: string,
    breachDate: Date,
    description: string,
    affectedIndividuals: number,
    phiTypes: string[]
  ): BreachNotification {
    const baa = this.agreements.get(baaId);
    if (!baa) throw new Error('BAA not found');

    const notification: BreachNotification = {
      id: uuidv4(),
      baaId,
      customerId: baa.customerId,
      breachDate,
      discoveryDate: new Date(),
      description,
      affectedIndividuals,
      phiTypes,
      notificationsSent: [],
      status: BreachNotificationStatus.DETECTED,
      createdAt: new Date(),
    };

    this.breachNotifications.set(notification.id, notification);
    return notification;
  }

  /**
   * Send breach notification
   */
  async sendBreachNotification(
    notificationId: string,
    recipientType: BreachNotificationRecord['recipientType'],
    recipientId?: string
  ): Promise<void> {
    const notification = this.breachNotifications.get(notificationId);
    if (!notification) throw new Error('Breach notification not found');

    const record: BreachNotificationRecord = {
      recipientType,
      recipientId,
      sentAt: new Date(),
      method: 'email',
    };

    notification.notificationsSent.push(record);
    notification.status = BreachNotificationStatus.NOTIFYING;

    // HIPAA timelines:
    // - Individuals: Without unreasonable delay, max 60 days
    // - HHS: Within 60 days if < 500 affected, immediately if >= 500
    // - Media: If >= 500 in a state, prominent media outlet

    console.log(`Breach notification sent to ${recipientType}`);
  }

  /**
   * Check HIPAA compliance status for a customer
   */
  getComplianceStatus(customerId: string): {
    hasValidBAA: boolean;
    phiAccessLogged: boolean;
    openBreaches: number;
    complianceScore: number;
  } {
    const baa = this.getBAAByCustomer(customerId);
    const hasValidBAA = !!baa && baa.status === BAAStatus.SIGNED;

    const recentLogs = this.getPHIAccessLogs(
      customerId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const phiAccessLogged = recentLogs.length > 0;

    const openBreaches = Array.from(this.breachNotifications.values()).filter(
      (n) => n.customerId === customerId && n.status !== BreachNotificationStatus.COMPLETE
    ).length;

    let complianceScore = 100;
    if (!hasValidBAA) complianceScore -= 50;
    if (openBreaches > 0) complianceScore -= openBreaches * 20;
    if (recentLogs.some((l) => !l.minimumNecessary && !l.justification)) complianceScore -= 10;

    return {
      hasValidBAA,
      phiAccessLogged,
      openBreaches,
      complianceScore: Math.max(0, complianceScore),
    };
  }

  private validateMinimumNecessary(userId: string, action: string, phiType: string): boolean {
    // In production, this would check user's role and access rights
    // to ensure they only access the minimum PHI necessary for their job
    return true;
  }
}

// Singleton instance
export const baaManager = new BAAManager();
