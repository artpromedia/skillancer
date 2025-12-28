/**
 * @module @skillancer/analytics/events/cockpit
 * Cockpit (freelancer dashboard) event schemas
 */

import { z } from 'zod';

import { BaseEventSchema } from './base.js';

// ==================== Time Tracking Events ====================

export const TimeTrackingEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'timer_started',
    'timer_stopped',
    'timer_paused',
    'timer_resumed',
    'timer_discarded',
    'time_entry_created',
    'time_entry_updated',
    'time_entry_deleted',
    'time_entry_approved',
    'time_entry_rejected',
  ]),
  properties: z.object({
    entryId: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    clientId: z.string().optional(),
    clientName: z.string().optional(),
    contractId: z.string().optional(),
    taskId: z.string().optional(),
    taskName: z.string().optional(),
    duration: z.number().optional(), // minutes
    isBillable: z.boolean(),
    hourlyRate: z.number().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    trackingMethod: z.enum(['timer', 'manual', 'imported', 'auto']),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    date: z.coerce.date().optional(),
  }),
});

// ==================== Invoice Events ====================

export const InvoiceEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'invoice_created',
    'invoice_edited',
    'invoice_sent',
    'invoice_viewed',
    'invoice_paid',
    'invoice_partially_paid',
    'invoice_overdue',
    'invoice_cancelled',
    'invoice_reminder_sent',
    'invoice_disputed',
    'invoice_downloaded',
  ]),
  properties: z.object({
    invoiceId: z.string(),
    clientId: z.string(),
    clientName: z.string().optional(),
    invoiceNumber: z.string(),
    amount: z.number(),
    currency: z.string(),
    dueDate: z.coerce.date(),
    paidDate: z.coerce.date().optional(),
    paymentMethod: z.string().optional(),
    daysToPayment: z.number().optional(),
    daysOverdue: z.number().optional(),
    isRecurring: z.boolean().optional(),
    recurringInterval: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
    lineItemCount: z.number().optional(),
    taxAmount: z.number().optional(),
    discountAmount: z.number().optional(),
    partialPaymentAmount: z.number().optional(),
  }),
});

// ==================== Expense Events ====================

export const ExpenseEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'expense_created',
    'expense_updated',
    'expense_deleted',
    'expense_categorized',
    'receipt_uploaded',
    'receipt_scanned',
  ]),
  properties: z.object({
    expenseId: z.string(),
    category: z.string(),
    subcategory: z.string().optional(),
    amount: z.number(),
    currency: z.string(),
    date: z.coerce.date(),
    projectId: z.string().optional(),
    clientId: z.string().optional(),
    isBillable: z.boolean().optional(),
    isReimbursable: z.boolean().optional(),
    paymentMethod: z.string().optional(),
    vendor: z.string().optional(),
    hasReceipt: z.boolean().optional(),
    receiptId: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// ==================== Project Events ====================

export const ProjectEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'project_created',
    'project_updated',
    'project_archived',
    'project_completed',
    'project_task_created',
    'project_task_completed',
    'project_milestone_reached',
    'project_budget_updated',
  ]),
  properties: z.object({
    projectId: z.string(),
    projectName: z.string(),
    clientId: z.string().optional(),
    clientName: z.string().optional(),
    status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
    budget: z.number().optional(),
    budgetType: z.enum(['fixed', 'hourly', 'retainer']).optional(),
    currency: z.string().optional(),
    startDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    taskId: z.string().optional(),
    taskName: z.string().optional(),
    milestoneId: z.string().optional(),
    milestoneName: z.string().optional(),
    totalTrackedTime: z.number().optional(), // minutes
    totalBilled: z.number().optional(),
    progress: z.number().optional(), // 0-100
  }),
});

// ==================== Report Events ====================

export const ReportEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'report_generated',
    'report_exported',
    'report_scheduled',
    'report_shared',
    'dashboard_viewed',
    'widget_added',
    'widget_configured',
  ]),
  properties: z.object({
    reportId: z.string().optional(),
    reportType: z.enum([
      'income',
      'expense',
      'time',
      'project',
      'client',
      'tax',
      'profitability',
      'custom',
    ]),
    reportName: z.string().optional(),
    dateRangeStart: z.coerce.date().optional(),
    dateRangeEnd: z.coerce.date().optional(),
    exportFormat: z.enum(['pdf', 'csv', 'xlsx', 'json']).optional(),
    scheduleFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    widgetId: z.string().optional(),
    widgetType: z.string().optional(),
    dashboardId: z.string().optional(),
  }),
});

// ==================== Financial Events ====================

export const FinancialEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'payment_received',
    'payout_requested',
    'payout_completed',
    'tax_document_generated',
    'bank_account_linked',
    'payment_method_added',
    'subscription_payment',
  ]),
  properties: z.object({
    transactionId: z.string().optional(),
    amount: z.number(),
    currency: z.string(),
    paymentMethod: z.string().optional(),
    invoiceId: z.string().optional(),
    contractId: z.string().optional(),
    clientId: z.string().optional(),
    fee: z.number().optional(),
    netAmount: z.number().optional(),
    taxYear: z.number().optional(),
    documentType: z.string().optional(),
    bankAccountId: z.string().optional(),
    subscriptionPlan: z.string().optional(),
  }),
});

export type TimeTrackingEvent = z.infer<typeof TimeTrackingEventSchema>;
export type InvoiceEvent = z.infer<typeof InvoiceEventSchema>;
export type ExpenseEvent = z.infer<typeof ExpenseEventSchema>;
export type ProjectEvent = z.infer<typeof ProjectEventSchema>;
export type ReportEvent = z.infer<typeof ReportEventSchema>;
export type FinancialEvent = z.infer<typeof FinancialEventSchema>;
