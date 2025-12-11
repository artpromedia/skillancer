/**
 * @module @skillancer/auth-svc/services/persona
 * Persona.com Identity Verification Service
 *
 * Handles KYC/AML verification via Persona's API for:
 * - Government ID verification
 * - Selfie/biometric verification
 * - Address verification
 */

import { createLogger } from '@skillancer/logger';

import { getConfig } from '../config/index.js';

const logger = createLogger({ serviceName: 'persona-service' });

// =============================================================================
// TYPES
// =============================================================================

export interface PersonaInquiry {
  id: string;
  type: string;
  attributes: {
    status: PersonaInquiryStatus;
    'reference-id': string | null;
    note: string | null;
    'created-at': string;
    'started-at': string | null;
    'completed-at': string | null;
    'expired-at': string | null;
    'redacted-at': string | null;
    'failed-at': string | null;
    'decisioned-at': string | null;
    fields: Record<string, PersonaField>;
  };
  relationships?: {
    account?: { data: { id: string; type: string } };
    template?: { data: { id: string; type: string } };
    reports?: { data: Array<{ id: string; type: string }> };
    verifications?: { data: Array<{ id: string; type: string }> };
    sessions?: { data: Array<{ id: string; type: string }> };
    documents?: { data: Array<{ id: string; type: string }> };
  };
}

export type PersonaInquiryStatus =
  | 'created'
  | 'pending'
  | 'completed'
  | 'expired'
  | 'failed'
  | 'needs_review'
  | 'approved'
  | 'declined';

export interface PersonaField {
  type: string;
  value: unknown;
}

export interface PersonaDocument {
  id: string;
  type: string;
  attributes: {
    status: 'initiated' | 'submitted' | 'processed' | 'errored';
    'created-at': string;
    'processed-at': string | null;
    'document-type': string | null;
    files: PersonaFile[];
    fields: Record<string, PersonaField>;
  };
}

export interface PersonaFile {
  'page-type': string;
  'file-url': string;
  'thumbnail-url': string | null;
  'byte-size': number;
}

export interface PersonaVerification {
  id: string;
  type: string;
  attributes: {
    status: 'passed' | 'failed' | 'pending' | 'not_applicable' | 'initiated' | 'submitted';
    'created-at': string;
    'completed-at': string | null;
    'country-code': string | null;
    checks: PersonaCheck[];
  };
}

export interface PersonaCheck {
  name: string;
  status: 'passed' | 'failed' | 'not_applicable';
  reasons: string[];
  metadata: Record<string, unknown>;
}

export interface CreateInquiryOptions {
  userId: string;
  templateId: string;
  email?: string;
  phoneNumber?: string;
  referenceId?: string;
  redirectUri?: string;
  note?: string;
  fields?: Record<string, string>;
}

export interface PersonaCreateInquiryResponse {
  data: PersonaInquiry;
  meta?: {
    'session-token'?: string;
  };
}

export interface PersonaWebhookPayload {
  data: {
    id: string;
    type: string;
    attributes: {
      name: string;
      payload: {
        data: PersonaInquiry | PersonaDocument | PersonaVerification;
        included?: Array<PersonaInquiry | PersonaDocument | PersonaVerification>;
      };
      'created-at': string;
    };
  };
}

// =============================================================================
// PERSONA SERVICE
// =============================================================================

export class PersonaService {
  private config = getConfig().persona;
  private baseUrl: string;
  private apiKey: string | null;
  private apiVersion: string;

  constructor() {
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey ?? null;
    this.apiVersion = this.config.apiVersion;
  }

  /**
   * Check if Persona is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Make authenticated request to Persona API
   */
  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Persona API key not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;

    logger.debug({ method, endpoint }, 'Persona API request');

