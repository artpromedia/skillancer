/**
 * @module @skillancer/skillpod-svc/tests/dlp-service
 * Unit tests for DLP (Data Loss Prevention) service
 */

// @ts-nocheck - TODO: Fix TypeScript errors in test mocks
import { describe, it, expect } from 'vitest';

// =============================================================================
// MOCK TYPES
// =============================================================================

interface SensitiveDataMatch {
  type: string;
  pattern: string;
  confidence: number;
  masked: string;
  position: { start: number; end: number };
}

interface _MalwareScanResult {
  isClean: boolean;
  threats: Array<{
    type: string;
    name: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

interface _DLPScanResult {
  allowed: boolean;
  reason?: string;
  sensitiveData: SensitiveDataMatch[];
  malwareScan?: _MalwareScanResult;
  contentHash: string;
  riskScore: number;
}

// =============================================================================
// MOCK DLP SERVICE IMPLEMENTATION (for testing)
// =============================================================================

const SENSITIVE_DATA_PATTERNS = {
  // Split credit card patterns to reduce complexity
  CREDIT_CARD_VISA: /\b4\d{12}(?:\d{3})?\b/g,
  CREDIT_CARD_MASTERCARD: /\b5[1-5]\d{14}\b/g,
  CREDIT_CARD_AMEX: /\b3[47]\d{13}\b/g,
  CREDIT_CARD_DISCOVER: /\b6(?:011|5\d{2})\d{12}\b/g,
  SSN: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  AWS_ACCESS_KEY: /\b(?:AKIA|ABIA|ACCA|ASIA)[\dA-Z]{16}\b/g,
  AWS_SECRET_KEY: /\b[A-Za-z\d/+=]{40}\b/g,
  GITHUB_TOKEN:
    /\b(?:ghp_[A-Za-z\d]{36}|gho_[A-Za-z\d]{36}|ghu_[A-Za-z\d]{36}|ghs_[A-Za-z\d]{36}|ghr_[A-Za-z\d]{36})\b/g,
  PRIVATE_KEY_HEADER: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE\s+KEY-----/g,
  JWT_TOKEN: /\beyJ[A-Za-z\d_-]+\.eyJ[A-Za-z\d_-]+\.[A-Za-z\d_-]+\b/g,
  STRIPE_KEY: /\bsk_(?:live|test)_[A-Za-z\d]{24,}\b/g,
  PASSWORD_IN_URL: /(?:password|pwd|passwd|pass)[:=][^\s&]+/gi,
  // Simplified IP address pattern
  IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  BANK_ACCOUNT: /\b\d{8,17}\b/g,
  IBAN: /\b[A-Z]{2}\d{2}[A-Z\d]{4}\d{7}[A-Z\d]{1,16}\b/g,
} as const;

function scanForSensitiveData(content: string): SensitiveDataMatch[] {
  const matches: SensitiveDataMatch[] = [];

  for (const [type, regex] of Object.entries(SENSITIVE_DATA_PATTERNS)) {
    const patternMatches = content.matchAll(regex);

    for (const match of patternMatches) {
      const value = match[0];
      // Skip common false positives
      if (type === 'BANK_ACCOUNT' && (value.length < 10 || value.length > 17)) {
        continue;
      }

      matches.push({
        type,
        pattern: regex.source.substring(0, 30) + '...',
        confidence: calculateConfidence(type, value),
        masked: maskValue(type, value),
        position: {
          start: match.index ?? 0,
          end: (match.index ?? 0) + value.length,
        },
      });
    }
  }

  return matches;
}

function calculateConfidence(type: string, value: string): number {
  switch (type) {
    case 'CREDIT_CARD_VISA':
    case 'CREDIT_CARD_MASTERCARD':
    case 'CREDIT_CARD_AMEX':
    case 'CREDIT_CARD_DISCOVER':
      return luhnCheck(value.replaceAll(/\D/g, '')) ? 0.95 : 0.5;
    case 'SSN':
      return 0.9;
    case 'AWS_ACCESS_KEY':
    case 'AWS_SECRET_KEY':
    case 'GITHUB_TOKEN':
    case 'STRIPE_KEY':
      return 0.95;
    case 'PRIVATE_KEY_HEADER':
    case 'JWT_TOKEN':
      return 0.99;
    case 'EMAIL':
      return 0.85;
    case 'PHONE':
      return 0.7;
    case 'IP_ADDRESS':
      return 0.6;
    default:
      return 0.5;
  }
}

function luhnCheck(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false;

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

function maskValue(type: string, value: string): string {
  switch (type) {
    case 'CREDIT_CARD_VISA':
    case 'CREDIT_CARD_MASTERCARD':
    case 'CREDIT_CARD_AMEX':
    case 'CREDIT_CARD_DISCOVER':
      return value.replaceAll(/\d(?=\d{4})/g, '*');
    case 'SSN':
      return 'XXX-XX-' + value.slice(-4);
    case 'EMAIL': {
      const [local, domain] = value.split('@');
      return local[0] + '***@' + domain;
    }
    case 'PHONE':
      return value.slice(0, 3) + '****' + value.slice(-4);
    case 'AWS_ACCESS_KEY':
    case 'AWS_SECRET_KEY':
    case 'GITHUB_TOKEN':
    case 'STRIPE_KEY':
    case 'JWT_TOKEN':
      return value.substring(0, 8) + '***[REDACTED]***';
    case 'PRIVATE_KEY_HEADER':
      return '[PRIVATE KEY DETECTED]';
    case 'PASSWORD_IN_URL':
      return value.split(/[:=]/)[0] + '=***';
    default:
      return '***[REDACTED]***';
  }
}

function calculateRiskScore(matches: SensitiveDataMatch[]): number {
  if (matches.length === 0) return 0;

  let score = 0;
  const typeWeights: Record<string, number> = {
    PRIVATE_KEY_HEADER: 100,
    AWS_ACCESS_KEY: 90,
    AWS_SECRET_KEY: 90,
    STRIPE_KEY: 85,
    GITHUB_TOKEN: 85,
    JWT_TOKEN: 80,
    CREDIT_CARD_VISA: 80,
    CREDIT_CARD_MASTERCARD: 80,
    CREDIT_CARD_AMEX: 80,
    CREDIT_CARD_DISCOVER: 80,
    SSN: 75,
    BANK_ACCOUNT: 70,
    IBAN: 70,
    PASSWORD_IN_URL: 60,
    EMAIL: 20,
    PHONE: 15,
    IP_ADDRESS: 10,
  };

  for (const match of matches) {
    score += (typeWeights[match.type] ?? 10) * match.confidence;
  }

  return Math.min(100, score);
}

// =============================================================================
// TESTS: Sensitive Data Detection
// =============================================================================

describe('DLP Service - Sensitive Data Detection', () => {
  describe('Credit Card Detection', () => {
    it('should detect Visa card numbers', () => {
      const content = 'My card number is 4111111111111111';
      const matches = scanForSensitiveData(content);

      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('CREDIT_CARD_VISA');
      expect(matches[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect Mastercard numbers', () => {
      const content = 'Payment with 5555555555554444';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'CREDIT_CARD_MASTERCARD')).toBe(true);
    });

    it('should detect American Express numbers', () => {
      const content = 'Amex card: 378282246310005';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'CREDIT_CARD_AMEX')).toBe(true);
    });

    it('should mask credit card numbers correctly', () => {
      const content = 'Card: 4111111111111111';
      const matches = scanForSensitiveData(content);

      expect(matches[0].masked).toMatch(/\*+1111$/);
    });

    it('should have high confidence for valid Luhn numbers', () => {
      const content = 'Valid card: 4111111111111111'; // Passes Luhn
      const matches = scanForSensitiveData(content);

      expect(matches[0].confidence).toBe(0.95);
    });

    it('should have lower confidence for invalid Luhn numbers', () => {
      const content = 'Invalid card: 4111111111111112'; // Fails Luhn
      const matches = scanForSensitiveData(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].confidence).toBe(0.5);
    });
  });

  describe('SSN Detection', () => {
    it('should detect SSN with dashes', () => {
      const content = 'SSN: 123-45-6789';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'SSN')).toBe(true);
    });

    it('should detect SSN with spaces', () => {
      const content = 'SSN: 123 45 6789';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'SSN')).toBe(true);
    });

    it('should detect SSN without separators', () => {
      const content = 'SSN: 123456789';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'SSN')).toBe(true);
    });

    it('should mask SSN to show only last 4 digits', () => {
      const content = 'SSN: 123-45-6789';
      const matches = scanForSensitiveData(content);
      const ssnMatch = matches.find((m) => m.type === 'SSN');

      expect(ssnMatch?.masked).toBe('XXX-XX-6789');
    });

    it('should not detect invalid SSN starting with 000', () => {
      const content = 'Invalid SSN: 000-12-3456';
      const matches = scanForSensitiveData(content);

      expect(matches.filter((m) => m.type === 'SSN')).toHaveLength(0);
    });
  });

  describe('API Key Detection', () => {
    it('should detect AWS access keys', () => {
      const content = 'AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'AWS_ACCESS_KEY')).toBe(true);
    });

    it('should detect GitHub personal access tokens', () => {
      const content = 'GITHUB_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'GITHUB_TOKEN')).toBe(true);
    });

    it('should detect Stripe secret keys', () => {
      // Using sk_test pattern to avoid triggering secret scanners
      const content = 'stripe_key: sk_test_FAKE_KEY_FOR_TESTING_0123';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'STRIPE_KEY')).toBe(true);
    });

    it('should detect private key headers', () => {
      const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBALRiMLAO...';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'PRIVATE_KEY_HEADER')).toBe(true);
    });

    it('should detect JWT tokens', () => {
      const content =
        'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'JWT_TOKEN')).toBe(true);
    });
  });

  describe('Contact Information Detection', () => {
    it('should detect email addresses', () => {
      const content = 'Contact me at john.doe@example.com';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'EMAIL')).toBe(true);
    });

    it('should detect US phone numbers', () => {
      const content = 'Call me at (555) 123-4567';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'PHONE')).toBe(true);
    });

    it('should detect phone numbers with +1', () => {
      const content = 'Phone: +1-555-123-4567';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'PHONE')).toBe(true);
    });

    it('should mask email addresses', () => {
      const content = 'Email: john.doe@example.com';
      const matches = scanForSensitiveData(content);
      const emailMatch = matches.find((m) => m.type === 'EMAIL');

      expect(emailMatch?.masked).toBe('j***@example.com');
    });
  });

  describe('Password Detection', () => {
    it('should detect passwords in URLs', () => {
      const content = 'https://user:password=secret123&other=value';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'PASSWORD_IN_URL')).toBe(true);
    });

    it('should detect pwd parameter', () => {
      const content = 'connection_string="server=db;pwd=mysecret"';
      const matches = scanForSensitiveData(content);

      expect(matches.some((m) => m.type === 'PASSWORD_IN_URL')).toBe(true);
    });
  });
});

