// @ts-nocheck
/**
 * Tax Documents Service
 * 1099 generation, storage, and delivery
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'tax-documents' });

// ============================================================================
// TYPES
// ============================================================================

export type DocumentType = '1099-K' | '1099-NEC' | '1099-MISC' | 'W-9' | 'tax-summary';
export type DocumentStatus = 'draft' | 'pending' | 'filed' | 'delivered' | 'corrected';

export interface TaxDocument {
  id: string;
  userId: string;
  type: DocumentType;
  taxYear: number;
  status: DocumentStatus;
  amount: number;
  payer?: PayerInfo;
  recipient: RecipientInfo;
  fileUrl?: string;
  filedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayerInfo {
  name: string;
  tin: string;
  address: Address;
}

export interface RecipientInfo {
  name: string;
  tinLast4: string;
  tinType: 'SSN' | 'EIN' | 'ITIN';
  address: Address;
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Form1099K {
  id: string;
  taxYear: number;
  payerInfo: PayerInfo;
  payeeInfo: RecipientInfo;
  grossAmount: number;
  cardNotPresent: number;
  januaryAmount: number;
  februaryAmount: number;
  marchAmount: number;
  aprilAmount: number;
  mayAmount: number;
  juneAmount: number;
  julyAmount: number;
  augustAmount: number;
  septemberAmount: number;
  octoberAmount: number;
  novemberAmount: number;
  decemberAmount: number;
  transactionCount: number;
  federalWithholding: number;
  stateWithholding: number;
  stateId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const THRESHOLD_1099K_2024 = 600; // $600 for 2024+
const THRESHOLD_1099K_LEGACY = 20000; // $20,000 pre-2024
const MIN_TRANSACTIONS_LEGACY = 200;

const SKILLANCER_PAYER_INFO: PayerInfo = {
  name: 'Skillancer Inc.',
  tin: 'XX-XXXXXXX', // Placeholder
  address: {
    street1: '123 Tech Street',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'US',
  },
};

// ============================================================================
// TAX DOCUMENTS SERVICE
// ============================================================================

class TaxDocumentsService {
  // --------------------------------------------------------------------------
  // 1099-K GENERATION
  // --------------------------------------------------------------------------

  async generate1099K(userId: string, taxYear: number): Promise<Form1099K | null> {
    logger.info('Generating 1099-K', { userId, taxYear });

    const payments = await this.getYearlyPayments(userId, taxYear);
    const threshold = taxYear >= 2024 ? THRESHOLD_1099K_2024 : THRESHOLD_1099K_LEGACY;

    if (payments.totalAmount < threshold) {
      logger.info('Below 1099-K threshold', { userId, taxYear, amount: payments.totalAmount });
      return null;
    }

    // Legacy rules also required 200+ transactions
    if (taxYear < 2024 && payments.transactionCount < MIN_TRANSACTIONS_LEGACY) {
      logger.info('Below transaction count threshold', { userId, taxYear });
      return null;
    }

    const recipient = await this.getRecipientInfo(userId);

    const form: Form1099K = {
      id: `1099K-${taxYear}-${userId}`,
      taxYear,
      payerInfo: SKILLANCER_PAYER_INFO,
      payeeInfo: recipient,
      grossAmount: payments.totalAmount,
      cardNotPresent: payments.totalAmount, // All are card-not-present
      januaryAmount: payments.byMonth[0] || 0,
      februaryAmount: payments.byMonth[1] || 0,
      marchAmount: payments.byMonth[2] || 0,
      aprilAmount: payments.byMonth[3] || 0,
      mayAmount: payments.byMonth[4] || 0,
      juneAmount: payments.byMonth[5] || 0,
      julyAmount: payments.byMonth[6] || 0,
      augustAmount: payments.byMonth[7] || 0,
      septemberAmount: payments.byMonth[8] || 0,
      octoberAmount: payments.byMonth[9] || 0,
      novemberAmount: payments.byMonth[10] || 0,
      decemberAmount: payments.byMonth[11] || 0,
      transactionCount: payments.transactionCount,
      federalWithholding: payments.federalWithholding,
      stateWithholding: payments.stateWithholding,
      stateId: payments.stateId,
    };

    await this.saveDocument(userId, '1099-K', taxYear, form);

    metrics.increment('tax.1099k.generated');

    return form;
  }

  async generate1099KBatch(taxYear: number): Promise<{
    generated: number;
    skipped: number;
    errors: number;
  }> {
    logger.info('Generating 1099-K batch', { taxYear });

    const eligibleUsers = await this.getEligibleFreelancers(taxYear);
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const userId of eligibleUsers) {
      try {
        const form = await this.generate1099K(userId, taxYear);
        if (form) {
          generated++;
        } else {
          skipped++;
        }
      } catch (error) {
        logger.error('Failed to generate 1099-K', { userId, taxYear, error });
        errors++;
      }
    }

    metrics.gauge('tax.1099k.batch.generated', generated);
    metrics.gauge('tax.1099k.batch.errors', errors);

    return { generated, skipped, errors };
  }

  // --------------------------------------------------------------------------
  // E-FILING
  // --------------------------------------------------------------------------

  async efile1099K(documentId: string): Promise<{
    success: boolean;
    confirmationNumber?: string;
    error?: string;
  }> {
    logger.info('E-filing 1099-K', { documentId });

    // In production, integrate with IRS FIRE system or third-party e-file provider
    // Options: Tax1099.com, eFileMyForms, Track1099

    try {
      // Validate form data
      const document = await this.getDocument(documentId);
      if (!document) {
        return { success: false, error: 'Document not found' };
      }

      // Submit to IRS
      const confirmationNumber = `IRS-${Date.now()}`;

      await this.updateDocumentStatus(documentId, 'filed', { confirmationNumber });

      metrics.increment('tax.1099k.filed');

      return { success: true, confirmationNumber };
    } catch (error) {
      logger.error('E-file failed', { documentId, error });
      return { success: false, error: 'E-filing failed' };
    }
  }

  async efileBatch(taxYear: number): Promise<{
    filed: number;
    failed: number;
  }> {
    logger.info('E-filing batch', { taxYear });

    const pendingDocuments = await this.getPendingDocuments(taxYear);
    let filed = 0;
    let failed = 0;

    for (const doc of pendingDocuments) {
      const result = await this.efile1099K(doc.id);
      if (result.success) {
        filed++;
      } else {
        failed++;
      }
    }

    return { filed, failed };
  }

  // --------------------------------------------------------------------------
  // DELIVERY
  // --------------------------------------------------------------------------

  async deliverToFreelancer(documentId: string): Promise<void> {
    logger.info('Delivering document to freelancer', { documentId });

    const document = await this.getDocument(documentId);
    if (!document) throw new Error('Document not found');

    // Generate PDF
    const pdfUrl = await this.generatePdf(document);

    // Send email notification
    await this.sendDeliveryNotification(document.userId, document, pdfUrl);

    // Make available in dashboard
    await this.updateDocumentStatus(documentId, 'delivered', { fileUrl: pdfUrl });

    metrics.increment('tax.1099k.delivered');
  }

  async deliverBatch(taxYear: number): Promise<{ delivered: number; failed: number }> {
    const filedDocuments = await this.getFiledDocuments(taxYear);
    let delivered = 0;
    let failed = 0;

    for (const doc of filedDocuments) {
      try {
        await this.deliverToFreelancer(doc.id);
        delivered++;
      } catch (error) {
        logger.error('Delivery failed', { documentId: doc.id, error });
        failed++;
      }
    }

    return { delivered, failed };
  }

  // --------------------------------------------------------------------------
  // DOCUMENT MANAGEMENT
  // --------------------------------------------------------------------------

  async uploadExternalDocument(
    userId: string,
    type: DocumentType,
    taxYear: number,
    file: { name: string; mimeType: string; data: Buffer }
  ): Promise<TaxDocument> {
    logger.info('Uploading external document', { userId, type, taxYear });

    // Upload to storage
    const fileUrl = await this.uploadFile(file);

    const document: TaxDocument = {
      id: `DOC-${Date.now()}`,
      userId,
      type,
      taxYear,
      status: 'delivered',
      amount: 0, // Will be extracted
      recipient: await this.getRecipientInfo(userId),
      fileUrl,
      deliveredAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveDocument(userId, type, taxYear, document);

    metrics.increment('tax.document.uploaded', { type });

    return document;
  }

  async getDocuments(
    userId: string,
    options: { taxYear?: number; type?: DocumentType } = {}
  ): Promise<TaxDocument[]> {
    // In production, query database
    return [];
  }

  async getDocument(documentId: string): Promise<TaxDocument | null> {
    // In production, query database
    return null;
  }

  async downloadDocument(documentId: string): Promise<{ url: string; expiresAt: Date }> {
    const document = await this.getDocument(documentId);
    if (!document || !document.fileUrl) {
      throw new Error('Document not found');
    }

    // Generate signed URL
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return { url: document.fileUrl, expiresAt };
  }

  // --------------------------------------------------------------------------
  // CORRECTIONS
  // --------------------------------------------------------------------------

  async fileCorrection(documentId: string, corrections: Partial<Form1099K>): Promise<TaxDocument> {
    logger.info('Filing correction', { documentId });

    const original = await this.getDocument(documentId);
    if (!original) throw new Error('Document not found');

    // Create corrected document
    const correctedDoc: TaxDocument = {
      ...original,
      id: `${original.id}-CORRECTED`,
      status: 'pending',
      updatedAt: new Date(),
    };

    await this.saveDocument(original.userId, original.type, original.taxYear, correctedDoc);
    await this.updateDocumentStatus(documentId, 'corrected');

    metrics.increment('tax.1099k.corrected');

    return correctedDoc;
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private async getYearlyPayments(
    userId: string,
    taxYear: number
  ): Promise<{
    totalAmount: number;
    byMonth: number[];
    transactionCount: number;
    federalWithholding: number;
    stateWithholding: number;
    stateId?: string;
  }> {
    // In production, aggregate from payment transactions
    return {
      totalAmount: 85000,
      byMonth: [7000, 6500, 7200, 6800, 7500, 7000, 7200, 7100, 7300, 7000, 7200, 7200],
      transactionCount: 45,
      federalWithholding: 0,
      stateWithholding: 0,
    };
  }

  private async getRecipientInfo(userId: string): Promise<RecipientInfo> {
    // In production, fetch from user profile
    return {
      name: 'John Doe',
      tinLast4: '1234',
      tinType: 'SSN',
      address: {
        street1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US',
      },
    };
  }

  private async getEligibleFreelancers(taxYear: number): Promise<string[]> {
    // In production, query users with payments above threshold
    return [];
  }

  private async saveDocument(
    userId: string,
    type: DocumentType,
    taxYear: number,
    data: unknown
  ): Promise<void> {
    // In production, save to database
  }

  private async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    updates?: Record<string, unknown>
  ): Promise<void> {
    // In production, update database
  }

  private async getPendingDocuments(taxYear: number): Promise<TaxDocument[]> {
    return [];
  }

  private async getFiledDocuments(taxYear: number): Promise<TaxDocument[]> {
    return [];
  }

  private async generatePdf(document: TaxDocument): Promise<string> {
    // In production, generate PDF using template
    return `https://storage.skillancer.com/tax/${document.id}.pdf`;
  }

  private async sendDeliveryNotification(
    userId: string,
    document: TaxDocument,
    pdfUrl: string
  ): Promise<void> {
    // In production, send email
  }

  private async uploadFile(file: {
    name: string;
    mimeType: string;
    data: Buffer;
  }): Promise<string> {
    // In production, upload to S3/GCS
    return `https://storage.skillancer.com/uploads/${file.name}`;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let taxDocumentsService: TaxDocumentsService | null = null;

export function getTaxDocumentsService(): TaxDocumentsService {
  if (!taxDocumentsService) {
    taxDocumentsService = new TaxDocumentsService();
  }
  return taxDocumentsService;
}