    const fetchOptions: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Persona-Version': this.apiVersion,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        },
        'Persona API error'
      );
      throw new PersonaApiError(
        `Persona API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a new verification inquiry
   */
  async createInquiry(options: CreateInquiryOptions): Promise<PersonaCreateInquiryResponse> {
    const body = {
      data: {
        attributes: {
          'inquiry-template-id': options.templateId,
          'reference-id': options.referenceId ?? options.userId,
          ...(options.email && { 'email-address': options.email }),
          ...(options.phoneNumber && { 'phone-number': options.phoneNumber }),
          ...(options.redirectUri && { 'redirect-uri': options.redirectUri }),
          ...(options.note && { note: options.note }),
          ...(options.fields && { fields: options.fields }),
        },
      },
    };

    logger.info(
      {
        userId: options.userId,
        templateId: options.templateId,
      },
      'Creating Persona inquiry'
    );

    return this.request<PersonaCreateInquiryResponse>('POST', '/inquiries', body);
  }

  /**
   * Get an inquiry by ID
   */
  async getInquiry(inquiryId: string): Promise<{ data: PersonaInquiry }> {
    return this.request<{ data: PersonaInquiry }>('GET', `/inquiries/${inquiryId}`);
  }

  /**
   * Resume an existing inquiry
   */
  async resumeInquiry(inquiryId: string): Promise<{ meta: { 'session-token': string } }> {
    return this.request<{ meta: { 'session-token': string } }>(
      'POST',
      `/inquiries/${inquiryId}/resume`
    );
  }

  /**
   * Expire an inquiry manually
   */
  async expireInquiry(inquiryId: string): Promise<{ data: PersonaInquiry }> {
    return this.request<{ data: PersonaInquiry }>('POST', `/inquiries/${inquiryId}/expire`);
  }

  /**
   * Approve an inquiry (manual review)
   */
  async approveInquiry(inquiryId: string): Promise<{ data: PersonaInquiry }> {
    return this.request<{ data: PersonaInquiry }>('POST', `/inquiries/${inquiryId}/approve`);
  }

  /**
   * Decline an inquiry (manual review)
   */
  async declineInquiry(inquiryId: string): Promise<{ data: PersonaInquiry }> {
    return this.request<{ data: PersonaInquiry }>('POST', `/inquiries/${inquiryId}/decline`);
  }

  /**
   * Get documents from an inquiry
   */
  async getInquiryDocuments(inquiryId: string): Promise<{ data: PersonaDocument[] }> {
    return this.request<{ data: PersonaDocument[] }>('GET', `/inquiries/${inquiryId}/documents`);
  }

  /**
   * Get verifications from an inquiry
   */
  async getInquiryVerifications(inquiryId: string): Promise<{ data: PersonaVerification[] }> {
    return this.request<{ data: PersonaVerification[] }>(
      'GET',
      `/inquiries/${inquiryId}/verifications`
    );
  }

  /**
   * Get a specific document
   */
  async getDocument(documentId: string): Promise<{ data: PersonaDocument }> {
    return this.request<{ data: PersonaDocument }>('GET', `/documents/${documentId}`);
  }

  /**
   * Get a specific verification
   */
  async getVerification(verificationId: string): Promise<{ data: PersonaVerification }> {
    return this.request<{ data: PersonaVerification }>('GET', `/verifications/${verificationId}`);
  }

  /**
   * Redact an inquiry (GDPR compliance)
   * This permanently removes all PII from the inquiry
   */
  async redactInquiry(inquiryId: string): Promise<{ data: PersonaInquiry }> {
    logger.warn({ inquiryId }, 'Redacting Persona inquiry');
    return this.request<{ data: PersonaInquiry }>('POST', `/inquiries/${inquiryId}/redact`);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      logger.warn('Persona webhook secret not configured');
      return false;
    }

    // Persona uses HMAC-SHA256 for webhook signatures
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const cryptoModule = require('crypto') as typeof import('crypto');
    const expectedSignature = cryptoModule
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    const providedSig = signature.replace('sha256=', '');

    return cryptoModule.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSig));
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: PersonaWebhookPayload): {
    eventType: string;
    inquiry: PersonaInquiry | null;
    included: Array<PersonaInquiry | PersonaDocument | PersonaVerification>;
  } {
    const eventType = payload.data.attributes.name;
    const data = payload.data.attributes.payload.data;
    const included = payload.data.attributes.payload.included ?? [];

    // The main data might be an inquiry or a nested object
    let inquiry: PersonaInquiry | null = null;
    if (data.type === 'inquiry') {
      inquiry = data as PersonaInquiry;
    }

    return { eventType, inquiry, included };
  }

  /**
   * Get template ID for a verification level
   */
  getTemplateId(verificationType: 'BASIC' | 'ENHANCED' | 'PREMIUM'): string | null {
    const templates = this.config.templates;

    switch (verificationType) {
      case 'BASIC':
        return templates.basic ?? null;
      case 'ENHANCED':
        return templates.enhanced ?? null;
      case 'PREMIUM':
        return templates.premium ?? null;
      default:
        return null;
    }
  }

  /**
   * Map Persona inquiry status to our verification status
   */
  mapInquiryStatus(personaStatus: PersonaInquiryStatus): string {
    const statusMap: Record<PersonaInquiryStatus, string> = {
      created: 'PENDING',
      pending: 'IN_PROGRESS',
      completed: 'NEEDS_REVIEW',
      expired: 'EXPIRED',
      failed: 'DECLINED',
      needs_review: 'NEEDS_REVIEW',
      approved: 'APPROVED',
      declined: 'DECLINED',
    };
    return statusMap[personaStatus] ?? 'PENDING';
  }

  /**
   * Get badge expiry date
   */
  getBadgeExpiryDate(): Date {
    const days = this.config.badgeValidityDays;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }

  /**
   * Get inquiry expiry date
   */
  getInquiryExpiryDate(): Date {
    const hours = this.config.inquiryExpiryHours;
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hours);
    return expiry;
  }
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class PersonaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = 'PersonaApiError';
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let personaServiceInstance: PersonaService | null = null;

export function getPersonaService(): PersonaService {
  if (!personaServiceInstance) {
    personaServiceInstance = new PersonaService();
  }
  return personaServiceInstance;
}
