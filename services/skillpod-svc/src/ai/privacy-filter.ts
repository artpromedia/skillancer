// @ts-nocheck
/**
 * AI Privacy Filter
 * Filters sensitive data before AI processing
 * Sprint M7: AI Work Assistant
 */

import { getLogger } from '@skillancer/logger';
import { getMetrics } from '@skillancer/metrics';

const logger = getLogger('ai-privacy-filter');
const metrics = getMetrics();

// =============================================================================
// TYPES
// =============================================================================

export type SensitiveDataType =
  | 'pii'
  | 'financial'
  | 'credentials'
  | 'health'
  | 'client_confidential';

export interface DetectedSensitiveData {
  type: SensitiveDataType;
  pattern: string;
  location: { start: number; end: number };
  redactedWith: string;
}

export interface FilterResult {
  sanitizedContent: string;
  detectedItems: DetectedSensitiveData[];
  wasModified: boolean;
  complianceFlags: string[];
}

export interface FilterConfig {
  enablePII: boolean;
  enableFinancial: boolean;
  enableCredentials: boolean;
  enableHealth: boolean;
  enableClientConfidential: boolean;
  customPatterns?: RegExp[];
  redactionMethod: 'hash' | 'placeholder' | 'remove';
}

export interface AuditLogEntry {
  timestamp: Date;
  sessionId: string;
  userId: string;
  action: 'filter' | 'query' | 'response';
  dataTypes: SensitiveDataType[];
  itemCount: number;
  contentHash: string;
}

// =============================================================================
// PATTERNS
// =============================================================================

