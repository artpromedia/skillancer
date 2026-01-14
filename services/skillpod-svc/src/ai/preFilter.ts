// @ts-nocheck
/**
 * Pre-Filter for Content Safety and Crisis Detection
 * Detects self-harm, crisis situations, and triggers appropriate responses
 *
 * Compliance: COPPA, Child Safety, K-12 Deployment Requirements
 * Sprint: Safety & Compliance
 */

import { getLogger } from '@skillancer/logger';
import { getMetrics } from '@skillancer/metrics';

const logger = getLogger('pre-filter');
const metrics = getMetrics();

// =============================================================================
// CRISIS RESOURCES - 988 Suicide & Crisis Lifeline
// =============================================================================

export const CRISIS_RESOURCES = {
  // US National Crisis Hotlines
  SUICIDE_CRISIS_LIFELINE: {
    name: '988 Suicide & Crisis Lifeline',
    phone: '988',
    text: 'Text HOME to 741741',
    website: 'https://988lifeline.org',
    availability: '24/7',
    description: 'Free, confidential support for people in distress',
  },
  CRISIS_TEXT_LINE: {
    name: 'Crisis Text Line',
    text: 'Text HOME to 741741',
    website: 'https://www.crisistextline.org',
    availability: '24/7',
    description: 'Free crisis support via text message',
  },
  TREVOR_PROJECT: {
    name: 'The Trevor Project',
    phone: '1-866-488-7386',
    text: 'Text START to 678-678',
    website: 'https://www.thetrevorproject.org',
    availability: '24/7',
    description: 'Crisis intervention for LGBTQ+ young people',
  },
  CHILD_HELP: {
    name: 'Childhelp National Child Abuse Hotline',
    phone: '1-800-422-4453',
    website: 'https://www.childhelp.org',
    availability: '24/7',
    description: 'Crisis intervention for child abuse',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type CrisisSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CrisisDetectionResult {
  detected: boolean;
  severity: CrisisSeverity;
  categories: CrisisCategory[];
  confidence: number;
  matchedPatterns: string[];
  response: CrisisResponse;
  requiresParentNotification: boolean;
  auditId: string;
}

export type CrisisCategory =
  | 'self_harm'
  | 'suicide_ideation'
  | 'eating_disorder'
  | 'substance_abuse'
  | 'bullying_victim'
  | 'abuse_disclosure'
  | 'violence_threat'
  | 'emotional_distress';

export interface CrisisResponse {
  showResources: boolean;
  resources: typeof CRISIS_RESOURCES[keyof typeof CRISIS_RESOURCES][];
  message: string;
  blockContent: boolean;
  escalate: boolean;
}

export interface UserContext {
  userId: string;
  sessionId: string;
  isMinor: boolean;
  age?: number;
  parentGuardianId?: string;
  schoolId?: string;
  tenantId?: string;
}

export interface PreFilterConfig {
  enableCrisisDetection: boolean;
  enableParentNotification: boolean;
  parentNotificationThreshold: CrisisSeverity;
  blockHighSeverity: boolean;
  auditAllDetections: boolean;
}

export interface PreFilterResult {
  content: string;
  wasBlocked: boolean;
  crisisDetection: CrisisDetectionResult | null;
  processingTime: number;
}

// =============================================================================
// CRISIS DETECTION PATTERNS
// =============================================================================

/**
 * Patterns are organized by severity and category
 * These patterns are carefully crafted to minimize false positives
 * while ensuring critical situations are detected
 */
const CRISIS_PATTERNS: Record<CrisisCategory, { patterns: RegExp[]; severity: CrisisSeverity }> = {
  suicide_ideation: {
    severity: 'critical',
    patterns: [
      /\b(want(ing)?|going|plan(ning)?|thinking|thought) to (kill|end|hurt) (myself|my life)\b/i,
      /\b(don'?t|do not) want to (live|be alive|exist|be here|wake up)\b/i,
      /\b(wish|hope) I (was|were|wasn'?t) (dead|gone|never born|not alive)\b/i,
      /\b(suicide|suicidal|end(ing)? (it all|my life|everything))\b/i,
      /\b(no (point|reason) (in |to )?living|life is not worth)\b/i,
      /\b(everyone|world|they|people) (would be|be) better (off )?without me\b/i,
      /\b(say(ing)? goodbye|writing (a |my )?suicide note|final (letter|message|goodbye))\b/i,
      /\b(plan|method|way|how) to (kill|end|hurt) myself\b/i,
    ],
  },
  self_harm: {
    severity: 'high',
    patterns: [
      /\b(cut(ting)?|burn(ing)?|hurt(ing)?|harm(ing)?|injur(e|ing)) (myself|my (body|arm|leg|wrist|skin))\b/i,
      /\b(want|need|urge) to (cut|burn|hurt|harm|injure) (myself|my body)\b/i,
      /\b(self[- ]?harm(ing)?|self[- ]?injur(y|e|ing)|self[- ]?mutilat(e|ion|ing))\b/i,
      /\b(scratch(ing)?|hit(ting)?|punch(ing)?|bang(ing)?) myself\b/i,
      /\b(make|making) myself bleed\b/i,
    ],
  },
  eating_disorder: {
    severity: 'high',
    patterns: [
      /\b(starv(e|ing)|purge|purg(e|ing)|binge and purge|throw(ing)? up (food|after eating))\b/i,
      /\b(anorex(ia|ic)|bulim(ia|ic)|pro[- ]?ana|pro[- ]?mia)\b/i,
      /\b(too fat|so fat|feel fat|look fat|hate my body|hate how I look)\b/i,
      /\b(can'?t|won'?t|refuse to) eat\b/i,
      /\b(count(ing)? calories obsessive|afraid of food|food is scary)\b/i,
    ],
  },
  substance_abuse: {
    severity: 'medium',
    patterns: [
      /\b(addicted|addiction|dependent) (to|on) (drugs|alcohol|pills|substances)\b/i,
      /\b(can'?t stop|unable to stop) (drinking|using|taking)\b/i,
      /\b(overdose|OD|took too (much|many)|abusing (drugs|pills|substances))\b/i,
      /\b(drunk|high|wasted) all the time\b/i,
      /\b(need|want|have to) (drink|use|get high) to (cope|feel better|function)\b/i,
    ],
  },
  bullying_victim: {
    severity: 'medium',
    patterns: [
      /\b(being bullied|everyone (hates|picks on) me|they (all )?(make fun|laugh at|tease) me)\b/i,
      /\b(cyber ?bully|online harassment|hateful messages|death threats)\b/i,
      /\b(no one likes me|I have no friends|everyone ignores me|feel so alone at school)\b/i,
      /\b(scared|afraid) to go to (school|class)\b/i,
    ],
  },
  abuse_disclosure: {
    severity: 'critical',
    patterns: [
      /\b(being abused|someone (is )?(hurt(ing)?|touch(ing)?|hit(ting)?) me)\b/i,
      /\b((my )?(parent|dad|mom|uncle|relative|teacher|coach) (hit|hurt|touch|abuse)(s|es|ed|ing)? me)\b/i,
      /\b(sexual(ly)? (abuse|assault|molest)|inappropriate touch(ing)?)\b/i,
      /\b(don'?t feel safe|afraid of .* at home|scared (at|of) home)\b/i,
      /\b(physical(ly)? (abuse|hurt)|domestic (violence|abuse))\b/i,
    ],
  },
  violence_threat: {
    severity: 'critical',
    patterns: [
      /\b(going to|want to|plan to) (hurt|kill|attack|shoot|stab) (someone|people|them|him|her|my)\b/i,
      /\b(bring(ing)? (a |my )?(gun|knife|weapon) to school)\b/i,
      /\b(school shoot(ing|er)?|mass (shooting|attack|violence))\b/i,
      /\b(everyone will pay|make them pay|they'?ll be sorry|revenge)\b/i,
    ],
  },
  emotional_distress: {
    severity: 'low',
    patterns: [
      /\b(feel(ing)? (so )?(hopeless|worthless|empty|numb|broken|lost|alone))\b/i,
      /\b(can'?t (take it|handle|cope|go on) anymore)\b/i,
      /\b(everything is (wrong|terrible|awful|hopeless))\b/i,
      /\b(so (tired|exhausted|drained) of (everything|life|trying))\b/i,
      /\b(crying (all|every) (day|night|time))\b/i,
    ],
  },
};

// =============================================================================
// CRISIS PRE-FILTER CLASS
// =============================================================================

export class CrisisPreFilter {
  private config: PreFilterConfig;
  private notificationCallback: ((context: UserContext, detection: CrisisDetectionResult) => Promise<void>) | null = null;

  constructor(config: Partial<PreFilterConfig> = {}) {
    this.config = {
      enableCrisisDetection: true,
      enableParentNotification: true,
      parentNotificationThreshold: 'high',
      blockHighSeverity: false,
      auditAllDetections: true,
      ...config,
    };
  }

  /**
   * Set callback for parent/guardian notification
   */
  setNotificationCallback(
    callback: (context: UserContext, detection: CrisisDetectionResult) => Promise<void>
  ): void {
    this.notificationCallback = callback;
  }

  /**
   * Main pre-filter method - analyzes content for crisis indicators
   */
  async analyze(content: string, context: UserContext): Promise<PreFilterResult> {
    const startTime = Date.now();

    if (!this.config.enableCrisisDetection) {
      return {
        content,
        wasBlocked: false,
        crisisDetection: null,
        processingTime: Date.now() - startTime,
      };
    }

    const detection = this.detectCrisis(content, context);

    if (detection.detected) {
      // Log the detection
      logger.warn('Crisis content detected', {
        userId: context.userId,
        sessionId: context.sessionId,
        severity: detection.severity,
        categories: detection.categories,
        auditId: detection.auditId,
        isMinor: context.isMinor,
      });

      // Track metrics
      metrics.increment('crisis_detection', {
        severity: detection.severity,
        category: detection.categories[0] || 'unknown',
        isMinor: String(context.isMinor),
      });

      // Trigger parent notification if required
      if (detection.requiresParentNotification && this.config.enableParentNotification) {
        await this.notifyParentGuardian(context, detection);
      }

      // Audit the detection
      if (this.config.auditAllDetections) {
        await this.auditDetection(context, detection);
      }
    }

    return {
      content: detection.response.blockContent ? '' : content,
      wasBlocked: detection.response.blockContent,
      crisisDetection: detection.detected ? detection : null,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Core crisis detection logic
   */
  private detectCrisis(content: string, context: UserContext): CrisisDetectionResult {
    const auditId = this.generateAuditId();
    const matchedCategories: CrisisCategory[] = [];
    const matchedPatterns: string[] = [];
    let highestSeverity: CrisisSeverity = 'low';
    let totalMatches = 0;

    // Check each category
    for (const [category, { patterns, severity }] of Object.entries(CRISIS_PATTERNS)) {
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          totalMatches++;
          matchedPatterns.push(match[0]);

          if (!matchedCategories.includes(category as CrisisCategory)) {
            matchedCategories.push(category as CrisisCategory);
          }

          // Track highest severity
          if (this.severityRank(severity) > this.severityRank(highestSeverity)) {
            highestSeverity = severity;
          }
        }
      }
    }

    const detected = matchedCategories.length > 0;
    const confidence = Math.min(totalMatches * 0.25 + 0.5, 1.0);

    // Determine if parent notification is required
    const requiresParentNotification =
      context.isMinor &&
      detected &&
      this.severityRank(highestSeverity) >= this.severityRank(this.config.parentNotificationThreshold);

    // Build response
    const response = this.buildCrisisResponse(matchedCategories, highestSeverity);

    return {
      detected,
      severity: highestSeverity,
      categories: matchedCategories,
      confidence,
      matchedPatterns: matchedPatterns.slice(0, 5), // Limit for privacy
      response,
      requiresParentNotification,
      auditId,
    };
  }

  /**
   * Build appropriate crisis response based on detection
   */
  private buildCrisisResponse(categories: CrisisCategory[], severity: CrisisSeverity): CrisisResponse {
    const resources: typeof CRISIS_RESOURCES[keyof typeof CRISIS_RESOURCES][] = [];

    // Always include 988 Suicide & Crisis Lifeline for high/critical severity
    if (severity === 'critical' || severity === 'high') {
      resources.push(CRISIS_RESOURCES.SUICIDE_CRISIS_LIFELINE);
      resources.push(CRISIS_RESOURCES.CRISIS_TEXT_LINE);
    }

    // Add specific resources based on categories
    if (categories.includes('abuse_disclosure')) {
      resources.push(CRISIS_RESOURCES.CHILD_HELP);
    }

    // Include Trevor Project for LGBTQ+ youth if detected (would need additional detection)
    // This is a placeholder - in production, use user context

    // Build supportive message
    let message = this.buildSupportiveMessage(categories, severity);

    // Determine if content should be blocked
    const blockContent = this.config.blockHighSeverity &&
      (severity === 'critical' || categories.includes('violence_threat'));

    return {
      showResources: severity !== 'low',
      resources,
      message,
      blockContent,
      escalate: severity === 'critical',
    };
  }

  /**
   * Build a supportive message based on crisis type
   */
  private buildSupportiveMessage(categories: CrisisCategory[], severity: CrisisSeverity): string {
    const messages: string[] = [];

    // Core supportive message
    messages.push("We care about your wellbeing and safety.");

    if (severity === 'critical' || severity === 'high') {
      messages.push("If you're in immediate danger, please call 988 or your local emergency services right away.");
    }

    // Category-specific messages
    if (categories.includes('suicide_ideation') || categories.includes('self_harm')) {
      messages.push(
        "You're not alone, and help is available 24/7. " +
        "Call or text 988 to reach the Suicide & Crisis Lifeline. " +
        "You can also text HOME to 741741 to reach the Crisis Text Line."
      );
    }

    if (categories.includes('abuse_disclosure')) {
      messages.push(
        "What you're experiencing is not your fault. " +
        "The Childhelp National Child Abuse Hotline is available 24/7 at 1-800-422-4453."
      );
    }

    if (categories.includes('bullying_victim')) {
      messages.push(
        "Being bullied is never okay. " +
        "Please talk to a trusted adult, teacher, or counselor. " +
        "You deserve to feel safe."
      );
    }

    if (categories.includes('emotional_distress')) {
      messages.push(
        "It's okay to not be okay sometimes. " +
        "Consider talking to someone you trust about how you're feeling."
      );
    }

    return messages.join(' ');
  }

  /**
   * Notify parent/guardian of crisis detection
   */
  private async notifyParentGuardian(
    context: UserContext,
    detection: CrisisDetectionResult
  ): Promise<void> {
    if (!context.parentGuardianId) {
      logger.warn('Parent notification required but no parent ID available', {
        userId: context.userId,
        auditId: detection.auditId,
      });
      return;
    }

    try {
      // Use the notification callback if set
      if (this.notificationCallback) {
        await this.notificationCallback(context, detection);
      } else {
        // Default logging - in production, integrate with notification service
        logger.info('Parent notification triggered', {
          parentId: context.parentGuardianId,
          studentId: context.userId,
          severity: detection.severity,
          categories: detection.categories,
          auditId: detection.auditId,
        });
      }

      metrics.increment('parent_notification_sent', {
        severity: detection.severity,
        category: detection.categories[0] || 'unknown',
      });
    } catch (error) {
      logger.error('Failed to send parent notification', {
        error,
        parentId: context.parentGuardianId,
        auditId: detection.auditId,
      });
      metrics.increment('parent_notification_failed');
    }
  }

  /**
   * Audit crisis detection for compliance
   */
  private async auditDetection(
    context: UserContext,
    detection: CrisisDetectionResult
  ): Promise<void> {
    const auditEntry = {
      auditId: detection.auditId,
      timestamp: new Date().toISOString(),
      userId: context.userId,
      sessionId: context.sessionId,
      isMinor: context.isMinor,
      tenantId: context.tenantId,
      schoolId: context.schoolId,
      severity: detection.severity,
      categories: detection.categories,
      confidence: detection.confidence,
      responseProvided: detection.response.showResources,
      resourcesShown: detection.response.resources.map((r) => r.name),
      parentNotified: detection.requiresParentNotification,
      contentBlocked: detection.response.blockContent,
      escalated: detection.response.escalate,
    };

    // Log audit entry
    logger.info('Crisis detection audit', auditEntry);

    // In production, this would write to a secure audit database
    // await this.auditService.logCrisisDetection(auditEntry);
  }

  /**
   * Helper: Rank severity levels
   */
  private severityRank(severity: CrisisSeverity): number {
    const ranks: Record<CrisisSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return ranks[severity];
  }

  /**
   * Helper: Generate unique audit ID
   */
  private generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `crisis-${timestamp}-${random}`;
  }

  /**
   * Get crisis resources for display
   */
  static getCrisisResources(): typeof CRISIS_RESOURCES {
    return CRISIS_RESOURCES;
  }

  /**
   * Format resources for user display
   */
  static formatResourcesForDisplay(
    resources: typeof CRISIS_RESOURCES[keyof typeof CRISIS_RESOURCES][]
  ): string {
    return resources
      .map((r) => {
        const lines = [`**${r.name}** (${r.availability})`];
        if ('phone' in r && r.phone) lines.push(`  Call: ${r.phone}`);
        if ('text' in r && r.text) lines.push(`  ${r.text}`);
        if (r.website) lines.push(`  Website: ${r.website}`);
        return lines.join('\n');
      })
      .join('\n\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

let preFilterInstance: CrisisPreFilter | null = null;

/**
 * Create a new CrisisPreFilter instance
 */
export function createPreFilter(config?: Partial<PreFilterConfig>): CrisisPreFilter {
  return new CrisisPreFilter(config);
}

/**
 * Initialize the singleton pre-filter instance
 */
export function initializePreFilter(config?: Partial<PreFilterConfig>): CrisisPreFilter {
  preFilterInstance = new CrisisPreFilter(config);
  return preFilterInstance;
}

/**
 * Get the singleton pre-filter instance
 */
export function getPreFilter(): CrisisPreFilter {
  if (!preFilterInstance) {
    throw new Error('PreFilter not initialized. Call initializePreFilter first.');
  }
  return preFilterInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetPreFilter(): void {
  preFilterInstance = null;
}

export default CrisisPreFilter;
