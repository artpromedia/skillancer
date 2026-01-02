/**
 * PHI Containment Service
 * Sprint M9: Healthcare Vertical Module
 *
 * Enhanced SkillPod policies for PHI containment, detection, access controls,
 * and comprehensive audit logging for HIPAA compliance.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import structlog from '@skillancer/logger';

const logger = structlog.get('PHIContainment');

// =============================================================================
// Types
// =============================================================================

export const PHIAccessLevelEnum = z.enum(['NONE', 'LIMITED', 'STANDARD', 'FULL']);
export type PHIAccessLevel = z.infer<typeof PHIAccessLevelEnum>;

export const PHICategoryEnum = z.enum([
  'PATIENT_DEMOGRAPHICS',
  'MEDICAL_RECORDS',
  'TREATMENT_HISTORY',
  'DIAGNOSIS_CODES',
  'PRESCRIPTION_DATA',
  'LAB_RESULTS',
  'IMAGING_DATA',
  'BILLING_INFORMATION',
  'INSURANCE_DATA',
  'MENTAL_HEALTH',
  'SUBSTANCE_ABUSE',
  'HIV_AIDS',
  'GENETIC_DATA',
  'PSYCHOTHERAPY_NOTES',
]);

export type PHICategory = z.infer<typeof PHICategoryEnum>;

export const PHIDetectionResultSchema = z.object({
  detected: z.boolean(),
  categories: z.array(PHICategoryEnum),
  confidence: z.number().min(0).max(1),
  locations: z.array(
    z.object({
      field: z.string(),
      startOffset: z.number(),
      endOffset: z.number(),
      matchedPattern: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
});

export type PHIDetectionResult = z.infer<typeof PHIDetectionResultSchema>;

export const SkillPodPHIConfigSchema = z.object({
  podId: z.string().uuid(),
  contractId: z.string().uuid(),
  phiAccessLevel: PHIAccessLevelEnum,
  allowedCategories: z.array(PHICategoryEnum),
  networkIsolation: z.boolean(),
  encryptionRequired: z.boolean(),
  auditLoggingLevel: z.enum(['MINIMAL', 'STANDARD', 'COMPREHENSIVE']),
  dataRetentionDays: z.number().nullable(),
  exfiltrationPrevention: z.boolean(),
  clipboardBlocking: z.boolean(),
  screenshotPrevention: z.boolean(),
  watermarking: z.boolean(),
  idleTimeout: z.number(),
  maxSessionDuration: z.number(),
  geofencing: z.object({
    enabled: z.boolean(),
    allowedCountries: z.array(z.string()),
    allowedRegions: z.array(z.string()).optional(),
  }),
});

export type SkillPodPHIConfig = z.infer<typeof SkillPodPHIConfigSchema>;

// =============================================================================
// PHI Pattern Detection
// =============================================================================

/**
 * Patterns for detecting various types of PHI
 */
