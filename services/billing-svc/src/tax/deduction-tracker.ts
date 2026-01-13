// @ts-nocheck
/**
 * Deduction Tracker Service
 * Expense categorization, mileage tracking, and deduction management
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'deduction-tracker' });

// ============================================================================
// TYPES
// ============================================================================

export interface Deduction {
  id: string;
  userId: string;
  category: DeductionCategory;
  amount: number;
  description: string;
  date: Date;
  source: 'manual' | 'card_transaction' | 'receipt' | 'import';
  sourceId?: string;
  receiptUrl?: string;
  receiptData?: ReceiptData;
  taxYear: number;
  isDeductible: boolean;
  deductiblePercent: number; // e.g., 50 for meals
  createdAt: Date;
  updatedAt: Date;
}

export type DeductionCategory =
  | 'software_tools'
  | 'hardware_equipment'
  | 'office_supplies'
  | 'professional_development'
  | 'travel'
  | 'meals'
  | 'health_insurance'
  | 'home_office'
  | 'phone_internet'
  | 'marketing'
  | 'professional_services'
  | 'bank_fees'
  | 'dues_subscriptions'
  | 'other';

export interface ReceiptData {
  merchantName?: string;
  date?: Date;
  total?: number;
  items?: { name: string; amount: number }[];
  taxAmount?: number;
}

export interface MileageEntry {
  id: string;
  userId: string;
  date: Date;
  purpose: string;
  startLocation?: string;
  endLocation?: string;
  miles: number;
  rate: number;
  deduction: number;
  taxYear: number;
  createdAt: Date;
}

export interface CategorySummary {
  category: DeductionCategory;
  label: string;
  total: number;
  count: number;
  deductiblePercent: number;
  deductibleAmount: number;
  ytdChange?: number;
}

export interface DeductionSummary {
  taxYear: number;
  totalExpenses: number;
  totalDeductible: number;
  byCategory: CategorySummary[];
  mileageTotal: number;
  mileageDeduction: number;
  homeOfficeDeduction: number;
  estimatedTaxSavings: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_CONFIG: Record<
  DeductionCategory,
  {
    label: string;
    deductiblePercent: number;
    description: string;
  }
> = {
  software_tools: {
    label: 'Software & Tools',
    deductiblePercent: 100,
    description: 'Software subscriptions, SaaS tools',
  },
  hardware_equipment: {
    label: 'Hardware & Equipment',
    deductiblePercent: 100,
    description: 'Computers, monitors, equipment',
  },
  office_supplies: {
    label: 'Office Supplies',
    deductiblePercent: 100,
    description: 'Pens, paper, desk accessories',
  },
  professional_development: {
    label: 'Professional Development',
    deductiblePercent: 100,
    description: 'Courses, books, conferences',
  },
  travel: {
    label: 'Travel',
    deductiblePercent: 100,
    description: 'Flights, hotels, transportation',
  },
  meals: { label: 'Meals', deductiblePercent: 50, description: 'Business meals (50% deductible)' },
  health_insurance: {
    label: 'Health Insurance',
    deductiblePercent: 100,
    description: 'Self-employed health insurance',
  },
  home_office: {
    label: 'Home Office',
    deductiblePercent: 100,
    description: 'Home office expenses',
  },
  phone_internet: {
    label: 'Phone & Internet',
    deductiblePercent: 100,
    description: 'Business portion of phone/internet',
  },
  marketing: {
    label: 'Marketing',
    deductiblePercent: 100,
    description: 'Advertising, marketing expenses',
  },
  professional_services: {
    label: 'Professional Services',
    deductiblePercent: 100,
    description: 'Accounting, legal fees',
  },
  bank_fees: { label: 'Bank Fees', deductiblePercent: 100, description: 'Business banking fees' },
  dues_subscriptions: {
    label: 'Dues & Subscriptions',
    deductiblePercent: 100,
    description: 'Professional memberships',
  },
  other: { label: 'Other', deductiblePercent: 100, description: 'Other business expenses' },
};

// 2024 IRS mileage rate
const MILEAGE_RATE_2024 = 0.67;
const MILEAGE_RATE_2023 = 0.655;

// Simplified home office deduction
const HOME_OFFICE_RATE_PER_SQFT = 5;
const HOME_OFFICE_MAX_SQFT = 300;

// ============================================================================
// DEDUCTION TRACKER SERVICE
// ============================================================================

class DeductionTrackerService {
  // --------------------------------------------------------------------------
  // DEDUCTION MANAGEMENT
  // --------------------------------------------------------------------------

  async addDeduction(params: {
    userId: string;
    category: DeductionCategory;
    amount: number;
    description: string;
    date: Date;
    receiptUrl?: string;
  }): Promise<Deduction> {
    logger.info('Adding deduction', { userId: params.userId, category: params.category });

    const config = CATEGORY_CONFIG[params.category];
    const taxYear = params.date.getFullYear();

    const deduction: Deduction = {
      id: `DED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: params.userId,
      category: params.category,
      amount: params.amount,
      description: params.description,
      date: params.date,
      source: 'manual',
      receiptUrl: params.receiptUrl,
      taxYear,
      isDeductible: true,
      deductiblePercent: config.deductiblePercent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveDeduction(deduction);

    metrics.increment('deduction.added', { category: params.category });
    metrics.histogram('deduction.amount', params.amount);

    return deduction;
  }

  async updateDeduction(
    deductionId: string,
    updates: Partial<Omit<Deduction, 'id' | 'userId' | 'createdAt'>>
  ): Promise<Deduction> {
    const deduction = await this.getDeduction(deductionId);
    if (!deduction) throw new Error('Deduction not found');

    const updated = {
      ...deduction,
      ...updates,
      updatedAt: new Date(),
    };

    await this.saveDeduction(updated);

    return updated;
  }

  async deleteDeduction(deductionId: string): Promise<void> {
    logger.info('Deleting deduction', { deductionId });
    // In production, soft delete or hard delete from database
    metrics.increment('deduction.deleted');
  }

  async getDeduction(deductionId: string): Promise<Deduction | null> {
    // In production, query database
    return null;
  }

  async getDeductions(
    userId: string,
    options: {
      taxYear?: number;
      category?: DeductionCategory;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ deductions: Deduction[]; total: number }> {
    // In production, query database with filters
    return { deductions: [], total: 0 };
  }

  // --------------------------------------------------------------------------
  // AUTO-CATEGORIZATION
  // --------------------------------------------------------------------------

  async categorizeFromCardTransaction(params: {
    userId: string;
    transactionId: string;
    merchantName: string;
    merchantCategory: string;
    amount: number;
    date: Date;
  }): Promise<Deduction | null> {
    logger.info('Categorizing card transaction', {
      userId: params.userId,
      merchant: params.merchantName,
    });

    const category = this.mapMerchantToCategory(params.merchantCategory, params.merchantName);
    if (!category) {
      return null; // Not a deductible expense
    }

    const deduction = await this.addDeduction({
      userId: params.userId,
      category,
      amount: params.amount,
      description: params.merchantName,
      date: params.date,
    });

    deduction.source = 'card_transaction';
    deduction.sourceId = params.transactionId;
    await this.saveDeduction(deduction);

    return deduction;
  }

  private mapMerchantToCategory(mcc: string, merchantName: string): DeductionCategory | null {
    // MCC-based mapping
    const mccMap: Record<string, DeductionCategory> = {
      '5734': 'software_tools', // Computer software stores
      '5045': 'hardware_equipment', // Computers
      '5943': 'office_supplies', // Office supplies
      '8299': 'professional_development', // Schools/educational services
      '4511': 'travel', // Airlines
      '7011': 'travel', // Hotels
      '5812': 'meals', // Restaurants
      '5814': 'meals', // Fast food
      '8111': 'professional_services', // Legal services
      '8931': 'professional_services', // Accounting services
    };

    if (mccMap[mcc]) {
      return mccMap[mcc];
    }

    // Name-based mapping for common services
    const nameLower = merchantName.toLowerCase();
    if (
      nameLower.includes('github') ||
      nameLower.includes('aws') ||
      nameLower.includes('google cloud')
    ) {
      return 'software_tools';
    }
    if (
      nameLower.includes('udemy') ||
      nameLower.includes('coursera') ||
      nameLower.includes('linkedin learning')
    ) {
      return 'professional_development';
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // RECEIPT PROCESSING
  // --------------------------------------------------------------------------

  async processReceipt(
    userId: string,
    receiptImage: { url: string; mimeType: string }
  ): Promise<{ deduction: Deduction; confidence: number }> {
    logger.info('Processing receipt', { userId });

    // In production, use OCR service (Google Vision, AWS Textract)
    const extractedData = await this.extractReceiptData(receiptImage.url);

    const category = this.suggestCategory(extractedData);

    const deduction = await this.addDeduction({
      userId,
      category,
      amount: extractedData.total || 0,
      description: extractedData.merchantName || 'Receipt expense',
      date: extractedData.date || new Date(),
      receiptUrl: receiptImage.url,
    });

    deduction.source = 'receipt';
    deduction.receiptData = extractedData;
    await this.saveDeduction(deduction);

    metrics.increment('deduction.receipt_processed');

    return { deduction, confidence: 0.85 };
  }

  private async extractReceiptData(imageUrl: string): Promise<ReceiptData> {
    // In production, call OCR API
    return {
      merchantName: 'Office Depot',
      date: new Date(),
      total: 45.99,
      items: [
        { name: 'Printer Paper', amount: 29.99 },
        { name: 'Pens', amount: 15.0 },
      ],
      taxAmount: 3.5,
    };
  }

  private suggestCategory(data: ReceiptData): DeductionCategory {
    const merchant = (data.merchantName || '').toLowerCase();

    if (merchant.includes('office') || merchant.includes('staples')) return 'office_supplies';
    if (merchant.includes('best buy') || merchant.includes('apple')) return 'hardware_equipment';
    if (merchant.includes('restaurant') || merchant.includes('cafe')) return 'meals';

    return 'other';
  }

  // --------------------------------------------------------------------------
  // MILEAGE TRACKING
  // --------------------------------------------------------------------------

  async addMileageEntry(params: {
    userId: string;
    date: Date;
    purpose: string;
    miles: number;
    startLocation?: string;
    endLocation?: string;
  }): Promise<MileageEntry> {
    logger.info('Adding mileage entry', { userId: params.userId, miles: params.miles });

    const taxYear = params.date.getFullYear();
    const rate = taxYear >= 2024 ? MILEAGE_RATE_2024 : MILEAGE_RATE_2023;

    const entry: MileageEntry = {
      id: `MILE-${Date.now()}`,
      userId: params.userId,
      date: params.date,
      purpose: params.purpose,
      startLocation: params.startLocation,
      endLocation: params.endLocation,
      miles: params.miles,
      rate,
      deduction: Math.round(params.miles * rate * 100) / 100,
      taxYear,
      createdAt: new Date(),
    };

    await this.saveMileageEntry(entry);

    metrics.increment('mileage.entry_added');
    metrics.histogram('mileage.miles', params.miles);

    return entry;
  }

  async getMileageLog(
    userId: string,
    taxYear: number
  ): Promise<{ entries: MileageEntry[]; totalMiles: number; totalDeduction: number }> {
    // In production, query database
    const entries: MileageEntry[] = [];
    const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);
    const totalDeduction = entries.reduce((sum, e) => sum + e.deduction, 0);

    return { entries, totalMiles, totalDeduction };
  }

  // --------------------------------------------------------------------------
  // HOME OFFICE
  // --------------------------------------------------------------------------

  calculateHomeOfficeDeduction(
    squareFeet: number,
    method: 'simplified' | 'actual' = 'simplified'
  ): { deduction: number; method: string } {
    if (method === 'simplified') {
      const cappedSqFt = Math.min(squareFeet, HOME_OFFICE_MAX_SQFT);
      return {
        deduction: cappedSqFt * HOME_OFFICE_RATE_PER_SQFT,
        method: 'Simplified Method ($5/sq ft)',
      };
    }

    // Actual method would require more inputs (rent, utilities, etc.)
    return { deduction: 0, method: 'Actual Method' };
  }

  // --------------------------------------------------------------------------
  // SUMMARIES
  // --------------------------------------------------------------------------

  async getDeductionSummary(userId: string, taxYear: number): Promise<DeductionSummary> {
    logger.info('Getting deduction summary', { userId, taxYear });

    const { deductions } = await this.getDeductions(userId, { taxYear });
    const mileageLog = await this.getMileageLog(userId, taxYear);

    const byCategory: CategorySummary[] = Object.entries(CATEGORY_CONFIG)
      .map(([category, config]) => {
        const categoryDeductions = deductions.filter((d) => d.category === category);
        const total = categoryDeductions.reduce((sum, d) => sum + d.amount, 0);
        const deductibleAmount = total * (config.deductiblePercent / 100);

        return {
          category: category as DeductionCategory,
          label: config.label,
          total,
          count: categoryDeductions.length,
          deductiblePercent: config.deductiblePercent,
          deductibleAmount,
        };
      })
      .filter((c) => c.total > 0);

    const totalExpenses = byCategory.reduce((sum, c) => sum + c.total, 0);
    const totalDeductible =
      byCategory.reduce((sum, c) => sum + c.deductibleAmount, 0) + mileageLog.totalDeduction;

    // Estimate tax savings (rough - assumes 30% marginal rate)
    const estimatedTaxSavings = Math.round(totalDeductible * 0.3);

    return {
      taxYear,
      totalExpenses,
      totalDeductible,
      byCategory,
      mileageTotal: mileageLog.totalMiles,
      mileageDeduction: mileageLog.totalDeduction,
      homeOfficeDeduction: 0, // Would need user's home office setup
      estimatedTaxSavings,
    };
  }

  async getCategorySuggestions(userId: string): Promise<
    {
      category: DeductionCategory;
      suggestedAmount: number;
      reason: string;
    }[]
  > {
    // Suggest common deductions the user might be missing
    return [
      {
        category: 'home_office',
        suggestedAmount: 1500,
        reason: 'Many freelancers have a home office. Track your space for a deduction.',
      },
      {
        category: 'phone_internet',
        suggestedAmount: 600,
        reason: 'Business portion of phone and internet is deductible.',
      },
      {
        category: 'professional_development',
        suggestedAmount: 500,
        reason: 'Courses and books related to your work are deductible.',
      },
    ];
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private async saveDeduction(deduction: Deduction): Promise<void> {
    // In production, save to database
  }

  private async saveMileageEntry(entry: MileageEntry): Promise<void> {
    // In production, save to database
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let deductionTracker: DeductionTrackerService | null = null;

export function getDeductionTrackerService(): DeductionTrackerService {
  if (!deductionTracker) {
    deductionTracker = new DeductionTrackerService();
  }
  return deductionTracker;
}

