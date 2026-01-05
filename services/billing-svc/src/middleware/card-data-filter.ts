// @ts-nocheck
/**
 * @module @skillancer/billing-svc/middleware/card-data-filter
 * PCI DSS Card Data Filter Middleware
 *
 * Features:
 * - Request/Response sanitization
 * - Card data pattern detection
 * - Automatic redaction
 * - Violation logging and alerting
 * - Stripe token passthrough
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import fp from 'fastify-plugin';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export interface CardDataViolation {
  type: 'PAN' | 'CVV' | 'EXPIRY' | 'TRACK_DATA';
  location: 'body' | 'query' | 'headers' | 'url';
  path?: string;
  masked: string;
  timestamp: Date;
  requestId: string;
  ipAddress: string;
}

export interface FilterOptions {
  enabled: boolean;
  blockOnViolation: boolean;
  logViolations: boolean;
  alertOnViolation: boolean;
  allowedPaths: string[];
}

// =============================================================================
// PATTERNS
// =============================================================================

// Credit card number patterns (major brands)
const PAN_PATTERNS = [
  // Visa: starts with 4, 13-19 digits
  /\b4[0-9]{12}(?:[0-9]{3,6})?\b/g,
  // Mastercard: starts with 51-55 or 2221-2720, 16 digits
  /\b(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}\b/g,
  // American Express: starts with 34 or 37, 15 digits
  /\b3[47][0-9]{13}\b/g,
  // Discover: starts with 6011, 622126-622925, 644-649, 65, 16 digits
  /\b(?:6011|65[0-9]{2}|64[4-9][0-9])[0-9]{12}\b/g,
  // Generic 13-19 digit number that passes Luhn
  /\b[0-9]{13,19}\b/g,
];

// CVV/CVC patterns
const CVV_PATTERNS = [
  // 3-4 digit CVV with context
  /\b(?:cvv|cvc|cvn|cid|security.?code)[:\s]*([0-9]{3,4})\b/gi,
  // Standalone 3-4 digit numbers (high false positive, use with caution)
];

// Expiry date patterns
const EXPIRY_PATTERNS = [
  // MM/YY or MM/YYYY
  /\b(0[1-9]|1[0-2])[\/\-](2[0-9]|[0-9]{4})\b/g,
  // Expiry with context
  /\b(?:exp(?:ir(?:y|ation))?|valid.?(?:until|thru|through))[:\s]*([0-9]{2}[\/\-][0-9]{2,4})\b/gi,
];

// Track data patterns (magnetic stripe)
const TRACK_DATA_PATTERNS = [
  // Track 1
  /%B[0-9]{13,19}\^[\w\s\/]+\^[0-9]{4}/g,
  // Track 2
  /;[0-9]{13,19}=[0-9]{4}/g,
];

// =============================================================================
// LUHN CHECK
// =============================================================================

function passesLuhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number.parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// =============================================================================
// CARD DATA FILTER MIDDLEWARE
// =============================================================================

const cardDataFilterPlugin: FastifyPluginAsync<FilterOptions> = async (fastify, options) => {
  const opts: FilterOptions = {
    enabled: options.enabled !== false,
    blockOnViolation: options.blockOnViolation !== false,
    logViolations: options.logViolations !== false,
    alertOnViolation: options.alertOnViolation ?? true,
    allowedPaths: options.allowedPaths || ['/webhooks/stripe'],
  };

  if (!opts.enabled) {
    logger.info('Card data filter is disabled');
    return;
  }

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip allowed paths (e.g., webhook endpoints that receive Stripe data)
    if (opts.allowedPaths.some((path) => request.url.startsWith(path))) {
      return;
    }

    // Skip if the request is from Stripe (internal processing)
    const userAgent = request.headers['user-agent'] || '';
    if (userAgent.includes('Stripe')) {
      return;
    }

    const violations: CardDataViolation[] = [];
    const requestId = request.id || 'unknown';
    const ipAddress = request.ip;

    // Check request body
    if (request.body && typeof request.body === 'object') {
      const bodyViolations = scanObject(
        request.body as Record<string, unknown>,
        'body',
        requestId,
        ipAddress
      );
      violations.push(...bodyViolations);
    }

    // Check query parameters
    if (request.query && typeof request.query === 'object') {
      const queryViolations = scanObject(
        request.query as Record<string, unknown>,
        'query',
        requestId,
        ipAddress
      );
      violations.push(...queryViolations);
    }

    // Check URL path
    const urlViolations = scanString(request.url, 'url', requestId, ipAddress);
    violations.push(...urlViolations);

    // Handle violations
    if (violations.length > 0) {
      logger.error(
        {
          requestId,
          ipAddress,
          url: request.url,
          violations: violations.map((v) => ({
            type: v.type,
            location: v.location,
            path: v.path,
          })),
        },
        'CRITICAL: Card data detected in request'
      );

      // Log violations
      if (opts.logViolations) {
        await logViolations(violations, request);
      }

      // Alert
      if (opts.alertOnViolation) {
        await alertOnViolation(violations, request);
      }

      // Block request
      if (opts.blockOnViolation) {
        return reply.status(400).send({
          error: 'Invalid request',
          message:
            'Request contains prohibited data patterns. Please use Stripe.js for card handling.',
          code: 'CARD_DATA_VIOLATION',
        });
      }
    }
  });

  // Response sanitization hook
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (typeof payload !== 'string') return payload;

    // Check for card data in response
    let sanitized = payload;
    let foundViolation = false;

    // Redact any PANs in response
    for (const pattern of PAN_PATTERNS) {
      const matches = sanitized.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (passesLuhnCheck(match) && !isStripeToken(match)) {
            foundViolation = true;
            sanitized = sanitized.replace(match, maskPAN(match));
          }
        }
      }
    }

    if (foundViolation) {
      logger.error(
        {
          requestId: request.id,
          url: request.url,
        },
        'CRITICAL: Card data detected in response - automatically redacted'
      );
    }

    return sanitized;
  });

  logger.info('Card data filter middleware registered');
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function scanObject(
  obj: Record<string, unknown>,
  location: CardDataViolation['location'],
  requestId: string,
  ipAddress: string,
  path = ''
): CardDataViolation[] {
  const violations: CardDataViolation[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    // Skip Stripe token fields
    if (isStripeField(key)) continue;

    if (typeof value === 'string') {
      const stringViolations = scanString(value, location, requestId, ipAddress, currentPath);
      violations.push(...stringViolations);
    } else if (typeof value === 'object' && value !== null) {
      const nestedViolations = scanObject(
        value as Record<string, unknown>,
        location,
        requestId,
        ipAddress,
        currentPath
      );
      violations.push(...nestedViolations);
    }
  }

  return violations;
}

function scanString(
  value: string,
  location: CardDataViolation['location'],
  requestId: string,
  ipAddress: string,
  path?: string
): CardDataViolation[] {
  const violations: CardDataViolation[] = [];

  // Check for PANs
  for (const pattern of PAN_PATTERNS) {
    const matches = value.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Only flag if it passes Luhn check and isn't a Stripe token
        if (passesLuhnCheck(match) && !isStripeToken(match)) {
          violations.push({
            type: 'PAN',
            location,
            path,
            masked: maskPAN(match),
            timestamp: new Date(),
            requestId,
            ipAddress,
          });
        }
      }
    }
  }

  // Check for CVV (in context)
  for (const pattern of CVV_PATTERNS) {
    if (pattern.test(value)) {
      violations.push({
        type: 'CVV',
        location,
        path,
        masked: '***',
        timestamp: new Date(),
        requestId,
        ipAddress,
      });
    }
  }

  // Check for track data
  for (const pattern of TRACK_DATA_PATTERNS) {
    if (pattern.test(value)) {
      violations.push({
        type: 'TRACK_DATA',
        location,
        path,
        masked: '[TRACK DATA REDACTED]',
        timestamp: new Date(),
        requestId,
        ipAddress,
      });
    }
  }

  return violations;
}

function isStripeField(key: string): boolean {
  const stripeFields = [
    'stripePaymentIntentId',
    'stripePaymentMethodId',
    'stripeCustomerId',
    'stripeAccountId',
    'stripePayoutId',
    'stripeRefundId',
    'stripeTransferId',
    'stripeChargeId',
    'stripeEventId',
    'client_secret',
    'payment_intent',
    'payment_method',
    'setup_intent',
  ];

  return (
    stripeFields.includes(key) ||
    key.startsWith('stripe') ||
    key.startsWith('pm_') ||
    key.startsWith('pi_')
  );
}

function isStripeToken(value: string): boolean {
  // Stripe tokens/IDs start with specific prefixes
  const stripePrefixes = [
    'tok_',
    'pm_',
    'pi_',
    'ch_',
    'cus_',
    're_',
    'po_',
    'tr_',
    'acct_',
    'sub_',
    'in_',
    'evt_',
    'src_',
    'seti_',
    'cs_',
  ];

  return stripePrefixes.some((prefix) => value.startsWith(prefix));
}

function maskPAN(pan: string): string {
  const digits = pan.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `****${digits.slice(-4)}`;
}

async function logViolations(
  violations: CardDataViolation[],
  request: FastifyRequest
): Promise<void> {
  for (const violation of violations) {
    await prisma.securityViolation.create({
      data: {
        type: 'CARD_DATA_EXPOSURE',
        severity: 'CRITICAL',
        details: {
          violationType: violation.type,
          location: violation.location,
          path: violation.path,
          masked: violation.masked,
          url: request.url,
          method: request.method,
          userAgent: request.headers['user-agent'] || null,
        },
        ipAddress: violation.ipAddress,
        requestId: violation.requestId,
        createdAt: violation.timestamp,
      },
    });
  }
}

async function alertOnViolation(
  violations: CardDataViolation[],
  request: FastifyRequest
): Promise<void> {
  // TODO: Integrate with alerting service
  logger.error(
    {
      alert: 'CARD_DATA_VIOLATION',
      severity: 'CRITICAL',
      violationCount: violations.length,
      url: request.url,
      ip: request.ip,
      requestId: request.id,
    },
    'SECURITY ALERT: Card data detected in request'
  );

  // In production, send to PagerDuty, Slack, etc.
  // await alertingService.sendCriticalAlert({
  //   type: 'CARD_DATA_VIOLATION',
  //   details: { violations, request: { url: request.url, method: request.method } },
  // });
}

// =============================================================================
// EXPORT
// =============================================================================

export default fp(cardDataFilterPlugin, {
  name: 'card-data-filter',
  fastify: '4.x',
});

export { cardDataFilterPlugin };

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export { passesLuhnCheck, maskPAN, isStripeToken, isStripeField };

