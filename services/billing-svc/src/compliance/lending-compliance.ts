// @ts-nocheck
/**
 * Lending Compliance Service
 * TILA, ECOA, and state lending law compliance
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'lending-compliance' });

// ============================================================================
// TYPES
// ============================================================================

export interface APRDisclosure {
  nominalAPR: number;
  effectiveAPR: number;
  financeCharge: number;
  totalOfPayments: number;
  paymentSchedule: string;
}

export interface LendingTerms {
  advanceAmount: number;
  feeAmount: number;
  feePercent: number;
  expectedDurationDays: number;
  repaymentMethod: 'automatic' | 'manual';
}

export interface Disclosure {
  type: 'pre_agreement' | 'agreement' | 'adverse_action' | 'change_in_terms';
  content: string;
  requiredFields: string[];
  generatedAt: Date;
}

export interface AdverseActionNotice {
  userId: string;
  reasons: string[];
  creditScore?: number;
  creditBureau?: string;
  generatedAt: Date;
  sentAt?: Date;
}

export interface StateLicense {
  state: string;
  licenseNumber: string;
  expirationDate: Date;
  status: 'active' | 'expired' | 'pending';
}

// ============================================================================
// CONSTANTS
// ============================================================================

// States where we can offer financing (have license or no license required)
const LICENSED_STATES = new Set([
  'CA',
  'TX',
  'NY',
  'FL',
  'IL',
  'PA',
  'OH',
  'GA',
  'NC',
  'MI',
  'NJ',
  'VA',
  'WA',
  'AZ',
  'MA',
  'TN',
  'IN',
  'MO',
  'MD',
  'WI',
  'CO',
  'MN',
  'SC',
  'AL',
  'LA',
  'KY',
  'OR',
  'OK',
  'CT',
  'UT',
  'NV',
  'AR',
  'MS',
  'KS',
  'NM',
  'NE',
  'HI',
  'ID',
  'ME',
  'NH',
  'RI',
  'MT',
  'DE',
  'SD',
  'ND',
  'WV',
  'AK',
  'VT',
  'WY',
  'DC',
]);

// States requiring additional disclosures
const ENHANCED_DISCLOSURE_STATES = new Set(['CA', 'NY', 'IL', 'MD', 'NJ', 'VA']);

// Maximum APR by state (some states have usury limits)
const STATE_APR_LIMITS: Record<string, number> = {
  NY: 25,
  CA: 36,
  CT: 12,
  MD: 33,
  // Most states don't have limits or have very high limits
};

// TILA Regulation Z required disclosures
const TILA_REQUIRED_FIELDS = [
  'amount_financed',
  'finance_charge',
  'annual_percentage_rate',
  'total_of_payments',
  'payment_schedule',
  'security_interest',
  'late_payment_terms',
  'prepayment_policy',
];

// ============================================================================
// LENDING COMPLIANCE SERVICE
// ============================================================================

export class LendingComplianceService {
  /**
   * Check if we can offer financing in a state
   */
  isStateEligible(state: string): boolean {
    return LICENSED_STATES.has(state.toUpperCase());
  }

  /**
   * Get state-specific APR limit
   */
  getStateAPRLimit(state: string): number | null {
    return STATE_APR_LIMITS[state.toUpperCase()] ?? null;
  }

  /**
   * Calculate APR for disclosure (annualized)
   */
  calculateAPR(terms: LendingTerms): APRDisclosure {
    const { advanceAmount, feeAmount, expectedDurationDays } = terms;

    // Calculate daily rate
    const dailyRate = feeAmount / advanceAmount / expectedDurationDays;

    // Annualize
    const nominalAPR = dailyRate * 365 * 100;

    // Effective APR (compounded)
    const effectiveAPR = (Math.pow(1 + dailyRate, 365) - 1) * 100;

    return {
      nominalAPR: Math.round(nominalAPR * 100) / 100,
      effectiveAPR: Math.round(effectiveAPR * 100) / 100,
      financeCharge: feeAmount,
      totalOfPayments: advanceAmount + feeAmount,
      paymentSchedule: 'Due upon client payment of invoice',
    };
  }

  /**
   * Validate terms comply with state limits
   */
  validateStateCompliance(
    terms: LendingTerms,
    state: string
  ): {
    compliant: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check if state is eligible
    if (!this.isStateEligible(state)) {
      violations.push(`Financing not available in ${state}`);
    }

    // Check APR limit
    const aprLimit = this.getStateAPRLimit(state);
    if (aprLimit) {
      const apr = this.calculateAPR(terms);
      if (apr.nominalAPR > aprLimit) {
        violations.push(`APR ${apr.nominalAPR}% exceeds state limit of ${aprLimit}%`);
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  // --------------------------------------------------------------------------
  // TILA COMPLIANCE
  // --------------------------------------------------------------------------

  /**
   * Generate TILA-compliant pre-agreement disclosure
   */
  generatePreAgreementDisclosure(terms: LendingTerms, state: string): Disclosure {
    const apr = this.calculateAPR(terms);
    const stateEnhanced = ENHANCED_DISCLOSURE_STATES.has(state.toUpperCase());

    let content = `
TRUTH IN LENDING DISCLOSURE STATEMENT

ANNUAL PERCENTAGE RATE: ${apr.nominalAPR}%
(The cost of your credit as a yearly rate)

FINANCE CHARGE: $${apr.financeCharge.toFixed(2)}
(The dollar amount the credit will cost you)

AMOUNT FINANCED: $${terms.advanceAmount.toFixed(2)}
(The amount of credit provided to you)

TOTAL OF PAYMENTS: $${apr.totalOfPayments.toFixed(2)}
(The amount you will have paid after you have made all payments)

PAYMENT SCHEDULE:
Your payment is due when your client pays the invoice. The amount due is the 
Amount Financed plus the Finance Charge.

SECURITY: This advance is secured by the underlying invoice receivable.

PREPAYMENT: If your client pays early, you will repay the advance plus the 
full finance charge. No prepayment penalty applies.

LATE CHARGES: If the invoice is not paid within 90 days, additional fees 
may apply as specified in your agreement.
`;

    if (stateEnhanced) {
      content += this.getStateSpecificDisclosure(state);
    }

    logger.info('Generated pre-agreement disclosure', { state, apr: apr.nominalAPR });
    metrics.increment('compliance.disclosure.generated', { type: 'pre_agreement' });

    return {
      type: 'pre_agreement',
      content: content.trim(),
      requiredFields: TILA_REQUIRED_FIELDS,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate state-specific additional disclosures
   */
  private getStateSpecificDisclosure(state: string): string {
    const disclosures: Record<string, string> = {
      CA: `

CALIFORNIA DISCLOSURE:
This advance is made under the California Financing Law. You have the right 
to cancel this transaction within 3 business days of signing. The lender is 
licensed by the California Department of Financial Protection and Innovation.
`,
      NY: `

NEW YORK DISCLOSURE:
This advance is subject to New York banking law. The lender is licensed by 
the New York Department of Financial Services. You have certain rights under 
New York law regarding the terms of this transaction.
`,
      IL: `

ILLINOIS DISCLOSURE:
This transaction is subject to the Illinois Consumer Installment Loan Act. 
You may prepay this advance at any time without penalty.
`,
    };

    return disclosures[state.toUpperCase()] || '';
  }

  // --------------------------------------------------------------------------
  // ECOA COMPLIANCE
  // --------------------------------------------------------------------------

  /**
   * Validate decision doesn't violate ECOA (fair lending)
   */
  validateFairLending(decision: {
    userId: string;
    approved: boolean;
    factors: Record<string, any>;
  }): { compliant: boolean; concerns: string[] } {
    const concerns: string[] = [];

    // ECOA prohibits discrimination based on:
    const prohibitedFactors = [
      'race',
      'color',
      'religion',
      'national_origin',
      'sex',
      'marital_status',
      'age', // unless used as a legitimate factor
      'public_assistance',
      'good_faith_exercise_of_rights',
    ];

    for (const factor of prohibitedFactors) {
      if (factor in decision.factors) {
        concerns.push(`Prohibited factor "${factor}" was used in decision`);
      }
    }

    // Log for fair lending monitoring
    logger.info('Fair lending validation', {
      userId: decision.userId,
      approved: decision.approved,
      compliant: concerns.length === 0,
    });

    return {
      compliant: concerns.length === 0,
      concerns,
    };
  }

  /**
   * Generate adverse action notice (required when denying credit)
   */
  generateAdverseActionNotice(
    userId: string,
    reasons: string[],
    creditInfo?: { score: number; bureau: string }
  ): AdverseActionNotice {
    // Map internal reasons to consumer-friendly language
    const reasonMappings: Record<string, string> = {
      low_tenure: 'Length of time as a Skillancer user',
      low_completion_rate: 'History of completed projects',
      payment_history: 'Payment history on previous advances',
      insufficient_income: 'Insufficient income history',
      client_risk: 'Risk assessment of invoice client',
      invoice_age: 'Age of the invoice',
      amount_too_high: 'Amount requested exceeds available limit',
    };

    const mappedReasons = reasons.map((r) => reasonMappings[r] || r);

    logger.info('Generated adverse action notice', { userId, reasons: mappedReasons });
    metrics.increment('compliance.adverse_action.generated');

    return {
      userId,
      reasons: mappedReasons,
      creditScore: creditInfo?.score,
      creditBureau: creditInfo?.bureau,
      generatedAt: new Date(),
    };
  }

  /**
   * Format adverse action notice for delivery
   */
  formatAdverseActionNotice(notice: AdverseActionNotice): string {
    let content = `
NOTICE OF ADVERSE ACTION

Date: ${notice.generatedAt.toLocaleDateString()}

Dear User,

We regret to inform you that your recent request for invoice financing has 
been denied. This decision was based on the following reason(s):

${notice.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    if (notice.creditScore && notice.creditBureau) {
      content += `
CREDIT SCORE INFORMATION:
Your credit score was obtained from ${notice.creditBureau} and was ${notice.creditScore}. 
This score was a factor in our decision.

You have the right to:
- Obtain a free copy of your credit report from ${notice.creditBureau} within 60 days
- Dispute the accuracy of information in your credit report
`;
    }

    content += `
You have the right to a statement of specific reasons for this decision. 
If you wish to receive this statement, please contact us within 60 days at 
support@skillancer.com or 1-800-XXX-XXXX.

NOTICE: The federal Equal Credit Opportunity Act prohibits creditors from 
discriminating against credit applicants on the basis of race, color, 
religion, national origin, sex, marital status, age, because all or part 
of the applicant's income derives from any public assistance program, or 
because the applicant has in good faith exercised any right under the 
Consumer Credit Protection Act.

Skillancer Financial Services
`;

    return content.trim();
  }

  // --------------------------------------------------------------------------
  // STATE LICENSING
  // --------------------------------------------------------------------------

  /**
   * Get licensing status by state
   */
  async getStateLicenses(): Promise<StateLicense[]> {
    // In production: Fetch from database
    logger.info('Getting state licenses');
    return [];
  }

  /**
   * Check if license is valid for state
   */
  async validateStateLicense(state: string): Promise<boolean> {
    const licenses = await this.getStateLicenses();
    const license = licenses.find((l) => l.state === state.toUpperCase());

    if (!license) {
      // Check if state requires a license
      // Some states don't require lending licenses
      return LICENSED_STATES.has(state.toUpperCase());
    }

    return license.status === 'active' && license.expirationDate > new Date();
  }

  // --------------------------------------------------------------------------
  // AUDIT LOGGING
  // --------------------------------------------------------------------------

  /**
   * Log compliance event for audit trail
   */
  async logComplianceEvent(event: {
    type: string;
    userId: string;
    details: Record<string, any>;
  }): Promise<void> {
    logger.info('Compliance event', event);

    // In production: Write to audit log
    // await auditClient.log({
    //   category: 'LENDING_COMPLIANCE',
    //   action: event.type,
    //   userId: event.userId,
    //   metadata: event.details,
    // });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let service: LendingComplianceService | null = null;

export function getLendingComplianceService(): LendingComplianceService {
  if (!service) {
    service = new LendingComplianceService();
  }
  return service;
}