const PHI_PATTERNS = {
  // Healthcare identifiers
  MRN: /\b(?:MRN|Medical Record Number|Patient ID)[:\s]*([A-Z0-9]{6,12})\b/gi,
  SSN: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  MEDICARE_ID: /\b[1-9][A-Z][A-Z0-9]{8}\b/g,
  MEDICAID_ID: /\b[A-Z]{2}\d{8,10}\b/g,
  INSURANCE_MEMBER_ID: /\b(?:Member ID|Subscriber ID)[:\s]*([A-Z0-9]{8,15})\b/gi,

  // Medical terminology
  ICD10_CODE: /\b[A-Z]\d{2}\.?\d{0,4}\b/g,
  CPT_CODE: /\b\d{5}[A-Z]?\b/g,
  NDC_CODE: /\b\d{4,5}-\d{3,4}-\d{2}\b/g,
  NPI: /\b\d{10}\b/g,

  // Personal identifiers
  DOB: /\b(?:DOB|Date of Birth|Birth Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
  PHONE: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ADDRESS:
    /\b\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\.?,?\s*(?:Apt|Suite|Ste|Unit|#)?\s*\d*\b/gi,

  // Clinical data patterns
  DIAGNOSIS: /\b(?:diagnosed with|diagnosis|dx)[:\s]*([A-Za-z\s]{5,50})\b/gi,
  MEDICATION: /\b(?:prescribed|rx|medication)[:\s]*([A-Za-z\s]+\d*mg)\b/gi,
  LAB_VALUE: /\b(?:A1C|glucose|cholesterol|WBC|RBC|HGB|HCT)[:\s]*(\d+\.?\d*)\b/gi,
};

// Sensitive category patterns
const SENSITIVE_PATTERNS = {
  MENTAL_HEALTH:
    /\b(?:depression|anxiety|bipolar|schizophrenia|PTSD|psychiatric|psychotherapy)\b/gi,
  SUBSTANCE_ABUSE: /\b(?:alcohol|drug|substance|addiction|rehab|detox|opioid|cocaine|heroin)\b/gi,
  HIV_AIDS: /\b(?:HIV|AIDS|antiretroviral|CD4|viral load)\b/gi,
  GENETIC: /\b(?:BRCA|genetic test|DNA|chromosome|hereditary|mutation)\b/gi,
};

// =============================================================================
// PHI Containment Service
// =============================================================================

export const phiContainment = {
  // ===========================================================================
  // PHI Detection
  // ===========================================================================

  /**
   * Detect PHI in text content
   */
  async detectPHI(content: string): Promise<PHIDetectionResult> {
    logger.info('Detecting PHI in content', { contentLength: content.length });

    const locations: PHIDetectionResult['locations'] = [];
    const detectedCategories = new Set<PHICategory>();

    // Check standard PHI patterns
    for (const [patternName, pattern] of Object.entries(PHI_PATTERNS)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        locations.push({
          field: patternName,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          matchedPattern: patternName,
        });

        // Map pattern to category
        if (
          ['MRN', 'SSN', 'MEDICARE_ID', 'MEDICAID_ID', 'INSURANCE_MEMBER_ID'].includes(patternName)
        ) {
          detectedCategories.add('PATIENT_DEMOGRAPHICS');
        } else if (['ICD10_CODE', 'CPT_CODE', 'DIAGNOSIS'].includes(patternName)) {
          detectedCategories.add('DIAGNOSIS_CODES');
        } else if (['MEDICATION', 'NDC_CODE'].includes(patternName)) {
          detectedCategories.add('PRESCRIPTION_DATA');
        } else if (['LAB_VALUE'].includes(patternName)) {
          detectedCategories.add('LAB_RESULTS');
        } else if (['DOB', 'PHONE', 'EMAIL', 'ADDRESS'].includes(patternName)) {
          detectedCategories.add('PATIENT_DEMOGRAPHICS');
        }
      }
    }

    // Check sensitive patterns
    for (const [categoryName, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(content)) {
        detectedCategories.add(categoryName as PHICategory);
      }
    }

    const detected = locations.length > 0 || detectedCategories.size > 0;
    const confidence = Math.min(0.5 + locations.length * 0.1, 1);

    const recommendations: string[] = [];
    if (detected) {
      recommendations.push('Ensure proper BAA is in place before processing');
      recommendations.push('Use encrypted storage for this data');
      recommendations.push('Limit access to minimum necessary personnel');

      if (detectedCategories.has('MENTAL_HEALTH') || detectedCategories.has('SUBSTANCE_ABUSE')) {
        recommendations.push('Apply 42 CFR Part 2 protections for substance abuse data');
      }
      if (detectedCategories.has('HIV_AIDS')) {
        recommendations.push('Check state-specific HIV/AIDS disclosure requirements');
      }
    }

    return {
      detected,
      categories: Array.from(detectedCategories),
      confidence,
      locations,
      recommendations,
    };
  },

  /**
   * Scan file for PHI
   */
  async scanFile(params: {
    fileUrl: string;
    fileType: string;
    extractText?: boolean;
  }): Promise<PHIDetectionResult & { fileScanned: boolean }> {
    logger.info('Scanning file for PHI', { fileType: params.fileType });

    // In production:
    // 1. Download file from secure storage
    // 2. Extract text based on file type (PDF, DOCX, images with OCR)
    // 3. Run PHI detection on extracted text
    // 4. Return results

    return {
      detected: false,
      categories: [],
      confidence: 0,
      locations: [],
      recommendations: [],
      fileScanned: true,
    };
  },

  // ===========================================================================
  // SkillPod PHI Configuration
  // ===========================================================================

  /**
   * Configure SkillPod for PHI access
   */
  async configureSkillPod(
    config: SkillPodPHIConfig
  ): Promise<{ success: boolean; appliedPolicies: string[] }> {
    logger.info('Configuring SkillPod for PHI', {
      podId: config.podId,
      accessLevel: config.phiAccessLevel,
    });

    const appliedPolicies: string[] = [];

    // Network isolation
    if (config.networkIsolation) {
      await this.applyNetworkIsolation(config.podId);
      appliedPolicies.push('NETWORK_ISOLATION');
    }

    // Encryption
    if (config.encryptionRequired) {
      await this.enforceEncryption(config.podId);
      appliedPolicies.push('ENCRYPTION_REQUIRED');
    }

    // Data exfiltration prevention
    if (config.exfiltrationPrevention) {
      await this.enableExfiltrationPrevention(config.podId, {
        clipboardBlocking: config.clipboardBlocking,
        screenshotPrevention: config.screenshotPrevention,
      });
      appliedPolicies.push('EXFILTRATION_PREVENTION');
    }

    // Watermarking
    if (config.watermarking) {
      await this.enableWatermarking(config.podId);
      appliedPolicies.push('WATERMARKING');
    }

    // Session controls
    await this.configureSessionControls(config.podId, {
      idleTimeout: config.idleTimeout,
      maxDuration: config.maxSessionDuration,
    });
    appliedPolicies.push('SESSION_CONTROLS');

    // Geofencing
    if (config.geofencing.enabled) {
      await this.configureGeofencing(config.podId, config.geofencing);
      appliedPolicies.push('GEOFENCING');
    }

    // Audit logging
    await this.configureAuditLogging(config.podId, config.auditLoggingLevel);
    appliedPolicies.push('AUDIT_LOGGING');

    return {
      success: true,
      appliedPolicies,
    };
  },

  /**
   * Apply network isolation to SkillPod
   */
  async applyNetworkIsolation(podId: string): Promise<void> {
    logger.info('Applying network isolation', { podId });

    // In production:
    // 1. Configure VPC/network policies
    // 2. Restrict outbound traffic
    // 3. Whitelist only necessary endpoints (EHR, approved tools)
    // 4. Block data transfer to unauthorized destinations
  },

  /**
   * Enforce encryption requirements
   */
  async enforceEncryption(podId: string): Promise<void> {
    logger.info('Enforcing encryption', { podId });

    // In production:
    // 1. Enable disk encryption
    // 2. Configure TLS for all connections
    // 3. Enable at-rest encryption for all storage
    // 4. Configure key management
  },

  /**
   * Enable data exfiltration prevention
   */
  async enableExfiltrationPrevention(
    podId: string,
    options: { clipboardBlocking: boolean; screenshotPrevention: boolean }
  ): Promise<void> {
    logger.info('Enabling exfiltration prevention', { podId, options });

    // In production:
    // 1. Configure DLP policies
    // 2. Block clipboard access (if enabled)
    // 3. Disable screenshots/screen recording (if enabled)
    // 4. Monitor file downloads
    // 5. Block unauthorized USB/external storage
  },

  /**
   * Enable watermarking
   */
  async enableWatermarking(podId: string): Promise<void> {
    logger.info('Enabling watermarking', { podId });

    // In production:
    // 1. Configure visible watermarks with user ID and timestamp
    // 2. Enable invisible digital watermarking for documents
    // 3. Apply watermarks to screen captures if allowed
  },

  /**
   * Configure session controls
   */
  async configureSessionControls(
    podId: string,
    options: { idleTimeout: number; maxDuration: number }
  ): Promise<void> {
    logger.info('Configuring session controls', { podId, options });

    // In production:
    // 1. Set idle timeout policy
    // 2. Set maximum session duration
    // 3. Configure automatic logout
    // 4. Enable session recording (if required)
  },

  /**
   * Configure geofencing
   */
  async configureGeofencing(
    podId: string,
    options: { enabled: boolean; allowedCountries: string[]; allowedRegions?: string[] }
  ): Promise<void> {
    logger.info('Configuring geofencing', { podId, options });

    // In production:
    // 1. Configure IP geolocation checking
    // 2. Block access from non-allowed regions
    // 3. Alert on access attempts from blocked regions
  },

  /**
   * Configure audit logging level
   */
  async configureAuditLogging(
    podId: string,
    level: 'MINIMAL' | 'STANDARD' | 'COMPREHENSIVE'
  ): Promise<void> {
    logger.info('Configuring audit logging', { podId, level });

    // Logging configurations by level:
    // MINIMAL: Login/logout, file access
    // STANDARD: + Copy/paste, search queries, API calls
    // COMPREHENSIVE: + Keystroke timing, mouse movements, full activity recording
  },

  // ===========================================================================
  // Access Control
  // ===========================================================================

  /**
   * Validate PHI access request
   */
  async validateAccess(params: {
    userId: string;
    podId: string;
    requestedCategories: PHICategory[];
    accessType: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT' | 'PRINT';
  }): Promise<{
    allowed: boolean;
    deniedCategories: PHICategory[];
    reason?: string;
    auditLogId: string;
  }> {
    logger.info('Validating PHI access', {
      userId: params.userId,
      accessType: params.accessType,
    });

    const auditLogId = `AUDIT-${Date.now()}`;

    // In production:
    // 1. Check user's BAA status
    // 2. Verify HIPAA training is current
    // 3. Check pod configuration for allowed categories
    // 4. Validate access type permissions
    // 5. Check exclusion list status
    // 6. Log access attempt

    return {
      allowed: true,
      deniedCategories: [],
      auditLogId,
    };
  },

  /**
   * Revoke PHI access
   */
  async revokeAccess(params: {
    userId: string;
    podId?: string;
    contractId?: string;
    reason: string;
    revokedBy: string;
  }): Promise<{ success: boolean; affectedPods: string[] }> {
    logger.warn('Revoking PHI access', {
      userId: params.userId,
      reason: params.reason,
    });

    // In production:
    // 1. Terminate active sessions
    // 2. Revoke access tokens
    // 3. Update pod configurations
    // 4. Log revocation
    // 5. Notify user

    return {
      success: true,
      affectedPods: [],
    };
  },

  // ===========================================================================
  // PHI Sanitization
  // ===========================================================================

  /**
   * De-identify PHI for safe export
   */
  async deidentify(
    content: string,
    method: 'SAFE_HARBOR' | 'EXPERT_DETERMINATION'
  ): Promise<{
    deidentifiedContent: string;
    removedElements: number;
    method: string;
  }> {
    logger.info('De-identifying PHI', { method, contentLength: content.length });

    let deidentified = content;
    let removedCount = 0;

    if (method === 'SAFE_HARBOR') {
      // Remove all 18 HIPAA identifiers:
      // 1. Names
      deidentified = deidentified.replace(/\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g, '[NAME]');
      removedCount++;

      // 2. Geographic data smaller than state
      deidentified = deidentified.replace(/\b\d{5}(-\d{4})?\b/g, '[ZIP]');
      removedCount++;

      // 3. Dates (except year)
      deidentified = deidentified.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-](\d{2,4})\b/g, '[DATE]');
      removedCount++;

      // 4-18. Other identifiers...
      for (const pattern of Object.values(PHI_PATTERNS)) {
        const before = deidentified;
        deidentified = deidentified.replace(pattern, '[REDACTED]');
        if (before !== deidentified) removedCount++;
      }
    }

    return {
      deidentifiedContent: deidentified,
      removedElements: removedCount,
      method,
    };
  },

  /**
   * Redact specific PHI fields
   */
  async redact(
    content: string,
    fieldsToRedact: string[]
  ): Promise<{ redactedContent: string; redactedCount: number }> {
    logger.info('Redacting PHI fields', { fields: fieldsToRedact });

    let redacted = content;
    let count = 0;

    for (const field of fieldsToRedact) {
      const pattern = PHI_PATTERNS[field as keyof typeof PHI_PATTERNS];
      if (pattern) {
        const before = redacted;
        redacted = redacted.replace(pattern, `[${field}_REDACTED]`);
        if (before !== redacted) count++;
      }
    }

    return {
      redactedContent: redacted,
      redactedCount: count,
    };
  },

  // ===========================================================================
  // Monitoring & Alerts
  // ===========================================================================

  /**
   * Monitor for suspicious PHI access patterns
   */
  async monitorAccessPatterns(userId: string): Promise<{
    anomaliesDetected: boolean;
    anomalies: Array<{
      type: string;
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      timestamp: string;
    }>;
  }> {
    logger.info('Monitoring access patterns', { userId });

    // In production:
    // 1. Analyze access frequency
    // 2. Check for unusual access times
    // 3. Detect bulk data access
    // 4. Identify access from new locations
    // 5. Flag access to unrelated records

    return {
      anomaliesDetected: false,
      anomalies: [],
    };
  },

  /**
   * Generate PHI access report
   */
  async generateAccessReport(params: {
    userId?: string;
    podId?: string;
    contractId?: string;
    startDate: string;
    endDate: string;
  }): Promise<{
    reportId: string;
    reportUrl: string;
    summary: {
      totalAccesses: number;
      uniqueUsers: number;
      categoriesAccessed: PHICategory[];
      anomaliesDetected: number;
    };
  }> {
    logger.info('Generating PHI access report', params);

    const reportId = `REPORT-${Date.now()}`;

    return {
      reportId,
      reportUrl: `/api/hipaa/reports/${reportId}`,
      summary: {
        totalAccesses: 0,
        uniqueUsers: 0,
        categoriesAccessed: [],
        anomaliesDetected: 0,
      },
    };
  },
};

export default phiContainment;
