/**
 * @module @skillancer/cockpit-svc/types/crm
 * CRM Type Definitions
 */

import type {
  ClientType,
  ClientSource,
  ClientStatus,
  CompanySize,
  ContactRole,
  InteractionType,
  Sentiment,
  OpportunitySource,
  OpportunityStage,
  OpportunityStatus,
  CrmPriority,
  CrmDocumentType,
  ReminderType,
  ReminderStatus,
  CustomFieldType,
  CrmEntityType,
} from '@skillancer/database';

// Re-export enums for convenience
export type {
  ClientType,
  ClientSource,
  ClientStatus,
  CompanySize,
  ContactRole,
  InteractionType,
  Sentiment,
  OpportunitySource,
  OpportunityStage,
  OpportunityStatus,
  CrmPriority,
  CrmDocumentType,
  ReminderType,
  ReminderStatus,
  CustomFieldType,
  CrmEntityType,
};

// ============================================================================
// ADDRESS TYPE
// ============================================================================

export interface ClientAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

// ============================================================================
// CLIENT TYPES
// ============================================================================

export interface CreateClientParams {
  freelancerUserId: string;
  clientType?: ClientType;
  source?: ClientSource;
  platformUserId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  alternateEmail?: string;
  alternatePhone?: string;
  companyName?: string;
  companyWebsite?: string;
  companySize?: CompanySize;
  industry?: string;
  jobTitle?: string;
  department?: string;
  address?: ClientAddress;
  timezone?: string;
  avatarUrl?: string;
  bio?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  preferredContactMethod?: string;
  communicationPreferences?: Record<string, unknown>;
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateClientParams extends Partial<Omit<CreateClientParams, 'freelancerUserId'>> {
  status?: ClientStatus;
  nextFollowUpAt?: Date;
}

export interface ClientSearchParams {
  freelancerUserId: string;
  query?: string;
  status?: ClientStatus[];
  tags?: string[];
  source?: ClientSource[];
  hasActiveProjects?: boolean;
  healthScoreMin?: number;
  healthScoreMax?: number;
  lastContactBefore?: Date;
  lastContactAfter?: Date;
  sortBy?: 'name' | 'lastContact' | 'lifetimeValue' | 'healthScore' | 'created';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ClientWithMetrics {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  clientType: ClientType;
  source: ClientSource;
  status: ClientStatus;
  avatarUrl: string | null;
  healthScore: number | null;
  lifetimeValue: number;
  totalProjects: number;
  activeProjects: number;
  lastContactAt: Date | null;
  lastProjectAt: Date | null;
  nextFollowUpAt: Date | null;
  tags: string[];
  createdAt: Date;
}

export interface ClientWithDetails extends ClientWithMetrics {
  alternateEmail: string | null;
  alternatePhone: string | null;
  companyWebsite: string | null;
  companySize: CompanySize | null;
  industry: string | null;
  jobTitle: string | null;
  department: string | null;
  address: ClientAddress | null;
  timezone: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  preferredContactMethod: string | null;
  communicationPreferences: Record<string, unknown> | null;
  customFields: Record<string, unknown> | null;
  internalNotes: string | null;
  avgRating: number | null;
  healthScoreUpdatedAt: Date | null;
  platformUserId: string | null;
  updatedAt: Date;
  archivedAt: Date | null;
  contacts: ClientContactSummary[];
  recentInteractions: ClientInteractionSummary[];
  upcomingReminders: ClientReminderSummary[];
}

export interface ClientStats {
  total: number;
  byStatus: Partial<Record<ClientStatus, number>>;
  bySource: Partial<Record<ClientSource, number>>;
  totalLifetimeValue: number;
  avgHealthScore: number;
  needsAttention: number;
  recentlyActive: number;
}

export interface SearchFacets {
  status: Array<{ value: ClientStatus; count: number }>;
  source: Array<{ value: ClientSource; count: number }>;
  tags: Array<{ value: string; count: number }>;
}

export interface ClientSearchResult {
  clients: ClientWithMetrics[];
  total: number;
  facets: SearchFacets;
}

// ============================================================================
// CLIENT CONTACT TYPES
// ============================================================================

export interface CreateContactParams {
  clientId: string;
  freelancerUserId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  role?: ContactRole;
  isPrimary?: boolean;
  notes?: string;
}

export interface UpdateContactParams extends Partial<
  Omit<CreateContactParams, 'clientId' | 'freelancerUserId'>
> {
  isActive?: boolean;
}

export interface ClientContactSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  role: ContactRole;
  isPrimary: boolean;
  isActive: boolean;
}

// ============================================================================
// CLIENT INTERACTION TYPES
// ============================================================================

export interface CreateInteractionParams {
  clientId: string;
  freelancerUserId: string;
  interactionType: InteractionType;
  subject?: string;
  description: string;
  occurredAt?: Date;
  duration?: number;
  outcome?: string;
  nextSteps?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
  attachments?: Array<{ name: string; url: string; type: string }>;
  sentiment?: Sentiment;
  opportunityId?: string;
  projectId?: string;
}

export interface InteractionSearchParams {
  clientId: string;
  interactionType?: InteractionType[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface ClientInteractionSummary {
  id: string;
  interactionType: InteractionType;
  subject: string | null;
  description: string;
  occurredAt: Date;
  duration: number | null;
  outcome: string | null;
  sentiment: Sentiment | null;
  followUpRequired: boolean;
  followUpDate: Date | null;
  createdAt: Date;
}

// ============================================================================
// OPPORTUNITY TYPES
// ============================================================================

export interface CreateOpportunityParams {
  freelancerUserId: string;
  clientId?: string;
  title: string;
  description?: string;
  source: OpportunitySource;
  sourceDetails?: string;
  externalUrl?: string;
  estimatedValue?: number;
  currency?: string;
  expectedCloseDate?: Date;
  stage?: OpportunityStage;
  priority?: CrmPriority;
  tags?: string[];
  serviceType?: string;
  notes?: string;
}

export interface UpdateOpportunityParams extends Partial<
  Omit<CreateOpportunityParams, 'freelancerUserId'>
> {
  probability?: number;
  status?: OpportunityStatus;
  lostReason?: string;
  wonContractId?: string;
  actualCloseDate?: Date;
}

export interface OpportunitySearchParams {
  freelancerUserId: string;
  clientId?: string;
  status?: OpportunityStatus[];
  stage?: OpportunityStage[];
  priority?: CrmPriority[];
  source?: OpportunitySource[];
  createdAfter?: Date;
  createdBefore?: Date;
  expectedCloseBefore?: Date;
  expectedCloseAfter?: Date;
  minValue?: number;
  maxValue?: number;
  tags?: string[];
  sortBy?: 'created' | 'expectedClose' | 'value' | 'probability';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface OpportunitySummary {
  id: string;
  title: string;
  description: string | null;
  source: OpportunitySource;
  stage: OpportunityStage;
  status: OpportunityStatus;
  priority: CrmPriority;
  estimatedValue: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: Date | null;
  actualCloseDate: Date | null;
  tags: string[];
  serviceType: string | null;
  clientId: string | null;
  client?: { id: string; displayName: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  stage: OpportunityStage;
  opportunities: OpportunitySummary[];
  count: number;
  totalValue: number;
  weightedValue: number;
}

export interface PipelineView {
  stages: PipelineStage[];
  summary: {
    totalOpportunities: number;
    totalValue: number;
    weightedValue: number;
    avgDealSize: number;
  };
}

export interface OpportunityStats {
  total: number;
  open: number;
  won: number;
  lost: number;
  winRate: number;
  totalWonValue: number;
  totalLostValue: number;
  totalOpenValue: number;
  avgDealSize: number;
  avgTimeToClose: number;
  bySource: Partial<Record<OpportunitySource, number>>;
  byStage: Partial<Record<OpportunityStage, number>>;
}

export interface OpportunityActivitySummary {
  id: string;
  activityType: string;
  description: string;
  fromStage: OpportunityStage | null;
  toStage: OpportunityStage | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export interface CreateDocumentParams {
  clientId: string;
  freelancerUserId: string;
  name: string;
  description?: string;
  documentType: CrmDocumentType;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tags?: string[];
  projectId?: string;
  contractId?: string;
}

export interface UpdateDocumentParams extends Partial<
  Omit<
    CreateDocumentParams,
    'clientId' | 'freelancerUserId' | 'fileUrl' | 'fileName' | 'fileSize' | 'mimeType'
  >
> {}

export interface DocumentSummary {
  id: string;
  name: string;
  description: string | null;
  documentType: CrmDocumentType;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tags: string[];
  projectId: string | null;
  contractId: string | null;
  createdAt: Date;
}

// ============================================================================
// REMINDER TYPES
// ============================================================================

export interface CreateReminderParams {
  clientId: string;
  freelancerUserId: string;
  title: string;
  description?: string;
  reminderType: ReminderType;
  dueAt: Date;
  isRecurring?: boolean;
  recurrenceRule?: string;
  notifyBefore?: number;
}

export interface UpdateReminderParams extends Partial<
  Omit<CreateReminderParams, 'clientId' | 'freelancerUserId'>
> {
  status?: ReminderStatus;
  completedAt?: Date;
  snoozedUntil?: Date;
}

export interface ReminderSearchParams {
  freelancerUserId: string;
  clientId?: string;
  status?: ReminderStatus[];
  reminderType?: ReminderType[];
  dueBefore?: Date;
  dueAfter?: Date;
  page?: number;
  limit?: number;
}

export interface ClientReminderSummary {
  id: string;
  title: string;
  description: string | null;
  reminderType: ReminderType;
  dueAt: Date;
  status: ReminderStatus;
  isRecurring: boolean;
  completedAt: Date | null;
  snoozedUntil: Date | null;
  client?: { id: string; displayName: string };
}

// ============================================================================
// CUSTOM FIELD TYPES
// ============================================================================

export interface CreateCustomFieldParams {
  freelancerUserId: string;
  entityType: CrmEntityType;
  fieldName: string;
  fieldLabel: string;
  fieldType: CustomFieldType;
  options?: string[];
  isRequired?: boolean;
  defaultValue?: string;
  displayOrder?: number;
  isVisible?: boolean;
}

export interface UpdateCustomFieldParams extends Partial<
  Omit<CreateCustomFieldParams, 'freelancerUserId' | 'entityType' | 'fieldName'>
> {}

export interface CustomFieldDefinition {
  id: string;
  entityType: CrmEntityType;
  fieldName: string;
  fieldLabel: string;
  fieldType: CustomFieldType;
  options: string[];
  isRequired: boolean;
  defaultValue: string | null;
  displayOrder: number;
  isVisible: boolean;
}

// ============================================================================
// HEALTH SCORE TYPES
// ============================================================================

export interface HealthScoreComponent {
  score: number;
  weight: number;
}

export interface HealthScoreBreakdown {
  overall: number;
  components: {
    recency: HealthScoreComponent;
    frequency: HealthScoreComponent;
    monetary: HealthScoreComponent;
    satisfaction: HealthScoreComponent;
    responsiveness: HealthScoreComponent;
  };
  recommendations: string[];
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface MarketSyncResult {
  imported: number;
  updated: number;
  errors: string[];
}
