/**
 * Expenses API Hooks
 *
 * React Query hooks for expense tracking operations.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  expensesService,
  type Expense,
  type ExpenseCreate,
  type ExpenseUpdate,
  type ExpenseFilters,
  type ExpenseCategory,
  type ExpenseSummary,
  type ExpenseReport,
  type ExpenseReceipt,
} from '../lib/api/services/expenses';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (filters: ExpenseFilters) => [...expenseKeys.lists(), filters] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (id: string) => [...expenseKeys.details(), id] as const,
  categories: () => [...expenseKeys.all, 'categories'] as const,
  summary: (params?: { startDate?: string; endDate?: string; projectId?: string }) =>
    [...expenseKeys.all, 'summary', params] as const,
  report: (params: { startDate: string; endDate: string }) =>
    [...expenseKeys.all, 'report', params] as const,
  mileageRate: () => [...expenseKeys.all, 'mileage-rate'] as const,
};

// =============================================================================
// List Hooks
// =============================================================================

export function useExpenses(
  filters: ExpenseFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Expense>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.list(filters),
    queryFn: () => expensesService.list(filters),
    ...options,
  });
}

// =============================================================================
// Detail Hooks
// =============================================================================

export function useExpense(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Expense>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: () => expensesService.getById(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// CRUD Mutations
// =============================================================================

export function useCreateExpense(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, ExpenseCreate>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseCreate) => expensesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.summary() });
    },
    ...options,
  });
}

export function useUpdateExpense(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, { id: string; data: ExpenseUpdate }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => expensesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.summary() });
    },
    ...options,
  });
}

export function useDeleteExpense(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.summary() });
    },
    ...options,
  });
}

export function useDuplicateExpense(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
    ...options,
  });
}

// =============================================================================
// Receipt Mutations
// =============================================================================

export function useUploadReceipt(
  options?: UseMutationOptions<
    ApiResponse<ExpenseReceipt>,
    Error,
    { expenseId: string; file: File }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, file }) => expensesService.uploadReceipt(expenseId, file),
    onSuccess: (_, { expenseId }) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(expenseId) });
    },
    ...options,
  });
}

export function useDeleteReceipt(
  options?: UseMutationOptions<ApiResponse<void>, Error, { expenseId: string; receiptId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, receiptId }) => expensesService.deleteReceipt(expenseId, receiptId),
    onSuccess: (_, { expenseId }) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(expenseId) });
    },
    ...options,
  });
}

export function useScanReceipt(
  options?: UseMutationOptions<
    ApiResponse<{
      vendor?: string;
      amount?: number;
      date?: string;
      description?: string;
      confidence: number;
    }>,
    Error,
    File
  >
) {
  return useMutation({
    mutationFn: (file: File) => expensesService.scanReceipt(file),
    ...options,
  });
}

// =============================================================================
// Approval Workflow Mutations
// =============================================================================

export function useSubmitExpense(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.submit(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
    ...options,
  });
}

export function useApproveExpense(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.approve(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.summary() });
    },
    ...options,
  });
}

export function useRejectExpense(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => expensesService.reject(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
    ...options,
  });
}

export function useMarkExpenseReimbursed(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.markReimbursed(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.summary() });
    },
    ...options,
  });
}

// =============================================================================
// Category Hooks
// =============================================================================

export function useExpenseCategories(
  options?: Omit<UseQueryOptions<ApiResponse<ExpenseCategory[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.categories(),
    queryFn: () => expensesService.getCategories(),
    ...options,
  });
}

export function useCreateExpenseCategory(
  options?: UseMutationOptions<
    ApiResponse<ExpenseCategory>,
    Error,
    Omit<ExpenseCategory, 'id' | 'isActive'>
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => expensesService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
    },
    ...options,
  });
}

export function useUpdateExpenseCategory(
  options?: UseMutationOptions<
    ApiResponse<ExpenseCategory>,
    Error,
    { id: string; data: Partial<ExpenseCategory> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => expensesService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
    },
    ...options,
  });
}

export function useDeleteExpenseCategory(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
    },
    ...options,
  });
}

// =============================================================================
// Mileage Hooks
// =============================================================================

export function useCreateMileageExpense(
  options?: UseMutationOptions<
    ApiResponse<Expense>,
    Error,
    {
      date: string;
      distance: number;
      unit: 'miles' | 'kilometers';
      ratePerUnit?: number;
      startLocation?: string;
      endLocation?: string;
      purpose?: string;
      projectId?: string;
      clientId?: string;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => expensesService.createMileageExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.summary() });
    },
    ...options,
  });
}

export function useMileageRate(
  options?: Omit<
    UseQueryOptions<ApiResponse<{ rate: number; unit: 'miles' | 'kilometers' }>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: expenseKeys.mileageRate(),
    queryFn: () => expensesService.getMileageRate(),
    ...options,
  });
}

// =============================================================================
// Summary & Report Hooks
// =============================================================================

export function useExpenseSummary(
  params?: { startDate?: string; endDate?: string; projectId?: string },
  options?: Omit<UseQueryOptions<ApiResponse<ExpenseSummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.summary(params),
    queryFn: () => expensesService.getSummary(params),
    ...options,
  });
}

export function useExpenseReport(
  params: {
    startDate: string;
    endDate: string;
    projectId?: string;
    clientId?: string;
    categoryIds?: string[];
  },
  options?: Omit<UseQueryOptions<ApiResponse<ExpenseReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.report({ startDate: params.startDate, endDate: params.endDate }),
    queryFn: () => expensesService.generateReport(params),
    enabled: !!params.startDate && !!params.endDate,
    ...options,
  });
}

// =============================================================================
// Bulk Operations
// =============================================================================

export function useBulkDeleteExpenses(
  options?: UseMutationOptions<ApiResponse<{ deleted: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => expensesService.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
    ...options,
  });
}

export function useBulkSubmitExpenses(
  options?: UseMutationOptions<ApiResponse<{ submitted: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => expensesService.bulkSubmit(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
    ...options,
  });
}

export function useBulkApproveExpenses(
  options?: UseMutationOptions<ApiResponse<{ approved: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => expensesService.bulkApprove(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
    ...options,
  });
}
