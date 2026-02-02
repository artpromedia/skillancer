/**
 * Cockpit API Services Index
 *
 * Re-exports all service modules and the API client utilities.
 */

// API Client
export {
  getApiClient,
  apiClient,
  setAuthTokens,
  clearAuthTokens,
  isAuthenticated,
  resetApiClient,
  getCurrentTenantId,
  setCurrentTenantId,
  clearCurrentTenantId,
} from './api-client';

// Services
export { projectsService } from './services/projects';
export { timeTrackingService } from './services/time-tracking';
export { invoicingService } from './services/invoicing';
export { clientsService } from './services/clients';
export { expensesService } from './services/expenses';
export { financesService } from './services/finances';

// Types - Projects
export type {
  Project,
  ProjectTask,
  ProjectMilestone,
  ProjectTimeEntry,
  ProjectStats,
  ProjectListParams,
  ProjectListResponse,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  ProjectStatus,
  ProjectPriority,
  ProjectType,
  ProjectSource,
} from './services/projects';

// Types - Time Tracking
export type {
  TimeEntry,
  TimeEntryCreate,
  TimeEntryUpdate,
  TimerState,
  TimeCategory,
  TimeReport,
  TimeReportParams,
  TimeEntryFilters,
  WeeklyReport,
  DailyReport,
} from './services/time-tracking';

// Types - Invoicing
export type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  InvoicePayment,
  RecurringInvoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  SendInvoiceInput,
  RecordPaymentInput,
  InvoiceFilters,
  InvoiceStats,
} from './services/invoicing';

// Types - Clients
export type {
  Client,
  ClientStatus,
  ClientStats,
  ClientActivity,
  ClientListParams,
  CreateClientInput,
  UpdateClientInput,
  AddActivityInput,
} from './services/clients';

// Types - Expenses
export type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  ExpenseFilters,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseStats,
} from './services/expenses';

// Types - Finances
export type {
  FinancialSummary,
  RevenueBreakdown,
  ProfitLossReport,
  CashFlowReport,
  TaxSummary,
  FinanceFilters,
  FinanceOverview,
} from './services/finances';
