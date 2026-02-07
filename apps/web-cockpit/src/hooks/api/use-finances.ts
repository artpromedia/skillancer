/**
 * Finances API Hooks
 *
 * React Query hooks for financial management operations.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  financesService,
  type FinancialSummary,
  type RevenueReport,
  type ProfitLossReport,
  type CashFlowReport,
  type TaxReport,
  type Budget,
  type BudgetCreate,
  type FinancialGoal,
  type FinancialTransaction,
  type TransactionFilters,
  type FinancialInsight,
  type ReportParams,
} from '../../lib/api/services/finances';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const financeKeys = {
  all: ['finances'] as const,
  summary: (params?: { startDate?: string; endDate?: string }) =>
    [...financeKeys.all, 'summary', params] as const,
  insights: () => [...financeKeys.all, 'insights'] as const,
  metrics: (period: string) => [...financeKeys.all, 'metrics', period] as const,
  reports: () => [...financeKeys.all, 'reports'] as const,
  revenueReport: (params: ReportParams) => [...financeKeys.reports(), 'revenue', params] as const,
  profitLossReport: (params: ReportParams) =>
    [...financeKeys.reports(), 'profit-loss', params] as const,
  cashFlowReport: (params: ReportParams) =>
    [...financeKeys.reports(), 'cash-flow', params] as const,
  taxReport: (params: { year: number; quarter?: number }) =>
    [...financeKeys.reports(), 'tax', params] as const,
  transactions: () => [...financeKeys.all, 'transactions'] as const,
  transactionList: (filters: TransactionFilters) =>
    [...financeKeys.transactions(), filters] as const,
  transaction: (id: string) => [...financeKeys.transactions(), id] as const,
  budgets: () => [...financeKeys.all, 'budgets'] as const,
  activeBudget: () => [...financeKeys.budgets(), 'active'] as const,
  budget: (id: string) => [...financeKeys.budgets(), id] as const,
  goals: () => [...financeKeys.all, 'goals'] as const,
  forecast: () => [...financeKeys.all, 'forecast'] as const,
  revenueForecast: (months: number) => [...financeKeys.forecast(), 'revenue', months] as const,
  expenseForecast: (months: number) => [...financeKeys.forecast(), 'expenses', months] as const,
  settings: () => [...financeKeys.all, 'settings'] as const,
};

// =============================================================================
// Summary & Dashboard Hooks
// =============================================================================

export function useFinancialSummary(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<ApiResponse<FinancialSummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.summary(params),
    queryFn: () => financesService.getSummary(params),
    ...options,
  });
}

export function useFinancialInsights(
  options?: Omit<UseQueryOptions<ApiResponse<FinancialInsight[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.insights(),
    queryFn: () => financesService.getInsights(),
    ...options,
  });
}

export function useKeyMetrics(
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month',
  options?: Omit<
    UseQueryOptions<
      ApiResponse<{
        revenue: number;
        revenueChange: number;
        expenses: number;
        expensesChange: number;
        profit: number;
        profitChange: number;
        outstandingInvoices: number;
        billableHours: number;
      }>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: financeKeys.metrics(period),
    queryFn: () => financesService.getKeyMetrics(period),
    ...options,
  });
}

// =============================================================================
// Report Hooks
// =============================================================================

export function useRevenueReport(
  params: ReportParams,
  options?: Omit<UseQueryOptions<ApiResponse<RevenueReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.revenueReport(params),
    queryFn: () => financesService.getRevenueReport(params),
    enabled: !!params.startDate && !!params.endDate,
    ...options,
  });
}

export function useProfitLossReport(
  params: ReportParams,
  options?: Omit<UseQueryOptions<ApiResponse<ProfitLossReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.profitLossReport(params),
    queryFn: () => financesService.getProfitLossReport(params),
    enabled: !!params.startDate && !!params.endDate,
    ...options,
  });
}

export function useCashFlowReport(
  params: ReportParams,
  options?: Omit<UseQueryOptions<ApiResponse<CashFlowReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.cashFlowReport(params),
    queryFn: () => financesService.getCashFlowReport(params),
    enabled: !!params.startDate && !!params.endDate,
    ...options,
  });
}

export function useTaxReport(
  params: { year: number; quarter?: 1 | 2 | 3 | 4 },
  options?: Omit<UseQueryOptions<ApiResponse<TaxReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.taxReport(params),
    queryFn: () => financesService.getTaxReport(params),
    enabled: !!params.year,
    ...options,
  });
}

// =============================================================================
// Transaction Hooks
// =============================================================================

export function useTransactions(
  filters: TransactionFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<FinancialTransaction>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.transactionList(filters),
    queryFn: () => financesService.getTransactions(filters),
    ...options,
  });
}

export function useTransaction(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<FinancialTransaction>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.transaction(id),
    queryFn: () => financesService.getTransaction(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// Budget Hooks
// =============================================================================

export function useBudgets(
  options?: Omit<UseQueryOptions<ApiResponse<Budget[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.budgets(),
    queryFn: () => financesService.getBudgets(),
    ...options,
  });
}

export function useActiveBudget(
  options?: Omit<UseQueryOptions<ApiResponse<Budget | null>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.activeBudget(),
    queryFn: () => financesService.getActiveBudget(),
    ...options,
  });
}

export function useBudget(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Budget>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.budget(id),
    queryFn: () => financesService.getBudget(id),
    enabled: !!id,
    ...options,
  });
}

export function useCreateBudget(
  options?: UseMutationOptions<ApiResponse<Budget>, Error, BudgetCreate>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BudgetCreate) => financesService.createBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.budgets() });
    },
    ...options,
  });
}

export function useUpdateBudget(
  options?: UseMutationOptions<
    ApiResponse<Budget>,
    Error,
    { id: string; data: Partial<BudgetCreate> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => financesService.updateBudget(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.budget(id) });
      queryClient.invalidateQueries({ queryKey: financeKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: financeKeys.activeBudget() });
    },
    ...options,
  });
}

export function useDeleteBudget(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financesService.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: financeKeys.activeBudget() });
    },
    ...options,
  });
}

// =============================================================================
// Goal Hooks
// =============================================================================

export function useFinancialGoals(
  options?: Omit<UseQueryOptions<ApiResponse<FinancialGoal[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: financeKeys.goals(),
    queryFn: () => financesService.getGoals(),
    ...options,
  });
}

export function useCreateFinancialGoal(
  options?: UseMutationOptions<
    ApiResponse<FinancialGoal>,
    Error,
    Omit<FinancialGoal, 'id' | 'currentAmount' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => financesService.createGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.goals() });
    },
    ...options,
  });
}

export function useUpdateFinancialGoal(
  options?: UseMutationOptions<
    ApiResponse<FinancialGoal>,
    Error,
    { id: string; data: Partial<FinancialGoal> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => financesService.updateGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.goals() });
    },
    ...options,
  });
}

export function useDeleteFinancialGoal(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financesService.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.goals() });
    },
    ...options,
  });
}

// =============================================================================
// Forecast Hooks
// =============================================================================

export function useRevenueForecast(
  months: number = 6,
  options?: Omit<
    UseQueryOptions<
      ApiResponse<{
        forecast: Array<{
          month: string;
          predicted: number;
          lower: number;
          upper: number;
        }>;
        factors: string[];
        confidence: number;
      }>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: financeKeys.revenueForecast(months),
    queryFn: () => financesService.getRevenueForecast(months),
    ...options,
  });
}

export function useExpenseForecast(
  months: number = 6,
  options?: Omit<
    UseQueryOptions<
      ApiResponse<{
        forecast: Array<{
          month: string;
          predicted: number;
          byCategory: Record<string, number>;
        }>;
        trends: Array<{
          category: string;
          trend: 'increasing' | 'decreasing' | 'stable';
          change: number;
        }>;
      }>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: financeKeys.expenseForecast(months),
    queryFn: () => financesService.getExpenseForecast(months),
    ...options,
  });
}

// =============================================================================
// Settings Hooks
// =============================================================================

export function useFinancialSettings(
  options?: Omit<
    UseQueryOptions<
      ApiResponse<{
        defaultCurrency: string;
        fiscalYearStart: number;
        taxRate: number;
        taxId?: string;
        bankAccounts: Array<{
          id: string;
          name: string;
          accountNumber: string;
          bankName: string;
          isDefault: boolean;
        }>;
      }>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: financeKeys.settings(),
    queryFn: () => financesService.getSettings(),
    ...options,
  });
}

export function useUpdateFinancialSettings(
  options?: UseMutationOptions<
    ApiResponse<unknown>,
    Error,
    Partial<{
      defaultCurrency: string;
      fiscalYearStart: number;
      taxRate: number;
      taxId: string;
    }>
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => financesService.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.settings() });
    },
    ...options,
  });
}
