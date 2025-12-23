/**
 * @module @skillancer/cockpit-svc/types/contract-project
 * Types for Contract-Project Integration
 */

import type {
  MarketContractType,
  MarketContractLinkStatus,
  MarketMilestoneLinkStatus,
  MarketTimeLinkStatus,
  MarketPaymentLinkType,
  MarketPaymentLinkStatus,
  MarketContractSyncStatus,
} from '@skillancer/database';

// ============================================================================
// CONTRACT LINK TYPES
// ============================================================================

export interface ContractLinkWithMetrics {
  id: string;
  marketContractId: string;
  projectId: string | null;
  clientId: string | null;
  contractTitle: string;
  contractType: MarketContractType;
  contractStatus: MarketContractLinkStatus;
  currency: string;
  hourlyRate: number | null;
  fixedPrice: number | null;
  budgetCap: number | null;
  startDate: Date;
  endDate: Date | null;
  syncStatus: MarketContractSyncStatus;
  lastSyncedAt: Date;

  // Settings
  autoCreateProject: boolean;
  autoSyncTime: boolean;
  autoRecordPayments: boolean;

  // Related entities
  project?: {
    id: string;
    name: string;
    status: string;
  } | null;
  client?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    avatarUrl: string | null;
  } | null;

  // Computed metrics
  milestones?: {
    total: number;
    completed: number;
    pending: number;
  };
  financials?: {
    earnedToDate: number;
    pendingPayments: number;
  };
}

export interface ContractLinkDetails extends ContractLinkWithMetrics {
  description?: string;
  milestoneLinks: MilestoneLinkInfo[];
  timeLogs: TimeLinkInfo[];
  payments: PaymentLinkInfo[];
}

// ============================================================================
// MILESTONE LINK TYPES
// ============================================================================

export interface MilestoneLinkInfo {
  id: string;
  marketMilestoneId: string;
  projectMilestoneId: string | null;
  title: string;
  amount: number;
  status: MarketMilestoneLinkStatus;
  dueDate: Date | null;
  lastSyncedAt: Date;
}

// ============================================================================
// TIME LINK TYPES
// ============================================================================

export interface TimeLinkInfo {
  id: string;
  marketTimeLogId: string;
  timeEntryId: string | null;
  date: Date;
  hours: number;
  description: string | null;
  amount: number;
  status: MarketTimeLinkStatus;
  syncedToProject: boolean;
  lastSyncedAt: Date;
}

// ============================================================================
// PAYMENT LINK TYPES
// ============================================================================

export interface PaymentLinkInfo {
  id: string;
  marketPaymentId: string;
  paymentType: MarketPaymentLinkType;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: MarketPaymentLinkStatus;
  paidAt: Date | null;
  recordedAsIncome: boolean;
  lastSyncedAt: Date;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface SyncResult {
  synced: {
    milestones: number;
    timeLogs: number;
    payments: number;
  };
  errors: Array<{
    type: 'milestone' | 'time' | 'payment';
    id: string;
    error: string;
  }>;
}

export interface SyncSettings {
  autoSyncTime: boolean;
  autoRecordPayments: boolean;
  autoCreateProject: boolean;
}

// ============================================================================
// MARKET ACTIVITY SUMMARY
// ============================================================================

export interface MarketActivitySummary {
  activeContracts: number;
  totalEarnedThisMonth: number;
  pendingPayments: number;
  hoursLoggedThisWeek: number;
  milestonesSubmitted: number;
  milestonesApproved: number;
}

export interface MarketActivityItem {
  type:
    | 'PAYMENT_RECEIVED'
    | 'MILESTONE_APPROVED'
    | 'MILESTONE_SUBMITTED'
    | 'TIME_LOGGED'
    | 'CONTRACT_STARTED'
    | 'CONTRACT_ENDED';
  contractTitle: string;
  amount?: number;
  currency?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface LinkContractRequest {
  projectId: string;
  syncTime?: boolean;
  syncMilestones?: boolean;
}

export interface UpdateSyncSettingsRequest {
  autoSyncTime?: boolean;
  autoRecordPayments?: boolean;
  autoCreateProject?: boolean;
}

export interface ContractListFilters {
  status?: MarketContractLinkStatus;
  syncStatus?: MarketContractSyncStatus;
  limit?: number;
  offset?: number;
}

// ============================================================================
// PROJECT CREATION PARAMS
// ============================================================================

export interface CreateProjectFromContractParams {
  freelancerUserId: string;
  clientId: string;
  contractTitle: string;
  description?: string;
  contractType: MarketContractType;
  currency: string;
  hourlyRate?: number | null;
  fixedPrice?: number | null;
  budgetCap?: number | null;
  startDate: Date;
  endDate?: Date | null;
  skills?: string[];
  marketContractId: string;
  marketJobId?: string;
  jobCategory?: string;
}

// ============================================================================
// CLIENT SYNC TYPES
// ============================================================================

export interface MarketClientInfo {
  userId: string;
  displayName: string;
  companyName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
  timezone?: string | null;
}

export interface ClientSyncResult {
  created: boolean;
  linked: boolean;
  clientId: string;
}