// =============================================================================
// TESTS: Risk Score Calculation
// =============================================================================

describe('DLP Service - Risk Score Calculation', () => {
  it('should return 0 for content without sensitive data', () => {
    const matches: SensitiveDataMatch[] = [];
    const score = calculateRiskScore(matches);

    expect(score).toBe(0);
  });

  it('should return high score for private keys', () => {
    const matches: SensitiveDataMatch[] = [
      {
        type: 'PRIVATE_KEY_HEADER',
        pattern: '-----BEGIN',
        confidence: 0.99,
        masked: '[PRIVATE KEY DETECTED]',
        position: { start: 0, end: 30 },
      },
    ];
    const score = calculateRiskScore(matches);

    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('should return high score for AWS credentials', () => {
    const matches: SensitiveDataMatch[] = [
      {
        type: 'AWS_ACCESS_KEY',
        pattern: 'AKIA...',
        confidence: 0.95,
        masked: 'AKIAIOSFODNN7***[REDACTED]***',
        position: { start: 0, end: 20 },
      },
    ];
    const score = calculateRiskScore(matches);

    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('should return moderate score for credit cards', () => {
    const matches: SensitiveDataMatch[] = [
      {
        type: 'CREDIT_CARD_VISA',
        pattern: '4[0-9]{12}...',
        confidence: 0.95,
        masked: '************1111',
        position: { start: 0, end: 16 },
      },
    ];
    const score = calculateRiskScore(matches);

    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThan(100);
  });

  it('should return low score for only email addresses', () => {
    const matches: SensitiveDataMatch[] = [
      {
        type: 'EMAIL',
        pattern: '[A-Za-z0-9._%+-]+@...',
        confidence: 0.85,
        masked: 'j***@example.com',
        position: { start: 0, end: 20 },
      },
    ];
    const score = calculateRiskScore(matches);

    expect(score).toBeLessThan(30);
  });

  it('should cap score at 100', () => {
    const matches: SensitiveDataMatch[] = [
      {
        type: 'PRIVATE_KEY_HEADER',
        pattern: '',
        confidence: 0.99,
        masked: '',
        position: { start: 0, end: 0 },
      },
      {
        type: 'AWS_ACCESS_KEY',
        pattern: '',
        confidence: 0.95,
        masked: '',
        position: { start: 0, end: 0 },
      },
      {
        type: 'CREDIT_CARD_VISA',
        pattern: '',
        confidence: 0.95,
        masked: '',
        position: { start: 0, end: 0 },
      },
      { type: 'SSN', pattern: '', confidence: 0.9, masked: '', position: { start: 0, end: 0 } },
    ];
    const score = calculateRiskScore(matches);

    expect(score).toBe(100);
  });

  it('should accumulate scores from multiple matches', () => {
    const singleMatch: SensitiveDataMatch[] = [
      { type: 'EMAIL', pattern: '', confidence: 0.85, masked: '', position: { start: 0, end: 0 } },
    ];
    const multipleMatches: SensitiveDataMatch[] = [
      { type: 'EMAIL', pattern: '', confidence: 0.85, masked: '', position: { start: 0, end: 0 } },
      {
        type: 'EMAIL',
        pattern: '',
        confidence: 0.85,
        masked: '',
        position: { start: 20, end: 40 },
      },
      {
        type: 'EMAIL',
        pattern: '',
        confidence: 0.85,
        masked: '',
        position: { start: 40, end: 60 },
      },
    ];

    const singleScore = calculateRiskScore(singleMatch);
    const multipleScore = calculateRiskScore(multipleMatches);

    expect(multipleScore).toBeGreaterThan(singleScore);
  });
});

// =============================================================================
// TESTS: Luhn Algorithm
// =============================================================================

describe('DLP Service - Luhn Algorithm', () => {
  it('should return true for valid Visa card', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
  });

  it('should return true for valid Mastercard', () => {
    expect(luhnCheck('5555555555554444')).toBe(true);
  });

  it('should return true for valid Amex', () => {
    expect(luhnCheck('378282246310005')).toBe(true);
  });

  it('should return false for invalid card number', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
  });

  it('should return false for non-numeric string', () => {
    expect(luhnCheck('abcd1234')).toBe(false);
  });
});

// =============================================================================
// TESTS: Combined Scanning
// =============================================================================

describe('DLP Service - Combined Scanning', () => {
  it('should detect multiple types of sensitive data in same content', () => {
    const content = `
      Customer: John Doe
      Email: john@example.com
      Phone: 555-123-4567
      SSN: 123-45-6789
      Credit Card: 4111111111111111
    `;

    const matches = scanForSensitiveData(content);
    const types = new Set(matches.map((m) => m.type));

    expect(types.has('EMAIL')).toBe(true);
    expect(types.has('PHONE')).toBe(true);
    expect(types.has('SSN')).toBe(true);
    expect(types.has('CREDIT_CARD')).toBe(true);
  });

  it('should provide accurate positions for matches', () => {
    const content = 'Card: 4111111111111111';
    const matches = scanForSensitiveData(content);

    const cardMatch = matches.find((m) => m.type === 'CREDIT_CARD_VISA');
    expect(cardMatch).toBeDefined();
    if (cardMatch) {
      expect(content.substring(cardMatch.position.start, cardMatch.position.end)).toBe(
        '4111111111111111'
      );
    }
  });

  it('should handle large content efficiently', () => {
    const largeContent = 'Normal text without sensitive data. '.repeat(10000);

    const startTime = Date.now();
    const matches = scanForSensitiveData(largeContent);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    expect(matches).toHaveLength(0);
  });

  it('should handle empty content', () => {
    const matches = scanForSensitiveData('');
    expect(matches).toHaveLength(0);
  });

  it('should handle content with only whitespace', () => {
    const matches = scanForSensitiveData('   \n\t   \n   ');
    expect(matches).toHaveLength(0);
  });
});

// =============================================================================
// TESTS: Transfer Evaluation
// =============================================================================

describe('DLP Service - Transfer Evaluation', () => {
  it('should block transfer with high-risk sensitive data', () => {
    const content = 'AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE';
    const matches = scanForSensitiveData(content);
    const riskScore = calculateRiskScore(matches);

    expect(riskScore).toBeGreaterThan(50);
    // In real implementation, transfers with risk > 50 would be blocked
  });

  it('should allow transfer with only low-risk data', () => {
    const content = 'Please contact us at support@example.com for assistance.';
    const matches = scanForSensitiveData(content);
    const riskScore = calculateRiskScore(matches);

    expect(riskScore).toBeLessThan(50);
    // In real implementation, transfers with risk < 50 would be allowed
  });

  it('should detect code/config files with embedded secrets', () => {
    const configFile = `
      database:
        host: localhost
        password: mysecretpassword123
      aws:
        access_key: AKIAIOSFODNN7EXAMPLE
        secret_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    `;

    const matches = scanForSensitiveData(configFile);

    expect(matches.some((m) => m.type === 'AWS_ACCESS_KEY')).toBe(true);
  });
});
