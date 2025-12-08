/**
 * @skillancer/types - Billing: Invoice Types
 * Invoice and billing document schemas
 */

import { z } from 'zod';

import {
  uuidSchema,
  dateSchema,
  currencyCodeSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Invoice Enums
// =============================================================================

/**
 * Invoice status
 */
export const invoiceStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'SENT',
  'VIEWED',
  'PAID',
  'PARTIALLY_PAID',
  'OVERDUE',
  'CANCELLED',
  'VOID',
  'DISPUTED',
  'WRITE_OFF',
]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

/**
 * Invoice type
 */
export const invoiceTypeSchema = z.enum([
  'STANDARD',
  'RECURRING',
  'PROFORMA',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
]);
export type InvoiceType = z.infer<typeof invoiceTypeSchema>;

/**
 * Line item type
 */
export const lineItemTypeSchema = z.enum([
  'SERVICE',
  'PRODUCT',
  'HOURS',
  'MILESTONE',
  'EXPENSE',
  'DISCOUNT',
  'TAX',
  'OTHER',
]);
export type LineItemType = z.infer<typeof lineItemTypeSchema>;

// =============================================================================
// Invoice Sub-schemas
// =============================================================================

/**
 * Invoice line item
 */
export const invoiceLineItemSchema = z.object({
  id: uuidSchema,
  
  // Item details
  type: lineItemTypeSchema,
  description: z.string().max(500),
  notes: z.string().max(1000).optional(),
  
  // Quantity and price
  quantity: z.number().positive().default(1),
  unitPrice: z.number(), // Can be negative for discounts
  unit: z.string().max(50).optional(), // e.g., "hours", "items"
  
  // Amounts
  subtotal: z.number(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  taxAmount: z.number().nonnegative().optional(),
  total: z.number(),
  
  // Related entity
  contractId: uuidSchema.optional(),
  milestoneId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(),
  
  // Date range (for time-based items)
  periodStart: dateSchema.optional(),
  periodEnd: dateSchema.optional(),
  
  // Display order
  order: z.number().int().nonnegative().default(0),
});
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

/**
 * Invoice payment record
 */
export const invoicePaymentSchema = z.object({
  id: uuidSchema,
  paymentId: uuidSchema,
  amount: z.number().positive(),
  paidAt: dateSchema,
  paymentMethod: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type InvoicePayment = z.infer<typeof invoicePaymentSchema>;

/**
 * Invoice address
 */
export const invoiceAddressSchema = z.object({
  name: z.string().max(200),
  companyName: z.string().max(200).optional(),
  street1: z.string().max(200),
  street2: z.string().max(200).optional(),
  city: z.string().max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2),
  taxId: z.string().max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
});
export type InvoiceAddress = z.infer<typeof invoiceAddressSchema>;

// =============================================================================
// Main Invoice Schema
// =============================================================================

/**
 * Complete invoice schema
 */
export const invoiceSchema = z.object({
  id: uuidSchema,
  invoiceNumber: z.string(), // Human-readable invoice number
  
  // Type and status
  type: invoiceTypeSchema.default('STANDARD'),
  status: invoiceStatusSchema,
  
  // Parties
  senderUserId: uuidSchema,
  senderTenantId: uuidSchema.optional(),
  recipientUserId: uuidSchema.optional(),
  recipientClientId: uuidSchema.optional(),
  
  // Addresses
  senderAddress: invoiceAddressSchema,
  recipientAddress: invoiceAddressSchema,
  
  // Related entities
  contractId: uuidSchema.optional(),
  subscriptionId: uuidSchema.optional(),
  
  // Line items
  lineItems: z.array(invoiceLineItemSchema),
  
  // Amounts
  subtotal: z.number(),
  discountTotal: z.number().nonnegative().default(0),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number(),
  
  // Currency
  currency: currencyCodeSchema.default('USD'),
  exchangeRate: z.number().positive().optional(), // If converted
  
  // Payment tracking
  amountPaid: z.number().nonnegative().default(0),
  amountDue: z.number().nonnegative(),
  payments: z.array(invoicePaymentSchema).optional(),
  
  // Dates
  issueDate: dateSchema,
  dueDate: dateSchema,
  paidDate: dateSchema.optional(),
  
  // Terms
  paymentTermsDays: z.number().int().nonnegative().default(30),
  paymentInstructions: z.string().max(2000).optional(),
  terms: z.string().max(5000).optional(),
  
  // Notes
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  
  // Footer
  footer: z.string().max(1000).optional(),
  
  // Reminders
  lastReminderAt: dateSchema.optional(),
  reminderCount: z.number().int().nonnegative().default(0),
  nextReminderAt: dateSchema.optional(),
  
  // PDF
  pdfUrl: z.string().url().optional(),
  pdfGeneratedAt: dateSchema.optional(),
  
  // Recurring
  isRecurring: z.boolean().default(false),
  recurringScheduleId: uuidSchema.optional(),
  
  // Credit/debit note reference
  originalInvoiceId: uuidSchema.optional(),
  
  // Viewing
  viewedAt: dateSchema.optional(),
  viewedByRecipient: z.boolean().default(false),
  
  // External
  externalId: z.string().optional(),
  externalProvider: z.string().optional(),
  
  ...timestampsSchema.shape,
});
export type Invoice = z.infer<typeof invoiceSchema>;

// =============================================================================
// Invoice CRUD Schemas
// =============================================================================

/**
 * Create invoice input
 */
export const createInvoiceSchema = z.object({
  type: invoiceTypeSchema.default('STANDARD'),
  recipientUserId: uuidSchema.optional(),
  recipientClientId: uuidSchema.optional(),
  recipientAddress: invoiceAddressSchema,
  contractId: uuidSchema.optional(),
  lineItems: z.array(invoiceLineItemSchema.omit({ id: true })),
  currency: currencyCodeSchema.default('USD'),
  issueDate: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  paymentTermsDays: z.number().int().nonnegative().default(30),
  paymentInstructions: z.string().max(2000).optional(),
  terms: z.string().max(5000).optional(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(1000).optional(),
  sendImmediately: z.boolean().default(false),
});
export type CreateInvoice = z.infer<typeof createInvoiceSchema>;

/**
 * Update invoice input
 */
export const updateInvoiceSchema = createInvoiceSchema.partial().omit({
  sendImmediately: true,
});
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;

/**
 * Record payment input
 */
export const recordInvoicePaymentSchema = z.object({
  invoiceId: uuidSchema,
  amount: z.number().positive(),
  paidAt: dateSchema.optional(),
  paymentMethod: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  paymentId: uuidSchema.optional(), // Link to existing payment
});
export type RecordInvoicePayment = z.infer<typeof recordInvoicePaymentSchema>;

/**
 * Send invoice input
 */
export const sendInvoiceSchema = z.object({
  invoiceId: uuidSchema,
  recipientEmails: z.array(z.string().email()).optional(),
  ccEmails: z.array(z.string().email()).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  attachPdf: z.boolean().default(true),
});
export type SendInvoice = z.infer<typeof sendInvoiceSchema>;

/**
 * Invoice filter parameters
 */
export const invoiceFilterSchema = z.object({
  senderUserId: uuidSchema.optional(),
  recipientUserId: uuidSchema.optional(),
  recipientClientId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  type: z.array(invoiceTypeSchema).optional(),
  status: z.array(invoiceStatusSchema).optional(),
  issueDateFrom: dateSchema.optional(),
  issueDateTo: dateSchema.optional(),
  dueDateFrom: dateSchema.optional(),
  dueDateTo: dateSchema.optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  isOverdue: z.boolean().optional(),
  search: z.string().optional(),
});
export type InvoiceFilter = z.infer<typeof invoiceFilterSchema>;

// =============================================================================
// Recurring Invoice Schema
// =============================================================================

/**
 * Recurring invoice schedule
 */
export const recurringInvoiceScheduleSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  
  // Template
  templateInvoice: invoiceSchema.omit({
    id: true,
    invoiceNumber: true,
    status: true,
    issueDate: true,
    dueDate: true,
    payments: true,
    amountPaid: true,
    paidDate: true,
    createdAt: true,
    updatedAt: true,
  }),
  
  // Schedule
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  dayOfMonth: z.number().int().min(1).max(28).optional(), // For monthly
  dayOfWeek: z.number().int().min(0).max(6).optional(), // For weekly
  
  // Period
  startDate: dateSchema,
  endDate: dateSchema.optional(),
  maxOccurrences: z.number().int().positive().optional(),
  
  // Status
  isActive: z.boolean().default(true),
  occurrenceCount: z.number().int().nonnegative().default(0),
  nextInvoiceDate: dateSchema.optional(),
  lastInvoiceDate: dateSchema.optional(),
  lastInvoiceId: uuidSchema.optional(),
  
  // Auto-send
  autoSend: z.boolean().default(true),
  sendDaysBefore: z.number().int().nonnegative().default(0),
  
  ...timestampsSchema.shape,
});
export type RecurringInvoiceSchedule = z.infer<typeof recurringInvoiceScheduleSchema>;
