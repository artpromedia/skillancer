/**
 * Invoicing Service
 *
 * Type-safe API methods for invoice operations using the shared API client.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type InvoiceStatus =
  | 'draft'
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
  total: number;
  projectId?: string;
  taskId?: string;
  timeEntryIds?: string[];
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'bank_transfer' | 'credit_card' | 'paypal' | 'stripe' | 'other';
  transactionId?: string;
  paidAt: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  notes?: string;
  terms?: string;
  footer?: string;
  attachments: string[];
  payments: InvoicePayment[];
  sentAt?: string;
  viewedAt?: string;
  remindersSent: number;
  lastReminderAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceCreate {
  clientId: string;
  projectId?: string;
  issueDate?: string;
  dueDate: string;
  currency?: string;
  lineItems: Omit<InvoiceLineItem, 'id' | 'total'>[];
  notes?: string;
  terms?: string;
  footer?: string;
  attachments?: string[];
}

export interface InvoiceUpdate {
  clientId?: string;
  projectId?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  lineItems?: Omit<InvoiceLineItem, 'id' | 'total'>[];
  notes?: string;
  terms?: string;
  footer?: string;
  attachments?: string[];
}

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  clientId?: string;
  projectId?: string;
  status?: InvoiceStatus | InvoiceStatus[];
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'invoiceNumber' | 'issueDate' | 'dueDate' | 'total' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface InvoiceSummary {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  byStatus: Record<InvoiceStatus, { count: number; amount: number }>;
  recentActivity: Array<{
    invoiceId: string;
    invoiceNumber: string;
    action: string;
    timestamp: string;
  }>;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  content: {
    notes?: string;
    terms?: string;
    footer?: string;
    defaultLineItems?: Omit<InvoiceLineItem, 'id' | 'total'>[];
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSettings {
  defaultCurrency: string;
  defaultPaymentTermsDays: number;
  defaultNotes?: string;
  defaultTerms?: string;
  defaultFooter?: string;
  invoiceNumberPrefix: string;
  invoiceNumberSuffix?: string;
  nextInvoiceNumber: number;
  taxRate?: number;
  autoSendReminders: boolean;
  reminderDays: number[];
  logoUrl?: string;
  companyInfo: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
  };
}

export interface RecordPaymentInput {
  amount: number;
  method: InvoicePayment['method'];
  transactionId?: string;
  paidAt?: string;
  notes?: string;
}

export interface CreateFromTimeEntriesInput {
  clientId: string;
  projectId?: string;
  timeEntryIds: string[];
  dueDate: string;
  notes?: string;
  groupBy?: 'entry' | 'day' | 'task' | 'project';
}

// =============================================================================
// Invoicing API Service
// =============================================================================

export const invoicingService = {
  // =============================================================================
  // Invoices CRUD
  // =============================================================================

  /**
   * List invoices with filters
   */
  async list(filters: InvoiceFilters = {}): Promise<PaginatedResponse<Invoice>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }

    return client.get<Invoice[]>('/invoices', { params }) as Promise<PaginatedResponse<Invoice>>;
  },

  /**
   * Get a single invoice
   */
  async getById(id: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.get<Invoice>(`/invoices/${id}`);
  },

  /**
   * Get invoice by number
   */
  async getByNumber(invoiceNumber: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.get<Invoice>(`/invoices/by-number/${invoiceNumber}`);
  },

  /**
   * Create an invoice
   */
  async create(data: InvoiceCreate): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice, InvoiceCreate>('/invoices', data);
  },

  /**
   * Update an invoice (only draft invoices)
   */
  async update(id: string, data: InvoiceUpdate): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.patch<Invoice, InvoiceUpdate>(`/invoices/${id}`, data);
  },

  /**
   * Delete an invoice (only draft invoices)
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/invoices/${id}`);
  },

  /**
   * Duplicate an invoice
   */
  async duplicate(id: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/duplicate`);
  },

  // =============================================================================
  // Invoice Actions
  // =============================================================================

  /**
   * Finalize and mark as pending
   */
  async finalize(id: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/finalize`);
  },

  /**
   * Send invoice to client
   */
  async send(
    id: string,
    options?: { emailSubject?: string; emailBody?: string; cc?: string[] }
  ): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/send`, options);
  },

  /**
   * Mark invoice as viewed
   */
  async markViewed(id: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/viewed`);
  },

  /**
   * Mark invoice as paid
   */
  async markPaid(id: string, paidDate?: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/mark-paid`, { paidDate });
  },

  /**
   * Cancel an invoice
   */
  async cancel(id: string, reason?: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/cancel`, { reason });
  },

  /**
   * Record a payment
   */
  async recordPayment(id: string, data: RecordPaymentInput): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice, RecordPaymentInput>(`/invoices/${id}/payments`, data);
  },

  /**
   * Delete a payment
   */
  async deletePayment(id: string, paymentId: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.delete<Invoice>(`/invoices/${id}/payments/${paymentId}`);
  },

  /**
   * Send payment reminder
   */
  async sendReminder(id: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/remind`);
  },

  /**
   * Issue a refund
   */
  async refund(id: string, amount?: number, reason?: string): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice>(`/invoices/${id}/refund`, { amount, reason });
  },

  // =============================================================================
  // PDF & Export
  // =============================================================================

  /**
   * Generate PDF
   */
  async generatePdf(id: string): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get PDF download URL
   */
  async getPdfUrl(id: string): Promise<ApiResponse<{ url: string; expiresAt: string }>> {
    const client = getApiClient();
    return client.get<{ url: string; expiresAt: string }>(`/invoices/${id}/pdf-url`);
  },

  /**
   * Export invoices
   */
  async export(filters: InvoiceFilters & { format: 'csv' | 'xlsx' | 'pdf' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/invoices/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  // =============================================================================
  // Create from Time Entries
  // =============================================================================

  /**
   * Create invoice from time entries
   */
  async createFromTimeEntries(data: CreateFromTimeEntriesInput): Promise<ApiResponse<Invoice>> {
    const client = getApiClient();
    return client.post<Invoice, CreateFromTimeEntriesInput>('/invoices/from-time-entries', data);
  },

  /**
   * Preview invoice from time entries (without creating)
   */
  async previewFromTimeEntries(
    data: CreateFromTimeEntriesInput
  ): Promise<ApiResponse<{ lineItems: InvoiceLineItem[]; subtotal: number }>> {
    const client = getApiClient();
    return client.post<{ lineItems: InvoiceLineItem[]; subtotal: number }>(
      '/invoices/from-time-entries/preview',
      data
    );
  },

  // =============================================================================
  // Summary & Reports
  // =============================================================================

  /**
   * Get invoicing summary
   */
  async getSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<InvoiceSummary>> {
    const client = getApiClient();
    return client.get<InvoiceSummary>('/invoices/summary', { params });
  },

  /**
   * Get overdue invoices
   */
  async getOverdue(): Promise<ApiResponse<Invoice[]>> {
    const client = getApiClient();
    return client.get<Invoice[]>('/invoices/overdue');
  },

  // =============================================================================
  // Templates
  // =============================================================================

  /**
   * List invoice templates
   */
  async getTemplates(): Promise<ApiResponse<InvoiceTemplate[]>> {
    const client = getApiClient();
    return client.get<InvoiceTemplate[]>('/invoice-templates');
  },

  /**
   * Create invoice template
   */
  async createTemplate(
    data: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<InvoiceTemplate>> {
    const client = getApiClient();
    return client.post<InvoiceTemplate>('/invoice-templates', data);
  },

  /**
   * Update invoice template
   */
  async updateTemplate(
    id: string,
    data: Partial<InvoiceTemplate>
  ): Promise<ApiResponse<InvoiceTemplate>> {
    const client = getApiClient();
    return client.patch<InvoiceTemplate>(`/invoice-templates/${id}`, data);
  },

  /**
   * Delete invoice template
   */
  async deleteTemplate(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/invoice-templates/${id}`);
  },

  // =============================================================================
  // Settings
  // =============================================================================

  /**
   * Get invoice settings
   */
  async getSettings(): Promise<ApiResponse<InvoiceSettings>> {
    const client = getApiClient();
    return client.get<InvoiceSettings>('/invoice-settings');
  },

  /**
   * Update invoice settings
   */
  async updateSettings(data: Partial<InvoiceSettings>): Promise<ApiResponse<InvoiceSettings>> {
    const client = getApiClient();
    return client.patch<InvoiceSettings>('/invoice-settings', data);
  },
};

export default invoicingService;
