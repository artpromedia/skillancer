// Executive Suite Type Definitions

export enum ExecutiveType {
  FRACTIONAL_CTO = 'FRACTIONAL_CTO',
  FRACTIONAL_CFO = 'FRACTIONAL_CFO',
  FRACTIONAL_CMO = 'FRACTIONAL_CMO',
  FRACTIONAL_CISO = 'FRACTIONAL_CISO',
  FRACTIONAL_COO = 'FRACTIONAL_COO',
  FRACTIONAL_CHRO = 'FRACTIONAL_CHRO',
  FRACTIONAL_CPO = 'FRACTIONAL_CPO',
  FRACTIONAL_CRO = 'FRACTIONAL_CRO',
  BOARD_ADVISOR = 'BOARD_ADVISOR',
  INTERIM_EXECUTIVE = 'INTERIM_EXECUTIVE',
}

export enum ExecutiveVettingStatus {
  PENDING = 'PENDING',
  APPLICATION_REVIEW = 'APPLICATION_REVIEW',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_COMPLETED = 'INTERVIEW_COMPLETED',
  REFERENCE_CHECK = 'REFERENCE_CHECK',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum BackgroundCheckStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum ExecutiveEngagementStatus {
  PROPOSAL = 'PROPOSAL',
  NEGOTIATING = 'NEGOTIATING',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED',
}

export enum ExecutiveBillingCycle {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

export enum ExecutiveTier {
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export interface ExecutiveProfileCreateInput {
  userId: string;
  executiveType: ExecutiveType;
  headline: string;
  executiveSummary?: string;
  yearsExecutiveExp: number;
  industries?: string[];
  specializations?: string[];
  companyStagesExpertise?: string[];
  pastRoles?: ExecutivePastRole[];
  notableAchievements?: string[];
  boardExperience?: boolean;
  publicCompanyExp?: boolean;
  hoursPerWeekAvailable?: number;
  monthlyRetainerMin?: number;
  monthlyRetainerMax?: number;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  equityOpenTo?: boolean;
  linkedinUrl?: string;
}

export interface ExecutivePastRole {
  title: string;
  company: string;
  duration: string;
  achievements: string[];
}

export interface ExecutiveProfileUpdateInput {
  headline?: string;
  executiveSummary?: string;
  yearsExecutiveExp?: number;
  industries?: string[];
  specializations?: string[];
  companyStagesExpertise?: string[];
  pastRoles?: ExecutivePastRole[];
  notableAchievements?: string[];
  boardExperience?: boolean;
  publicCompanyExp?: boolean;
  maxClients?: number;
  hoursPerWeekAvailable?: number;
  availableFrom?: Date;
  monthlyRetainerMin?: number;
  monthlyRetainerMax?: number;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  equityOpenTo?: boolean;
  linkedinUrl?: string;
  searchable?: boolean;
}

export interface ExecutiveSearchFilters {
  executiveType?: ExecutiveType;
  industries?: string[];
  specializations?: string[];
  companyStages?: string[];
  minExperience?: number;
  maxHourlyRate?: number;
  maxMonthlyRetainer?: number;
  availableNow?: boolean;
  hasBackgroundCheck?: boolean;
  boardExperience?: boolean;
  publicCompanyExp?: boolean;
}

export interface ExecutiveEngagementCreateInput {
  executiveProfileId: string;
  clientTenantId: string;
  clientUserId: string;
  role: ExecutiveType;
  title: string;
  description?: string;
  hoursPerWeek: number;
  startDate?: Date;
  expectedEndDate?: Date;
  monthlyRetainer?: number;
  hourlyRate?: number;
  billingCycle?: ExecutiveBillingCycle;
  equityPercentage?: number;
  objectives?: ExecutiveObjective[];
  successMetrics?: SuccessMetric[];
}

export interface ExecutiveObjective {
  title: string;
  description: string;
  keyResults: KeyResult[];
  dueDate?: Date;
}

export interface KeyResult {
  title: string;
  target: string;
  current?: string;
  unit?: string;
}

export interface SuccessMetric {
  name: string;
  target: string;
  measurement: string;
}

export interface ExecutiveEngagementUpdateInput {
  title?: string;
  description?: string;
  status?: ExecutiveEngagementStatus;
  hoursPerWeek?: number;
  endDate?: Date;
  expectedEndDate?: Date;
  monthlyRetainer?: number;
  hourlyRate?: number;
  billingCycle?: ExecutiveBillingCycle;
  equityPercentage?: number;
  objectives?: ExecutiveObjective[];
  successMetrics?: SuccessMetric[];
  workspaceConfig?: Record<string, unknown>;
}

export interface ExecutiveTimeEntryInput {
  engagementId: string;
  date: Date;
  hours: number;
  description?: string;
  category?: string;
  billable?: boolean;
}

export interface ExecutiveMilestoneInput {
  engagementId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  deliverables?: string[];
  successCriteria?: string;
}

export interface ExecutiveReferenceInput {
  referenceName: string;
  referenceTitle: string;
  referenceCompany: string;
  referenceEmail: string;
  referencePhone?: string;
  relationshipType: string;
}

export interface ExecutiveVettingDecision {
  status: ExecutiveVettingStatus;
  notes?: string;
  interviewScore?: number;
  interviewNotes?: string;
}

export interface ExecutiveToolBundle {
  bundleType: string;
  tools: ExecutiveTool[];
}

export interface ExecutiveTool {
  id: string;
  name: string;
  category: string;
  description: string;
  iconUrl?: string;
  isConnected: boolean;
  lastSyncAt?: Date;
}

export interface ExecutiveDashboardWidget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config?: Record<string, unknown>;
}

export interface ExecutiveWorkspaceConfig {
  dashboardLayout: ExecutiveDashboardWidget[];
  enabledWidgets: string[];
  widgetSettings: Record<string, unknown>;
  pinnedDocuments: string[];
  favoriteActions: string[];
  quickLinks: { title: string; url: string }[];
}
