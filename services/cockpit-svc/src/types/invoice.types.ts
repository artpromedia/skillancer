/**
 * @module @skillancer/cockpit-svc/types/invoice
 * Type definitions for Professional Invoicing System
 */

// Import from @prisma/client directly until @skillancer/database exports are fixed
import type {
  InvoiceStatus,
  LineItemType,
  DiscountType,
  LateFeeType,
  InvoicePaymentMethod,
  InvoicePaymentStatus,
  TemplateLayout,
  InvoiceActivityType,
  RecurrenceFrequency,
  Invoice,
  InvoiceLineItem,
  InvoicePayment,
  InvoiceTemplate,
  RecurringInvoice,
  InvoiceActivity,
  InvoiceSettings,
  Client,
} from './prisma-shim.js';

// ============================================================================
// INVOICE CRUD PARAMS
// ============================================================================

export interface CreateInvoiceParams {
  freelancerUserId: string;
  clientId: string;
  projectId?: string;
  issueDate?: Date;
  dueDate?: Date;
  currency?: string;
  title?: string;
  summary?: string;
  notes?: string;
  terms?: string;
  templateId?: string;
  lineItems: CreateLineItemParams[];
  discountType?: DiscountType;
  discountValue?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
  lateFeeEnabled?: boolean;
  lateFeeType?: LateFeeType;
  lateFeeValue?: number;
  paymentInstructions?: string;
  acceptedPaymentMethods?: string[];
}

export interface CreateLineItemParams {
  itemType?: LineItemType;
  description: string;
  quantity: number;
  unitType?: string;
  unitPrice: number;
  isTaxable?: boolean;
  timeEntryIds?: string[];
  milestoneId?: string;
  projectId?: string;
  taskId?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface UpdateInvoiceParams {
  title?: string;
  summary?: string;
  notes?: string;
  terms?: string;
  templateId?: string;
  lineItems?: CreateLineItemParams[];
  discountType?: DiscountType;
  discountValue?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
  lateFeeEnabled?: boolean;
  lateFeeType?: LateFeeType;
  lateFeeValue?: number;
  paymentInstructions?: string;
  acceptedPaymentMethods?: string[];
}

export interface InvoiceFilters {
  freelancerUserId: string;
  clientId?: string;
  projectId?: string;
  status?: InvoiceStatus[];
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  isOverdue?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'issueDate' | 'dueDate' | 'total' | 'status' | 'invoiceNumber';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// TIME-BASED INVOICE
// ============================================================================

export interface CreateInvoiceFromTimeParams {
  freelancerUserId: string;
  clientId: string;
  projectId?: string;
  timeEntryIds: string[];
  groupBy?: 'none' | 'date' | 'task' | 'project';
  hourlyRate?: number;
}

export interface CreateInvoiceFromMilestoneParams {
  freelancerUserId: string;
  milestoneId: string;
}

// ============================================================================
// PAYMENT
// ============================================================================

export interface RecordPaymentParams {
  invoiceId: string;
  freelancerUserId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: InvoicePaymentMethod;
  transactionId?: string;
  notes?: string;
}

export interface ProcessOnlinePaymentParams {
  paymentMethod: 'stripe' | 'paypal';
  amount?: number;
}

export interface OnlinePaymentResult {
  clientSecret?: string;
  approvalUrl?: string;
}

// ============================================================================
// RECURRING INVOICE
// ============================================================================

export interface CreateRecurringInvoiceParams {
  freelancerUserId: string;
  clientId: string;
  name: string;
  lineItems: CreateLineItemParams[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  currency?: string;
  frequency: RecurrenceFrequency;
  interval?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: Date;
  endDate?: Date;
  maxInvoices?: number;
  dueDays?: number;
  autoSend?: boolean;
  templateId?: string;
  projectId?: string;
}

export interface UpdateRecurringInvoiceParams {
  name?: string;
  lineItems?: CreateLineItemParams[];
  frequency?: RecurrenceFrequency;
  interval?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  endDate?: Date;
  maxInvoices?: number;
  dueDays?: number;
  autoSend?: boolean;
  templateId?: string;
  projectId?: string;
  taxRate?: number;
  isActive?: boolean;
  isPaused?: boolean;
}

// ============================================================================
// TEMPLATE
// ============================================================================

export interface CreateTemplateParams {
  freelancerUserId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  logoUrl?: string;
  accentColor?: string;
  fontFamily?: string;
  layout?: TemplateLayout;
  showLogo?: boolean;
  showPaymentQR?: boolean;
  businessName?: string;
  businessAddress?: BusinessAddress;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  taxNumber?: string;
  defaultNotes?: string;
  defaultTerms?: string;
  defaultFooter?: string;
  paymentInstructions?: string;
  defaultDueDays?: number;
  defaultTaxRate?: number;
  defaultTaxLabel?: string;
  defaultCurrency?: string;
  defaultLateFee?: LateFeeConfig;
  acceptedPaymentMethods?: string[];
  stripeEnabled?: boolean;
  paypalEnabled?: boolean;
  customCss?: string;
}

export interface UpdateTemplateParams extends Partial<
  Omit<CreateTemplateParams, 'freelancerUserId'>
> {}

export interface BusinessAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface LateFeeConfig {
  type: LateFeeType;
  value: number;
}

// ============================================================================
// SETTINGS
// ============================================================================

export interface UpdateInvoiceSettingsParams {
  invoicePrefix?: string;
  numberPadding?: number;
  numberFormat?: string;
  defaultDueDays?: number;
  defaultCurrency?: string;
  defaultTemplateId?: string;
  defaultTaxEnabled?: boolean;
  defaultTaxRate?: number;
  defaultTaxLabel?: string;
  taxNumber?: string;
  defaultLateFeeEnabled?: boolean;
  defaultLateFeeType?: LateFeeType;
  defaultLateFeeValue?: number;
  lateFeeGraceDays?: number;
  autoReminders?: boolean;
  reminderDays?: number[];
  stripeAccountId?: string;
  paypalEmail?: string;
  bankDetails?: BankDetails;
}

export interface BankDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  additionalInfo?: string;
}

// ============================================================================
// SEND & REMINDER
// ============================================================================

export interface SendInvoiceOptions {
  to?: string[];
  cc?: string[];
  message?: string;
  attachPdf?: boolean;
}

export interface ReminderParams {
  invoiceId: string;
  isOverdue: boolean;
  daysUntilDue: number;
  daysOverdue: number;
}

// ============================================================================
// ACTIVITY
// ============================================================================

export interface LogActivityParams {
  invoiceId: string;
  activityType: InvoiceActivityType;
  description: string;
  actorType: 'freelancer' | 'client' | 'system';
  actorId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// PUBLIC VIEW
// ============================================================================

export interface PublicInvoiceView {
  invoice: {
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date;
    status: InvoiceStatus;
    currency: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    taxLabel?: string | null;
    total: number;
    amountPaid: number;
    amountDue: number;
    lateFeeAmount: number;
    title?: string | null;
    summary?: string | null;
    notes?: string | null;
    terms?: string | null;
    paymentInstructions?: string | null;
    pdfUrl?: string | null;
  };
  lineItems: PublicLineItem[];
  payments: PublicPayment[];
  business: {
    name: string;
    address?: BusinessAddress | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    logoUrl?: string | null;
  };
  client: {
    name: string;
    email?: string | null;
    address?: BusinessAddress | null;
  };
  branding: {
    accentColor: string;
    logoUrl?: string | null;
  };
  paymentOptions: PaymentOption[];
}

export interface PublicLineItem {
  description: string;
  quantity: number;
  unitType?: string | null;
  unitPrice: number;
  amount: number;
}

export interface PublicPayment {
  amount: number;
  date: Date;
  method: InvoicePaymentMethod;
}

export interface PaymentOption {
  method: string;
  label: string;
  instructions?: string | null;
  enabled?: boolean;
}

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export interface InvoiceDashboard {
  summary: InvoiceSummaryMetrics;
  recentInvoices: DashboardInvoice[];
  overdueInvoices: OverdueInvoice[];
  monthlyTrend: MonthlyTrendItem[];
}

export interface InvoiceSummaryMetrics {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  pendingCount: number;
  totalPaidThisMonth: number;
  totalPaidThisYear: number;
  avgDaysToPayment: number;
}

export interface DashboardInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  amountDue: number;
  status: InvoiceStatus;
  dueDate: Date;
  isOverdue: boolean;
}

export interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amountDue: number;
  dueDate: Date;
  daysOverdue: number;
}

export interface MonthlyTrendItem {
  month: string;
  invoiced: number;
  collected: number;
}

export interface InvoiceSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  byStatus: Record<InvoiceStatus, { count: number; amount: number }>;
}

