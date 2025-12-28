/**
 * Invoice API Client
 * Handles all invoice-related API calls
 */

import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  RecurringInvoice,
  InvoicePayment,
} from '@skillancer/types';

// Types
export interface CreateInvoiceInput {
  clientId: string;
  projectId?: string;
  dueDate: string;
  currency?: string;
  taxRate?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  lineItems: Omit<InvoiceLineItem, 'id'>[];
  notes?: string;
  terms?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  id: string;
}

export interface SendInvoiceInput {
  invoiceId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;
  attachPdf?: boolean;
  scheduleDate?: string;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus | InvoiceStatus[];
  clientId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'dueDate' | 'amount' | 'invoiceNumber';
  sortOrder?: 'asc' | 'desc';
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface InvoiceStats {
  totalDraft: number;
  totalSent: number;
  totalPaid: number;
  totalOverdue: number;
  amountDraft: number;
  amountSent: number;
  amountPaid: number;
  amountOverdue: number;
  averagePaymentDays: number;
}

// API Base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// Helper function for API calls
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Invoice CRUD operations
export const invoiceApi = {
  /**
   * List invoices with optional filters
   */
  list: async (filters?: InvoiceFilters): Promise<InvoiceListResponse> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    const query = params.toString();
    const endpoint = query ? `/invoices?${query}` : '/invoices';
    return apiRequest(endpoint);
  },

  /**
   * Get a single invoice by ID
   */
  get: async (id: string): Promise<Invoice> => {
    return apiRequest(`/invoices/${id}`);
  },

  /**
   * Create a new invoice
   */
  create: async (input: CreateInvoiceInput): Promise<Invoice> => {
    return apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an existing invoice
   */
  update: async (input: UpdateInvoiceInput): Promise<Invoice> => {
    const { id, ...data } = input;
    return apiRequest(`/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete an invoice
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/invoices/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Duplicate an invoice
   */
  duplicate: async (id: string): Promise<Invoice> => {
    return apiRequest(`/invoices/${id}/duplicate`, {
      method: 'POST',
    });
  },

  /**
   * Get invoice statistics
   */
  getStats: async (dateRange?: { start: string; end: string }): Promise<InvoiceStats> => {
    const params = dateRange ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : '';
    return apiRequest(`/invoices/stats${params}`);
  },

  /**
   * Send an invoice via email
   */
  send: async (input: SendInvoiceInput): Promise<{ success: boolean; scheduledAt?: string }> => {
    const { invoiceId, ...data } = input;
    return apiRequest(`/invoices/${invoiceId}/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Record a payment against an invoice
   */
  recordPayment: async (input: RecordPaymentInput): Promise<InvoicePayment> => {
    const { invoiceId, ...data } = input;
    return apiRequest(`/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Mark invoice as sent
   */
  markAsSent: async (id: string): Promise<Invoice> => {
    return apiRequest(`/invoices/${id}/mark-sent`, {
      method: 'POST',
    });
  },

  /**
   * Mark invoice as paid
   */
  markAsPaid: async (
    id: string,
    paymentDetails?: Partial<RecordPaymentInput>
  ): Promise<Invoice> => {
    return apiRequest(`/invoices/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(paymentDetails || {}),
    });
  },

  /**
   * Void an invoice
   */
  void: async (id: string, reason?: string): Promise<Invoice> => {
    return apiRequest(`/invoices/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Get invoice PDF
   */
  getPdf: async (id: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/invoices/${id}/pdf`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }
    return response.blob();
  },

  /**
   * Get invoice payment link
   */
  getPaymentLink: async (id: string): Promise<{ url: string; expiresAt: string }> => {
    return apiRequest(`/invoices/${id}/payment-link`);
  },

  /**
   * Import time entries as line items
   */
  importTimeEntries: async (
    invoiceId: string,
    timeEntryIds: string[]
  ): Promise<InvoiceLineItem[]> => {
    return apiRequest(`/invoices/${invoiceId}/import-time-entries`, {
      method: 'POST',
      body: JSON.stringify({ timeEntryIds }),
    });
  },

  /**
   * Send payment reminder
   */
  sendReminder: async (id: string, message?: string): Promise<{ success: boolean }> => {
    return apiRequest(`/invoices/${id}/send-reminder`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Get invoice activity/history
   */
  getActivity: async (
    id: string
  ): Promise<
    Array<{
      id: string;
      type: string;
      description: string;
      createdAt: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }>
  > => {
    return apiRequest(`/invoices/${id}/activity`);
  },
};

// Recurring Invoice operations
export const recurringInvoiceApi = {
  /**
   * List recurring invoices
   */
  list: async (filters?: {
    status?: 'active' | 'paused' | 'completed';
    clientId?: string;
  }): Promise<RecurringInvoice[]> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString();
    const endpoint = query ? `/invoices/recurring?${query}` : '/invoices/recurring';
    return apiRequest(endpoint);
  },

  /**
   * Get a single recurring invoice
   */
  get: async (id: string): Promise<RecurringInvoice> => {
    return apiRequest(`/invoices/recurring/${id}`);
  },

  /**
   * Create a recurring invoice
   */
  create: async (
    input: CreateInvoiceInput & {
      frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
      startDate: string;
      endDate?: string;
    }
  ): Promise<RecurringInvoice> => {
    return apiRequest('/invoices/recurring', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update a recurring invoice
   */
  update: async (id: string, input: Partial<CreateInvoiceInput>): Promise<RecurringInvoice> => {
    return apiRequest(`/invoices/recurring/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  /**
   * Pause a recurring invoice
   */
  pause: async (id: string): Promise<RecurringInvoice> => {
    return apiRequest(`/invoices/recurring/${id}/pause`, {
      method: 'POST',
    });
  },

  /**
   * Resume a recurring invoice
   */
  resume: async (id: string): Promise<RecurringInvoice> => {
    return apiRequest(`/invoices/recurring/${id}/resume`, {
      method: 'POST',
    });
  },

  /**
   * Delete a recurring invoice
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/invoices/recurring/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get generated invoices from recurring
   */
  getGeneratedInvoices: async (id: string): Promise<Invoice[]> => {
    return apiRequest(`/invoices/recurring/${id}/invoices`);
  },
};

// Invoice settings operations
export const invoiceSettingsApi = {
  /**
   * Get invoice settings
   */
  get: async (): Promise<{
    businessName: string;
    businessEmail: string;
    businessPhone: string;
    businessAddress: string;
    taxId: string;
    logoUrl?: string;
    defaultDueDays: number;
    defaultCurrency: string;
    defaultTaxRate: number;
    invoicePrefix: string;
    nextInvoiceNumber: number;
    accentColor: string;
    fontFamily: string;
    defaultNotes: string;
    defaultTerms: string;
    paymentMethods: string[];
    bankDetails?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      routingNumber: string;
    };
  }> => {
    return apiRequest('/invoices/settings');
  },

  /**
   * Update invoice settings
   */
  update: async (settings: Record<string, unknown>): Promise<void> => {
    return apiRequest('/invoices/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Upload invoice logo
   */
  uploadLogo: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch(`${API_BASE}/invoices/settings/logo`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to upload logo');
    }

    return response.json() as Promise<{ logoUrl: string }>;
  },
};

export default {
  invoices: invoiceApi,
  recurring: recurringInvoiceApi,
  settings: invoiceSettingsApi,
};
