// Financial Services Type Definitions

export enum CardStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum CardType {
  VIRTUAL = 'VIRTUAL',
  PHYSICAL = 'PHYSICAL',
}

export enum TransactionType {
  PURCHASE = 'PURCHASE',
  REFUND = 'REFUND',
  CASHBACK = 'CASHBACK',
  FEE = 'FEE',
  TRANSFER = 'TRANSFER',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum FinancingStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  FUNDED = 'FUNDED',
  PARTIALLY_REPAID = 'PARTIALLY_REPAID',
  REPAID = 'REPAID',
  DEFAULTED = 'DEFAULTED',
  REJECTED = 'REJECTED',
}

export enum TaxVaultWithdrawalReason {
  TAX_PAYMENT = 'TAX_PAYMENT',
  QUARTERLY_ESTIMATE = 'QUARTERLY_ESTIMATE',
  ANNUAL_FILING = 'ANNUAL_FILING',
  STATE_TAX = 'STATE_TAX',
  OTHER = 'OTHER',
}

// Card Interfaces
export interface SkillancerCardCreateInput {
  userId: string;
  cardType: CardType;
  nickname?: string;
  spendingLimit?: number;
  allowedCategories?: string[];
}

export interface SkillancerCardUpdateInput {
  nickname?: string;
  spendingLimit?: number;
  allowedCategories?: string[];
  status?: CardStatus;
}

export interface CardTransactionInput {
  cardId: string;
  amount: number;
  currency: string;
  merchantName: string;
  merchantCategory: string;
  description?: string;
  transactionType: TransactionType;
  metadata?: Record<string, unknown>;
}

// Invoice Financing Interfaces
export interface InvoiceFinancingCreateInput {
  userId: string;
  invoiceId: string;
  invoiceAmount: number;
  currency: string;
  clientName: string;
  invoiceDueDate: Date;
  requestedAmount?: number;
  supportingDocuments?: string[];
}

export interface InvoiceFinancingUpdateInput {
  status?: FinancingStatus;
  approvedAmount?: number;
  feePercentage?: number;
  fundedAt?: Date;
  repaidAt?: Date;
  notes?: string;
}

// Tax Vault Interfaces
export interface TaxVaultCreateInput {
  userId: string;
  targetPercentage?: number;
  autosaveEnabled?: boolean;
}

export interface TaxVaultUpdateInput {
  targetPercentage?: number;
  autosaveEnabled?: boolean;
}

export interface TaxVaultDepositInput {
  taxVaultId: string;
  amount: number;
  source: string;
  sourceTransactionId?: string;
  notes?: string;
}

export interface TaxVaultWithdrawalInput {
  taxVaultId: string;
  amount: number;
  reason: TaxVaultWithdrawalReason;
  taxYear?: number;
  taxQuarter?: number;
  recipientAccountId?: string;
  notes?: string;
}

// Response Types
export interface CardBalance {
  available: number;
  pending: number;
  currency: string;
}

export interface TaxVaultSummary {
  currentBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  targetPercentage: number;
  yearToDateEarnings: number;
  suggestedSavings: number;
  nextQuarterlyDue: Date | null;
}

export interface FinancingEligibility {
  eligible: boolean;
  maxAmount: number;
  estimatedFeePercentage: number;
  reasons?: string[];
}

export interface TransactionSummary {
  totalSpent: number;
  totalCashback: number;
  transactionCount: number;
  topCategories: { category: string; amount: number }[];
  period: { start: Date; end: Date };
}