// ============================================================================
// INVOICE WITH DETAILS
// ============================================================================

export interface InvoiceWithDetails extends Invoice {
  client?: Client | null;
  lineItems?: InvoiceLineItem[];
  payments?: InvoicePayment[];
  template?: InvoiceTemplate | null;
  activities?: InvoiceActivity[];
}

export interface RecurringInvoiceWithDetails extends Omit<RecurringInvoice, 'invoiceCount'> {
  client?: Client | null;
  template?: InvoiceTemplate | null;
  invoiceCount?: number;
}

// ============================================================================
// PDF GENERATION
// ============================================================================

export interface PdfGenerationParams {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
  template: InvoiceTemplate | null;
  client: Client | null;
}

// ============================================================================
// EMAIL
// ============================================================================

export interface InvoiceEmailParams {
  to: string[];
  cc?: string[];
  invoice: Invoice;
  template: InvoiceTemplate | null;
  customMessage?: string;
  attachPdf: boolean;
  viewUrl: string;
  payUrl: string;
}

export interface ReminderEmailParams {
  to: string[];
  invoice: Invoice;
  template: InvoiceTemplate | null;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number;
  viewUrl: string;
  payUrl: string;
}

// ============================================================================
// STRIPE
// ============================================================================

export interface StripePaymentIntentParams {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  stripeAccountId: string;
}

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  status: string;
}

// ============================================================================
// PAYPAL
// ============================================================================

export interface PayPalOrderParams {
  amount: number;
  currency: string;
  description: string;
  invoiceId: string;
  payeeEmail: string;
}

export interface PayPalOrder {
  id: string;
  approvalUrl: string;
  status: string;
}

// ============================================================================
// WORKER TYPES
// ============================================================================

export interface RecurringInvoiceJob {
  recurringInvoiceId: string;
}

export interface InvoiceReminderJob {
  invoiceId: string;
}

export interface LateFeeJob {
  invoiceId: string;
}

export interface ProcessRecurringResult {
  created: number;
  errors: string[];
}

export interface ApplyLateFeesResult {
  applied: number;
  errors: string[];
}