const PATTERNS = {
  // PII Patterns
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  passport: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
  driverLicense: /\b[A-Z]{1,2}\d{6,8}\b/g,

  // Financial Patterns
  creditCard:
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
  bankAccount: /\b\d{8,17}\b/g,
  routingNumber: /\b\d{9}\b/g,
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,

  // Credential Patterns
  apiKey: /\b(sk_live_|pk_live_|api_key_|apikey_)[a-zA-Z0-9]{20,}\b/gi,
  password: /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
  token: /\b(bearer|token|auth)[:\s]+[a-zA-Z0-9\-_]{20,}\b/gi,
  privateKey: /-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/g,
  awsKey: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,

  // Health (HIPAA)
  medicalRecord: /\b(MRN|Medical Record)[\s:#]*\d{6,12}\b/gi,
  diagnosis: /\b(ICD-?10?|ICD-?9)[\s:-]*[A-Z]\d{2,}\.?\d*\b/gi,
  healthInsurance: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{2}\b/g,

  // Names and addresses (context-dependent)
  streetAddress:
    /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/gi,
  zipCode: /\b\d{5}(-\d{4})?\b/g,
};

// =============================================================================
// PRIVACY FILTER
// =============================================================================

export class PrivacyFilter {
  private config: FilterConfig;
  private auditLog: AuditLogEntry[] = [];
  private customPatterns: Map<string, RegExp> = new Map();

  constructor(config?: Partial<FilterConfig>) {
    this.config = {
      enablePII: true,
      enableFinancial: true,
      enableCredentials: true,
      enableHealth: true,
      enableClientConfidential: true,
      redactionMethod: 'placeholder',
      ...config,
    };
  }

  // ---------------------------------------------------------------------------
  // MAIN FILTERING
  // ---------------------------------------------------------------------------

  /**
   * Sanitize content by removing/redacting sensitive data
   */
  async sanitize(
    content: string,
    context?: { sessionId?: string; userId?: string }
  ): Promise<FilterResult> {
    const startTime = Date.now();
    const detectedItems: DetectedSensitiveData[] = [];
    let sanitizedContent = content;
    const complianceFlags: string[] = [];

    logger.debug('Sanitizing content', {
      contentLength: content.length,
      sessionId: context?.sessionId,
    });

    try {
      // PII detection and redaction
      if (this.config.enablePII) {
        const piiResult = this.detectAndRedactPII(sanitizedContent);
        sanitizedContent = piiResult.content;
        detectedItems.push(...piiResult.detected);

        if (piiResult.detected.length > 0) {
          complianceFlags.push('PII_DETECTED');
        }
      }

      // Financial data
      if (this.config.enableFinancial) {
        const financialResult = this.detectAndRedactFinancial(sanitizedContent);
        sanitizedContent = financialResult.content;
        detectedItems.push(...financialResult.detected);

        if (financialResult.detected.length > 0) {
          complianceFlags.push('PCI_DATA_DETECTED');
        }
      }

      // Credentials
      if (this.config.enableCredentials) {
        const credentialResult = this.detectAndRedactCredentials(sanitizedContent);
        sanitizedContent = credentialResult.content;
        detectedItems.push(...credentialResult.detected);

        if (credentialResult.detected.length > 0) {
          complianceFlags.push('CREDENTIALS_DETECTED');
        }
      }

      // Health/HIPAA
      if (this.config.enableHealth) {
        const healthResult = this.detectAndRedactHealth(sanitizedContent);
        sanitizedContent = healthResult.content;
        detectedItems.push(...healthResult.detected);

        if (healthResult.detected.length > 0) {
          complianceFlags.push('PHI_DETECTED');
        }
      }

      // Custom patterns
      if (this.config.customPatterns) {
        for (const pattern of this.config.customPatterns) {
          const customResult = this.applyPattern(sanitizedContent, pattern, 'client_confidential');
          sanitizedContent = customResult.content;
          detectedItems.push(...customResult.detected);
        }
      }

      // Audit logging
      if (context?.sessionId && detectedItems.length > 0) {
        await this.logAuditEntry({
          timestamp: new Date(),
          sessionId: context.sessionId,
          userId: context.userId || 'unknown',
          action: 'filter',
          dataTypes: [...new Set(detectedItems.map((d) => d.type))],
          itemCount: detectedItems.length,
          contentHash: this.hashContent(content),
        });
      }

      // Metrics
      const processingTime = Date.now() - startTime;
      metrics.histogram('privacy_filter_processing_ms', processingTime);
      metrics.increment('privacy_filter_items_detected', {}, detectedItems.length);

      logger.info('Content sanitized', {
        itemsDetected: detectedItems.length,
        wasModified: detectedItems.length > 0,
        processingTime,
      });

      return {
        sanitizedContent,
        detectedItems,
        wasModified: detectedItems.length > 0,
        complianceFlags,
      };
    } catch (error) {
      logger.error('Privacy filter error', { error });
      metrics.increment('privacy_filter_errors');

      // On error, return original content but flag it
      return {
        sanitizedContent: content,
        detectedItems: [],
        wasModified: false,
        complianceFlags: ['FILTER_ERROR'],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // CATEGORY-SPECIFIC DETECTION
  // ---------------------------------------------------------------------------

  private detectAndRedactPII(content: string): {
    content: string;
    detected: DetectedSensitiveData[];
  } {
    const detected: DetectedSensitiveData[] = [];
    let result = content;

    // Email
    result = this.applyPatternWithTracking(result, PATTERNS.email, 'pii', '[EMAIL]', detected);

    // Phone
    result = this.applyPatternWithTracking(result, PATTERNS.phone, 'pii', '[PHONE]', detected);

    // SSN
    result = this.applyPatternWithTracking(result, PATTERNS.ssn, 'pii', '[SSN]', detected);

    // Passport
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.passport,
      'pii',
      '[PASSPORT]',
      detected
    );

    // Street address
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.streetAddress,
      'pii',
      '[ADDRESS]',
      detected
    );

    return { content: result, detected };
  }

  private detectAndRedactFinancial(content: string): {
    content: string;
    detected: DetectedSensitiveData[];
  } {
    const detected: DetectedSensitiveData[] = [];
    let result = content;

    // Credit card - with Luhn validation
    const ccPattern = PATTERNS.creditCard;
    let match;
    while ((match = ccPattern.exec(content)) !== null) {
      if (this.validateLuhn(match[0].replace(/\D/g, ''))) {
        detected.push({
          type: 'financial',
          pattern: 'credit_card',
          location: { start: match.index, end: match.index + match[0].length },
          redactedWith: '[CARD]',
        });
        result = result.replace(match[0], '[CARD]');
      }
    }

    // IBAN
    result = this.applyPatternWithTracking(result, PATTERNS.iban, 'financial', '[IBAN]', detected);

    return { content: result, detected };
  }

  private detectAndRedactCredentials(content: string): {
    content: string;
    detected: DetectedSensitiveData[];
  } {
    const detected: DetectedSensitiveData[] = [];
    let result = content;

    // API keys
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.apiKey,
      'credentials',
      '[API_KEY]',
      detected
    );

    // AWS keys
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.awsKey,
      'credentials',
      '[AWS_KEY]',
      detected
    );

    // Passwords
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.password,
      'credentials',
      '[PASSWORD]',
      detected
    );

    // Tokens
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.token,
      'credentials',
      '[TOKEN]',
      detected
    );

    // Private keys
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.privateKey,
      'credentials',
      '[PRIVATE_KEY]',
      detected
    );

    return { content: result, detected };
  }

  private detectAndRedactHealth(content: string): {
    content: string;
    detected: DetectedSensitiveData[];
  } {
    const detected: DetectedSensitiveData[] = [];
    let result = content;

    // Medical record numbers
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.medicalRecord,
      'health',
      '[MRN]',
      detected
    );

    // ICD codes
    result = this.applyPatternWithTracking(
      result,
      PATTERNS.diagnosis,
      'health',
      '[DIAGNOSIS]',
      detected
    );

    return { content: result, detected };
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  private applyPattern(
    content: string,
    pattern: RegExp,
    type: SensitiveDataType
  ): { content: string; detected: DetectedSensitiveData[] } {
    const detected: DetectedSensitiveData[] = [];
    const placeholder = `[${type.toUpperCase()}]`;

    const result = this.applyPatternWithTracking(content, pattern, type, placeholder, detected);
    return { content: result, detected };
  }

  private applyPatternWithTracking(
    content: string,
    pattern: RegExp,
    type: SensitiveDataType,
    placeholder: string,
    detected: DetectedSensitiveData[]
  ): string {
    let result = content;
    let match;

    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;

    const matches: Array<{ match: string; index: number }> = [];
    while ((match = pattern.exec(content)) !== null) {
      matches.push({ match: match[0], index: match.index });
    }

    // Process matches in reverse order to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      detected.push({
        type,
        pattern: pattern.source.substring(0, 20) + '...',
        location: { start: m.index, end: m.index + m.match.length },
        redactedWith: placeholder,
      });

      result =
        result.substring(0, m.index) + placeholder + result.substring(m.index + m.match.length);
    }

    return result;
  }

  private validateLuhn(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = Number.parseInt(cardNumber[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  private hashContent(content: string): string {
    // Simple hash for audit purposes
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGGING
  // ---------------------------------------------------------------------------

  private async logAuditEntry(entry: AuditLogEntry): Promise<void> {
    this.auditLog.push(entry);

    logger.info('Privacy filter audit', {
      sessionId: entry.sessionId,
      action: entry.action,
      dataTypes: entry.dataTypes,
      itemCount: entry.itemCount,
    });

    // In production: Write to audit database
  }

  /**
   * Get audit log entries for a session
   */
  getAuditLog(sessionId?: string): AuditLogEntry[] {
    if (sessionId) {
      return this.auditLog.filter((e) => e.sessionId === sessionId);
    }
    return [...this.auditLog];
  }

  // ---------------------------------------------------------------------------
  // USER CONSENT
  // ---------------------------------------------------------------------------

  /**
   * Check if user has consented to AI features
   */
  async checkUserConsent(userId: string): Promise<{ hasConsent: boolean; consentDate?: Date }> {
    // In production: Check consent database
    return { hasConsent: true, consentDate: new Date() };
  }

  /**
   * Get clear data usage explanation for user
   */
  getDataUsageExplanation(): string {
    return `
AI Assistant Data Usage:

1. What data is processed:
   - Your queries and context within the current session
   - Code or text you're working on (with sensitive data filtered)

2. How it's protected:
   - Sensitive data (emails, passwords, etc.) is automatically redacted
   - Processing occurs within secure containment
   - No raw data is stored or shared externally

3. Your rights:
   - You can disable AI features at any time
   - Request deletion of your AI interaction history
   - Opt out of model improvement contributions
    `.trim();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export function createPrivacyFilter(config?: Partial<FilterConfig>): PrivacyFilter {
  return new PrivacyFilter(config);
}
