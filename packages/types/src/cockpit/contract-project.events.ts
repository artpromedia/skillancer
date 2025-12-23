/**
 * @skillancer/types - Contract-Project Integration Events
 * Event definitions for Market Contract to Cockpit Project synchronization
 */

// ============================================================================
// MARKET → COCKPIT EVENTS
// ============================================================================

/**
 * Client information from Market
 */
export interface MarketClientInfo {
  userId: string;
  displayName: string;
  companyName?: string | undefined;
  email: string;
  avatarUrl?: string | undefined;
  country?: string | undefined;
  timezone?: string | undefined;
}

/**
 * Milestone information from Market
 */
export interface MarketMilestoneInfo {
  id: string;
  title: string;
  description?: string | undefined;
  amount: number;
  dueDate?: Date | undefined;
  order: number;
}

/**
 * Contract type enumeration
 */
export type MarketContractType = 'HOURLY' | 'FIXED_PRICE' | 'RETAINER';

/**
 * Contract status enumeration
 */
export type MarketContractStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

/**
 * Retainer period enumeration
 */
export type RetainerPeriod = 'WEEKLY' | 'MONTHLY';

/**
 * Event: Contract created in Market
 * Triggers project creation in Cockpit
 */
export interface ContractCreatedEvent {
  eventType: 'contract.created';
  timestamp: Date;
  correlationId: string;
  payload: {
    contractId: string;
    freelancerId: string;
    clientUserId: string;

    // Contract details
    title: string;
    description: string;
    contractType: MarketContractType;

    // Client info
    client: MarketClientInfo;

    // Financial terms
    currency: string;
    hourlyRate?: number | undefined;
    fixedPrice?: number | undefined;
    retainerAmount?: number | undefined;
    retainerPeriod?: RetainerPeriod | undefined;
    estimatedHours?: number | undefined;
    budgetCap?: number | undefined;

    // Timeline
    startDate: Date;
    endDate?: Date | undefined;
    estimatedDuration?: number | undefined; // days

    // Milestones (for fixed price)
    milestones?: MarketMilestoneInfo[] | undefined;

    // Job reference
    jobId?: string | undefined;
    jobTitle?: string | undefined;
    jobCategory?: string | undefined;

    // Skills
    skills: string[];

    // Status
    status: MarketContractStatus;
  };
}

/**
 * Status change initiator
 */
export type StatusChangeInitiator = 'FREELANCER' | 'CLIENT' | 'SYSTEM' | 'ADMIN';

/**
 * Event: Contract status changed in Market
 */
export interface ContractStatusChangedEvent {
  eventType: 'contract.status.changed';
  timestamp: Date;
  correlationId: string;
  payload: {
    contractId: string;
    freelancerId: string;
    previousStatus: MarketContractStatus;
    newStatus: MarketContractStatus;
    reason?: string | undefined;
    changedBy: StatusChangeInitiator;
  };
}

/**
 * Milestone action type
 */
export type MilestoneAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID';

/**
 * Milestone status in Market
 */
export type MarketMilestoneStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PAID'
  | 'DISPUTED';

/**
 * Event: Contract milestone updated in Market
 */
export interface ContractMilestoneUpdatedEvent {
  eventType: 'contract.milestone.updated';
  timestamp: Date;
  correlationId: string;
  payload: {
    contractId: string;
    freelancerId: string;
    milestoneId: string;
    action: MilestoneAction;
    milestone: {
      id: string;
      title: string;
      description?: string | undefined;
      amount: number;
      status: MarketMilestoneStatus;
      dueDate?: Date | undefined;
      submittedAt?: Date | undefined;
      approvedAt?: Date | undefined;
      paidAt?: Date | undefined;
      feedback?: string | undefined;
    };
  };
}

/**
 * Time log status
 */
export type TimeLogStatus = 'PENDING' | 'APPROVED' | 'DISPUTED';

/**
 * Screenshot activity info
 */
export interface ScreenshotActivity {
  count: number;
  activityLevel: number; // 0-100
}

/**
 * Event: Time logged on contract in Market
 */
export interface ContractTimeLoggedEvent {
  eventType: 'contract.time.logged';
  timestamp: Date;
  correlationId: string;
  payload: {
    contractId: string;
    freelancerId: string;
    timeLogId: string;
    date: Date;
    hours: number;
    description: string;
    hourlyRate: number;
    amount: number;
    status: TimeLogStatus;
    screenshots?: ScreenshotActivity | undefined;
  };
}

/**
 * Payment type
 */
export type ContractPaymentType = 'MILESTONE' | 'HOURLY' | 'BONUS' | 'RETAINER' | 'REFUND';

/**
 * Payment status
 */
export type ContractPaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Event: Payment received for contract in Market
 */
export interface ContractPaymentReceivedEvent {
  eventType: 'contract.payment.received';
  timestamp: Date;
  correlationId: string;
  payload: {
    contractId: string;
    freelancerId: string;
    paymentId: string;

    // Payment details
    grossAmount: number;
    platformFee: number;
    netAmount: number;
    currency: string;

    // Payment type
    paymentType: ContractPaymentType;
    milestoneId?: string | undefined;
    weekEnding?: Date | undefined; // For hourly

    // Status
    status: ContractPaymentStatus;
    paidAt?: Date | undefined;

    // Related invoice
    marketInvoiceId?: string | undefined;
  };
}

