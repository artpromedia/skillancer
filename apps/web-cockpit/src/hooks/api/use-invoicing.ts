/**
 * Invoicing API Hooks
 *
 * React Query hooks for invoice operations.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  invoicingService,
  type Invoice,
  type InvoiceCreate,
  type InvoiceUpdate,
  type InvoiceFilters,
  type InvoiceSummary,
  type InvoiceTemplate,
  type InvoiceSettings,
  type RecordPaymentInput,
  type CreateFromTimeEntriesInput,
  type InvoiceLineItem,
} from '../../lib/api/services/invoicing';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  byNumber: (invoiceNumber: string) => [...invoiceKeys.all, 'by-number', invoiceNumber] as const,
  summary: (params?: { startDate?: string; endDate?: string }) =>
    [...invoiceKeys.all, 'summary', params] as const,
  overdue: () => [...invoiceKeys.all, 'overdue'] as const,
  templates: () => [...invoiceKeys.all, 'templates'] as const,
  settings: () => [...invoiceKeys.all, 'settings'] as const,
};

// =============================================================================
// List Hooks
// =============================================================================

export function useInvoices(
  filters: InvoiceFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Invoice>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => invoicingService.list(filters),
    ...options,
  });
}

export function useOverdueInvoices(
  options?: Omit<UseQueryOptions<ApiResponse<Invoice[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.overdue(),
    queryFn: () => invoicingService.getOverdue(),
    ...options,
  });
}

// =============================================================================
// Detail Hooks
// =============================================================================

export function useInvoice(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Invoice>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoicingService.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useInvoiceByNumber(
  invoiceNumber: string,
  options?: Omit<UseQueryOptions<ApiResponse<Invoice>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.byNumber(invoiceNumber),
    queryFn: () => invoicingService.getByNumber(invoiceNumber),
    enabled: !!invoiceNumber,
    ...options,
  });
}

export function useInvoiceSummary(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<ApiResponse<InvoiceSummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.summary(params),
    queryFn: () => invoicingService.getSummary(params),
    ...options,
  });
}

// =============================================================================
// CRUD Mutations
// =============================================================================

export function useCreateInvoice(
  options?: UseMutationOptions<ApiResponse<Invoice>, Error, InvoiceCreate>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InvoiceCreate) => invoicingService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

export function useUpdateInvoice(
  options?: UseMutationOptions<ApiResponse<Invoice>, Error, { id: string; data: InvoiceUpdate }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => invoicingService.update(id, data),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    ...options,
  });
}

export function useDeleteInvoice(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicingService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

export function useDuplicateInvoice(
  options?: UseMutationOptions<ApiResponse<Invoice>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicingService.duplicate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    ...options,
  });
}

// =============================================================================
// Action Mutations
// =============================================================================

export function useFinalizeInvoice(
  options?: UseMutationOptions<ApiResponse<Invoice>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicingService.finalize(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    ...options,
  });
}

export function useSendInvoice(
  options?: UseMutationOptions<
    ApiResponse<Invoice>,
    Error,
    { id: string; options?: { emailSubject?: string; emailBody?: string; cc?: string[] } }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, options: sendOptions }) => invoicingService.send(id, sendOptions),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

export function useMarkInvoicePaid(
  options?: UseMutationOptions<ApiResponse<Invoice>, Error, { id: string; paidDate?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, paidDate }) => invoicingService.markPaid(id, paidDate),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.overdue() });
    },
    ...options,
  });
}

export function useCancelInvoice(
  options?: UseMutationOptions<ApiResponse<Invoice>, Error, { id: string; reason?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => invoicingService.cancel(id, reason),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

export function useRecordPayment(
  options?: UseMutationOptions<
    ApiResponse<Invoice>,
    Error,
    { id: string; data: RecordPaymentInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => invoicingService.recordPayment(id, data),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

export function useDeletePayment(
  options?: UseMutationOptions<
    ApiResponse<Invoice>,
    Error,
    { invoiceId: string; paymentId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, paymentId }) => invoicingService.deletePayment(invoiceId, paymentId),
    onSuccess: (_, { invoiceId }) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

export function useSendReminder(options?: UseMutationOptions<ApiResponse<Invoice>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicingService.sendReminder(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
    ...options,
  });
}

export function useRefundInvoice(
  options?: UseMutationOptions<
    ApiResponse<Invoice>,
    Error,
    { id: string; amount?: number; reason?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount, reason }) => invoicingService.refund(id, amount, reason),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

// =============================================================================
// Create from Time Entries
// =============================================================================

export function useCreateInvoiceFromTimeEntries(
  options?: UseMutationOptions<ApiResponse<Invoice>, Error, CreateFromTimeEntriesInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFromTimeEntriesInput) => invoicingService.createFromTimeEntries(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.summary() });
    },
    ...options,
  });
}

export function usePreviewInvoiceFromTimeEntries(
  options?: UseMutationOptions<
    ApiResponse<{ lineItems: InvoiceLineItem[]; subtotal: number }>,
    Error,
    CreateFromTimeEntriesInput
  >
) {
  return useMutation({
    mutationFn: (data: CreateFromTimeEntriesInput) => invoicingService.previewFromTimeEntries(data),
    ...options,
  });
}

// =============================================================================
// Templates
// =============================================================================

export function useInvoiceTemplates(
  options?: Omit<UseQueryOptions<ApiResponse<InvoiceTemplate[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.templates(),
    queryFn: () => invoicingService.getTemplates(),
    ...options,
  });
}

export function useCreateInvoiceTemplate(
  options?: UseMutationOptions<
    ApiResponse<InvoiceTemplate>,
    Error,
    Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => invoicingService.createTemplate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.templates() });
    },
    ...options,
  });
}

export function useUpdateInvoiceTemplate(
  options?: UseMutationOptions<
    ApiResponse<InvoiceTemplate>,
    Error,
    { id: string; data: Partial<InvoiceTemplate> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => invoicingService.updateTemplate(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.templates() });
    },
    ...options,
  });
}

export function useDeleteInvoiceTemplate(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicingService.deleteTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.templates() });
    },
    ...options,
  });
}

// =============================================================================
// Settings
// =============================================================================

export function useInvoiceSettings(
  options?: Omit<UseQueryOptions<ApiResponse<InvoiceSettings>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.settings(),
    queryFn: () => invoicingService.getSettings(),
    ...options,
  });
}

export function useUpdateInvoiceSettings(
  options?: UseMutationOptions<ApiResponse<InvoiceSettings>, Error, Partial<InvoiceSettings>>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<InvoiceSettings>) => invoicingService.updateSettings(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.settings() });
    },
    ...options,
  });
}
