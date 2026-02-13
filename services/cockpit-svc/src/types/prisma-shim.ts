/**
 * Prisma Shim for Offline Builds
 *
 * This file provides type definitions for Prisma types that may not be
 * available when building without a generated Prisma client.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { PrismaClient as _PrismaClientClass } from '@prisma/client';

// Export PrismaClient as both type and value
export const PrismaClient = _PrismaClientClass;
export type PrismaClient = InstanceType<typeof _PrismaClientClass>;

// ============================================================================
// Prisma Namespace
// ============================================================================

// Runtime value for esbuild/tsup compatibility (namespace-only exports are stripped)
export const Prisma = {} as any;
export namespace Prisma {
  export type Decimal = {
    toNumber(): number;
    toString(): string;
    valueOf(): number;
  };

  export type JsonValue = any;
  export type InputJsonValue = any;
}

// Alias for GoalStatus (used by learning-time-sync.service.ts)
export const GoalStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  PAUSED: 'PAUSED',
} as const;
// Singleton PrismaClient instance stub (used by executive-integration.service.ts)
export const prisma = new PrismaClient();

// ============================================================================
// Enums - Integration
// ============================================================================

export type IntegrationProvider =
  | 'QUICKBOOKS'
  | 'XERO'
  | 'FRESHBOOKS'
  | 'WAVE'
  | 'STRIPE'
  | 'PAYPAL'
  | 'SQUARE'
  | 'PLAID'
  | 'GOOGLE_CALENDAR'
  | 'OUTLOOK'
  | 'TRELLO'
  | 'ASANA'
  | 'JIRA'
  | 'NOTION'
  | 'CUSTOM';

export const IntegrationProvider = {
  QUICKBOOKS: 'QUICKBOOKS' as const,
  XERO: 'XERO' as const,
  FRESHBOOKS: 'FRESHBOOKS' as const,
  WAVE: 'WAVE' as const,
  STRIPE: 'STRIPE' as const,
  PAYPAL: 'PAYPAL' as const,
  SQUARE: 'SQUARE' as const,
  PLAID: 'PLAID' as const,
  GOOGLE_CALENDAR: 'GOOGLE_CALENDAR' as const,
  OUTLOOK: 'OUTLOOK' as const,
  TRELLO: 'TRELLO' as const,
  ASANA: 'ASANA' as const,
  JIRA: 'JIRA' as const,
  NOTION: 'NOTION' as const,
  CUSTOM: 'CUSTOM' as const,
};

export type IntegrationCategory =
  | 'ACCOUNTING'
  | 'PAYMENTS'
  | 'BANKING'
  | 'CALENDAR'
  | 'PROJECT_MANAGEMENT'
  | 'COMMUNICATION'
  | 'OTHER';

export const IntegrationCategory = {
  ACCOUNTING: 'ACCOUNTING' as const,
  PAYMENTS: 'PAYMENTS' as const,
  BANKING: 'BANKING' as const,
  CALENDAR: 'CALENDAR' as const,
  PROJECT_MANAGEMENT: 'PROJECT_MANAGEMENT' as const,
  COMMUNICATION: 'COMMUNICATION' as const,
  OTHER: 'OTHER' as const,
};

export type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING' | 'DISCONNECTED';
export const IntegrationStatus = {
  ACTIVE: 'ACTIVE' as const,
  INACTIVE: 'INACTIVE' as const,
  ERROR: 'ERROR' as const,
  PENDING: 'PENDING' as const,
  DISCONNECTED: 'DISCONNECTED' as const,
};

export type SyncFrequency = 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL';
export const SyncFrequency = {
  REALTIME: 'REALTIME' as const,
  HOURLY: 'HOURLY' as const,
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
  MONTHLY: 'MONTHLY' as const,
  MANUAL: 'MANUAL' as const,
};

export type IntegrationSyncDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
export const IntegrationSyncDirection = {
  INBOUND: 'INBOUND' as const,
  OUTBOUND: 'OUTBOUND' as const,
  BIDIRECTIONAL: 'BIDIRECTIONAL' as const,
};

export type IntegrationSyncType = 'FULL' | 'INCREMENTAL' | 'DELTA';
export const IntegrationSyncType = {
  FULL: 'FULL' as const,
  INCREMENTAL: 'INCREMENTAL' as const,
  DELTA: 'DELTA' as const,
};

export type IntegrationSyncStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export const IntegrationSyncStatus = {
  PENDING: 'PENDING' as const,
  RUNNING: 'RUNNING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export type MappingEntityType =
  | 'INVOICE'
  | 'CLIENT'
  | 'PROJECT'
  | 'EXPENSE'
  | 'PAYMENT'
  | 'TIME_ENTRY';
export const MappingEntityType = {
  INVOICE: 'INVOICE' as const,
  CLIENT: 'CLIENT' as const,
  PROJECT: 'PROJECT' as const,
  EXPENSE: 'EXPENSE' as const,
  PAYMENT: 'PAYMENT' as const,
  TIME_ENTRY: 'TIME_ENTRY' as const,
};

export type WebhookEventStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'SKIPPED';
export const WebhookEventStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  PROCESSED: 'PROCESSED' as const,
  FAILED: 'FAILED' as const,
  SKIPPED: 'SKIPPED' as const,
};

export type IntegrationAuthType = 'OAUTH2' | 'API_KEY' | 'BASIC' | 'CUSTOM';
export const IntegrationAuthType = {
  OAUTH2: 'OAUTH2' as const,
  API_KEY: 'API_KEY' as const,
  BASIC: 'BASIC' as const,
  CUSTOM: 'CUSTOM' as const,
};

// ============================================================================
// Enums - Invoice
// ============================================================================

export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SENT'
  | 'VIEWED'
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'VOIDED';
export const InvoiceStatus = {
  DRAFT: 'DRAFT' as const,
  PENDING: 'PENDING' as const,
  SENT: 'SENT' as const,
  VIEWED: 'VIEWED' as const,
  PARTIAL: 'PARTIAL' as const,
  PAID: 'PAID' as const,
  OVERDUE: 'OVERDUE' as const,
  CANCELLED: 'CANCELLED' as const,
  REFUNDED: 'REFUNDED' as const,
  DISPUTED: 'DISPUTED' as const,
  VOIDED: 'VOIDED' as const,
};

export type LineItemType = 'SERVICE' | 'PRODUCT' | 'EXPENSE' | 'DISCOUNT' | 'TAX';
export const LineItemType = {
  SERVICE: 'SERVICE' as const,
  PRODUCT: 'PRODUCT' as const,
  EXPENSE: 'EXPENSE' as const,
  DISCOUNT: 'DISCOUNT' as const,
  TAX: 'TAX' as const,
};

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export const DiscountType = {
  PERCENTAGE: 'PERCENTAGE' as const,
  FIXED: 'FIXED' as const,
};

export type LateFeeType = 'PERCENTAGE' | 'FIXED' | 'NONE';
export const LateFeeType = {
  PERCENTAGE: 'PERCENTAGE' as const,
  FIXED: 'FIXED' as const,
  NONE: 'NONE' as const,
};

export type InvoicePaymentMethod =
  | 'BANK_TRANSFER'
  | 'CREDIT_CARD'
  | 'PAYPAL'
  | 'STRIPE'
  | 'CHECK'
  | 'CASH'
  | 'OTHER';
export const InvoicePaymentMethod = {
  BANK_TRANSFER: 'BANK_TRANSFER' as const,
  CREDIT_CARD: 'CREDIT_CARD' as const,
  PAYPAL: 'PAYPAL' as const,
  STRIPE: 'STRIPE' as const,
  CHECK: 'CHECK' as const,
  CASH: 'CASH' as const,
  OTHER: 'OTHER' as const,
};

export type InvoicePaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export const InvoicePaymentStatus = {
  PENDING: 'PENDING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  REFUNDED: 'REFUNDED' as const,
};

export type TemplateLayout = 'CLASSIC' | 'MODERN' | 'MINIMAL' | 'PROFESSIONAL';
export const TemplateLayout = {
  CLASSIC: 'CLASSIC' as const,
  MODERN: 'MODERN' as const,
  MINIMAL: 'MINIMAL' as const,
  PROFESSIONAL: 'PROFESSIONAL' as const,
};

export type InvoiceActivityType =
  | 'CREATED'
  | 'UPDATED'
  | 'SENT'
  | 'VIEWED'
  | 'PAID'
  | 'PARTIAL_PAYMENT'
  | 'REMINDER_SENT'
  | 'OVERDUE'
  | 'CANCELLED';
export const InvoiceActivityType = {
  CREATED: 'CREATED' as const,
  UPDATED: 'UPDATED' as const,
  SENT: 'SENT' as const,
  VIEWED: 'VIEWED' as const,
  PAID: 'PAID' as const,
  PARTIAL_PAYMENT: 'PARTIAL_PAYMENT' as const,
  REMINDER_SENT: 'REMINDER_SENT' as const,
  OVERDUE: 'OVERDUE' as const,
  CANCELLED: 'CANCELLED' as const,
};

export type RecurrenceFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';
export const RecurrenceFrequency = {
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
  BIWEEKLY: 'BIWEEKLY' as const,
  MONTHLY: 'MONTHLY' as const,
  QUARTERLY: 'QUARTERLY' as const,
  YEARLY: 'YEARLY' as const,
};

// ============================================================================
// Enums - Financial
// ============================================================================

export type FinancialAccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'CREDIT'
  | 'CREDIT_CARD'
  | 'INVESTMENT'
  | 'CASH'
  | 'PAYPAL'
  | 'OTHER';
export const FinancialAccountType = {
  CHECKING: 'CHECKING' as const,
  SAVINGS: 'SAVINGS' as const,
  CREDIT: 'CREDIT' as const,
  CREDIT_CARD: 'CREDIT_CARD' as const,
  INVESTMENT: 'INVESTMENT' as const,
  CASH: 'CASH' as const,
  PAYPAL: 'PAYPAL' as const,
  OTHER: 'OTHER' as const,
};

export type FinancialGoalType =
  | 'SAVINGS'
  | 'DEBT_PAYOFF'
  | 'INVESTMENT'
  | 'REVENUE'
  | 'EXPENSE_REDUCTION';
export const FinancialGoalType = {
  SAVINGS: 'SAVINGS' as const,
  DEBT_PAYOFF: 'DEBT_PAYOFF' as const,
  INVESTMENT: 'INVESTMENT' as const,
  REVENUE: 'REVENUE' as const,
  EXPENSE_REDUCTION: 'EXPENSE_REDUCTION' as const,
};

export type FinancialGoalStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PAUSED';
export const FinancialGoalStatus = {
  ACTIVE: 'ACTIVE' as const,
  COMPLETED: 'COMPLETED' as const,
  CANCELLED: 'CANCELLED' as const,
  PAUSED: 'PAUSED' as const,
};

export type FinancialTransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export const FinancialTransactionType = {
  INCOME: 'INCOME' as const,
  EXPENSE: 'EXPENSE' as const,
  TRANSFER: 'TRANSFER' as const,
};

export type MileagePurpose = 'BUSINESS' | 'PERSONAL' | 'MEDICAL' | 'CHARITY';
export const MileagePurpose = {
  BUSINESS: 'BUSINESS' as const,
  PERSONAL: 'PERSONAL' as const,
  MEDICAL: 'MEDICAL' as const,
  CHARITY: 'CHARITY' as const,
};

// ============================================================================
// Model Interfaces
// ============================================================================

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  status: IntegrationStatus;
  name: string;
  credentials: any;
  settings: any;
  syncFrequency: SyncFrequency;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface IntegrationMapping {
  id: string;
  integrationId: string;
  entityType: MappingEntityType;
  localId: string;
  externalId: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  syncType: IntegrationSyncType;
  status: IntegrationSyncStatus;
  direction: IntegrationSyncDirection;
  recordsProcessed: number;
  recordsFailed: number;
  errorDetails: any;
  startedAt: Date;
  completedAt: Date | null;
  [key: string]: any;
}

export interface IntegrationTemplate {
  id: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  name: string;
  description: string;
  authType: IntegrationAuthType;
  config: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface WebhookEvent {
  id: string;
  integrationId: string;
  provider: IntegrationProvider;
  eventType: string;
  payload: any;
  status: WebhookEventStatus;
  processedAt: Date | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  [key: string]: any;
}

export interface Invoice {
  id: string;
  userId: string;
  clientId: string;
  number: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotal: any;
  taxAmount: any;
  discountAmount: any;
  total: any;
  paidAmount: any;
  currency: string;
  notes: string | null;
  terms: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  type: LineItemType;
  description: string;
  quantity: any;
  unitPrice: any;
  amount: any;
  taxRate: any;
  order: number;
  createdAt: Date;
  [key: string]: any;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: any;
  method: InvoicePaymentMethod;
  status: InvoicePaymentStatus;
  transactionId: string | null;
  paidAt: Date;
  notes: string | null;
  createdAt: Date;
  [key: string]: any;
}

export interface InvoiceTemplate {
  id: string;
  userId: string;
  name: string;
  layout: TemplateLayout;
  primaryColor: string;
  logoUrl: string | null;
  headerText: string | null;
  footerText: string | null;
  terms: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface RecurringInvoice {
  id: string;
  userId: string;
  clientId: string;
  templateId: string | null;
  frequency: RecurrenceFrequency;
  nextDate: Date;
  endDate: Date | null;
  isActive: boolean;
  lineItems: any;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface InvoiceActivity {
  id: string;
  invoiceId: string;
  type: InvoiceActivityType;
  description: string;
  metadata: any;
  createdAt: Date;
  [key: string]: any;
}

export interface InvoiceSettings {
  id: string;
  userId: string;
  defaultCurrency: string;
  defaultPaymentTerms: number;
  defaultNotes: string | null;
  defaultTerms: string | null;
  lateFeeEnabled: boolean;
  lateFeeType: LateFeeType;
  lateFeeAmount: any;
  reminderEnabled: boolean;
  reminderDays: number[];
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  address: any;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  type: FinancialAccountType;
  balance: any;
  currency: string;
  institution: string | null;
  accountNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  type: FinancialGoalType;
  targetAmount: any;
  currentAmount: any;
  targetDate: Date;
  status: FinancialGoalStatus;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface FinancialTransaction {
  id: string;
  userId: string;
  accountId: string;
  type: FinancialTransactionType;
  categoryId: string | null;
  amount: any;
  description: string;
  date: Date;
  isRecurring: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface TransactionCategory {
  id: string;
  userId: string;
  name: string;
  type: FinancialTransactionType;
  color: string;
  icon: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: FinancialTransactionType;
  amount: any;
  description: string;
  frequency: RecurrenceFrequency;
  nextDate: Date;
  endDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface MileageLog {
  id: string;
  userId: string;
  date: Date;
  startLocation: string;
  endLocation: string;
  distance: any;
  purpose: MileagePurpose;
  notes: string | null;
  createdAt: Date;
  [key: string]: any;
}

export interface TaxProfile {
  id: string;
  userId: string;
  filingStatus: string;
  taxBracket: any;
  estimatedRate: any;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

// ============================================================================
// User Model
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  [key: string]: any;
}

// ============================================================================
// Additional Enums
// ============================================================================

export type FinancialTransactionSource =
  | 'MANUAL'
  | 'BANK_IMPORT'
  | 'INTEGRATION'
  | 'CONTRACT'
  | 'INVOICE';
export const FinancialTransactionSource = {
  MANUAL: 'MANUAL' as const,
  BANK_IMPORT: 'BANK_IMPORT' as const,
  INTEGRATION: 'INTEGRATION' as const,
  CONTRACT: 'CONTRACT' as const,
  INVOICE: 'INVOICE' as const,
};

export type FinancialTransactionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export const FinancialTransactionStatus = {
  PENDING: 'PENDING' as const,
  COMPLETED: 'COMPLETED' as const,
  CANCELLED: 'CANCELLED' as const,
  FAILED: 'FAILED' as const,
};

export type FinancialPeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export const FinancialPeriodType = {
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
  MONTHLY: 'MONTHLY' as const,
  QUARTERLY: 'QUARTERLY' as const,
  YEARLY: 'YEARLY' as const,
};

export type BusinessType = 'SOLE_PROPRIETOR' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP' | 'OTHER';
export const BusinessType = {
  SOLE_PROPRIETOR: 'SOLE_PROPRIETOR' as const,
  LLC: 'LLC' as const,
  CORPORATION: 'CORPORATION' as const,
  PARTNERSHIP: 'PARTNERSHIP' as const,
  OTHER: 'OTHER' as const,
};

export type FilingStatus = 'SINGLE' | 'MARRIED_JOINT' | 'MARRIED_SEPARATE' | 'HEAD_OF_HOUSEHOLD';
export const FilingStatus = {
  SINGLE: 'SINGLE' as const,
  MARRIED_JOINT: 'MARRIED_JOINT' as const,
  MARRIED_SEPARATE: 'MARRIED_SEPARATE' as const,
  HEAD_OF_HOUSEHOLD: 'HEAD_OF_HOUSEHOLD' as const,
};

export type AccountingMethod = 'CASH' | 'ACCRUAL';
export const AccountingMethod = {
  CASH: 'CASH' as const,
  ACCRUAL: 'ACCRUAL' as const,
};

export type ReminderType = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
export const ReminderType = {
  EMAIL: 'EMAIL' as const,
  SMS: 'SMS' as const,
  PUSH: 'PUSH' as const,
  IN_APP: 'IN_APP' as const,
};

export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'COMPLETED' | 'SNOOZED';
export const ReminderStatus = {
  PENDING: 'PENDING' as const,
  SENT: 'SENT' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
  COMPLETED: 'COMPLETED' as const,
  SNOOZED: 'SNOOZED' as const,
};

// ============================================================================
// Additional Models
// ============================================================================

export interface CockpitProject {
  id: string;
  userId: string;
  name: string;
  clientId: string | null;
  status: string;
  budget: any;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface Reminder {
  id: string;
  userId: string;
  type: ReminderType;
  status: ReminderStatus;
  entityType: string;
  entityId: string;
  scheduledFor: Date;
  sentAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

// ============================================================================
// Stub exports for esbuild/tsup compatibility
// These types are imported as values in some files (with @ts-nocheck)
// ============================================================================

export type UnifiedTransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REFUND';
export const UnifiedTransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER',
  REFUND: 'REFUND',
} as const;

export type UnifiedSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'SKIPPED';
export const UnifiedSyncStatus = {
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export type UnifiedTransactionSource =
  | 'MARKET'
  | 'COCKPIT'
  | 'UPWORK'
  | 'QUICKBOOKS'
  | 'PLAID'
  | 'MANUAL';
export const UnifiedTransactionSource = {
  MARKET: 'MARKET',
  COCKPIT: 'COCKPIT',
  UPWORK: 'UPWORK',
  QUICKBOOKS: 'QUICKBOOKS',
  PLAID: 'PLAID',
  MANUAL: 'MANUAL',
} as const;

export type FinancialReportStatus = 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'FAILED';
export const FinancialReportStatus = {
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type FinancialReportType = 'PROFIT_LOSS' | 'CASH_FLOW' | 'TAX_SUMMARY' | 'BALANCE_SHEET';
export const FinancialReportType = {
  PROFIT_LOSS: 'PROFIT_LOSS',
  CASH_FLOW: 'CASH_FLOW',
  TAX_SUMMARY: 'TAX_SUMMARY',
  BALANCE_SHEET: 'BALANCE_SHEET',
} as const;