/**
 * Dispute type
 */
export type DisputeType = 'PAYMENT' | 'DELIVERABLE' | 'SCOPE' | 'OTHER';

/**
 * Dispute status
 */
export type DisputeStatus = 'OPENED' | 'IN_REVIEW' | 'RESOLVED' | 'ESCALATED';

/**
 * Dispute resolution outcome
 */
export type DisputeOutcome = 'FREELANCER_FAVOR' | 'CLIENT_FAVOR' | 'SPLIT' | 'CANCELLED';

/**
 * Dispute resolution details
 */
export interface DisputeResolution {
  outcome: DisputeOutcome;
  freelancerAmount: number;
  clientRefundAmount: number;
}

/**
 * Event: Dispute opened/updated on contract
 */
export interface ContractDisputeEvent {
  eventType: 'contract.dispute';
  timestamp: Date;
  correlationId: string;
  payload: {
    contractId: string;
    freelancerId: string;
    disputeId: string;
    disputeType: DisputeType;
    status: DisputeStatus;
    amount?: number | undefined;
    resolution?: DisputeResolution | undefined;
  };
}

/**
 * Contract end reason
 */
export type ContractEndReason =
  | 'COMPLETED'
  | 'CANCELLED_BY_FREELANCER'
  | 'CANCELLED_BY_CLIENT'
  | 'MUTUAL'
  | 'EXPIRED'
  | 'TERMINATED';

/**
 * Event: Contract ended in Market
 */
export interface ContractEndedEvent {
  eventType: 'contract.ended';
  timestamp: Date;
  correlationId: string;
  payload: {
    contractId: string;
    freelancerId: string;
    endReason: ContractEndReason;

    // Final stats
    totalEarned: number;
    totalHoursWorked?: number | undefined;
    milestonesCompleted?: number | undefined;

    // Client feedback
    clientRating?: number | undefined;
    clientReview?: string | undefined;
    wouldHireAgain?: boolean | undefined;

    // Freelancer feedback
    freelancerRating?: number | undefined;
    freelancerReview?: string | undefined;

    endedAt: Date;
  };
}

// ============================================================================
// COCKPIT → MARKET EVENTS
// ============================================================================

/**
 * Event: Time logged in Cockpit project
 */
export interface ProjectTimeLoggedEvent {
  eventType: 'project.time.logged';
  timestamp: Date;
  correlationId: string;
  payload: {
    projectId: string;
    freelancerId: string;
    timeEntryId: string;
    linkedContractId?: string | undefined;

    date: Date;
    durationMinutes: number;
    description: string;
    taskId?: string | undefined;
    taskTitle?: string | undefined;

    isBillable: boolean;
    hourlyRate?: number | undefined;
  };
}

/**
 * Event: Milestone completed in Cockpit project
 */
export interface ProjectMilestoneCompletedEvent {
  eventType: 'project.milestone.completed';
  timestamp: Date;
  correlationId: string;
  payload: {
    projectId: string;
    freelancerId: string;
    milestoneId: string;
    linkedContractMilestoneId?: string | undefined;

    title: string;
    completedAt: Date;
    deliverables?: string[] | undefined;
  };
}

/**
 * Event: Project status changed in Cockpit
 */
export interface ProjectStatusChangedEvent {
  eventType: 'project.status.changed';
  timestamp: Date;
  correlationId: string;
  payload: {
    projectId: string;
    freelancerId: string;
    linkedContractId?: string | undefined;

    previousStatus: string;
    newStatus: string;
    reason?: string | undefined;
  };
}

// ============================================================================
// UNION TYPES
// ============================================================================

/**
 * All Market → Cockpit events
 */
export type MarketToCockpitEvent =
  | ContractCreatedEvent
  | ContractStatusChangedEvent
  | ContractMilestoneUpdatedEvent
  | ContractTimeLoggedEvent
  | ContractPaymentReceivedEvent
  | ContractDisputeEvent
  | ContractEndedEvent;

/**
 * All Cockpit → Market events
 */
export type CockpitToMarketEvent =
  | ProjectTimeLoggedEvent
  | ProjectMilestoneCompletedEvent
  | ProjectStatusChangedEvent;

/**
 * All contract-project integration events
 */
export type ContractProjectEvent = MarketToCockpitEvent | CockpitToMarketEvent;

/**
 * Event type discriminator
 */
export type ContractProjectEventType = ContractProjectEvent['eventType'];

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract payload type from event
 */
export type EventPayload<T extends ContractProjectEvent> = T['payload'];

/**
 * Contract sync status
 */
export type SyncStatus = 'SYNCED' | 'PENDING' | 'ERROR' | 'CONFLICT';

/**
 * Time source indicator
 */
export type TimeSource = 'MARKET' | 'COCKPIT';
