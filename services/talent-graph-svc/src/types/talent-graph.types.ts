// Talent Graph Type Definitions

export enum RelationshipType {
  COWORKER = 'COWORKER',
  MANAGER = 'MANAGER',
  DIRECT_REPORT = 'DIRECT_REPORT',
  MENTOR = 'MENTOR',
  MENTEE = 'MENTEE',
  COLLABORATOR = 'COLLABORATOR',
  CLIENT = 'CLIENT',
  VENDOR = 'VENDOR',
}

export enum RelationshipStrength {
  STRONG = 'STRONG',
  MODERATE = 'MODERATE',
  WEAK = 'WEAK',
}

export enum IntroductionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

export enum TeamReunionStatus {
  PROPOSED = 'PROPOSED',
  CONFIRMED = 'CONFIRMED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Work Relationship Interfaces
export interface WorkRelationshipCreateInput {
  userId: string;
  relatedUserId: string;
  relationshipType: RelationshipType;
  company: string;
  startDate: Date;
  endDate?: Date;
  projectName?: string;
  skills?: string[];
  notes?: string;
}

export interface WorkRelationshipUpdateInput {
  relationshipType?: RelationshipType;
  strength?: RelationshipStrength;
  endDate?: Date;
  projectName?: string;
  skills?: string[];
  endorsement?: string;
  notes?: string;
}

// Warm Introduction Interfaces
export interface WarmIntroductionRequestInput {
  requesterId: string;
  targetUserId: string;
  introducerId: string;
  purpose: string;
  message?: string;
  context?: string;
}

export interface WarmIntroductionResponseInput {
  introductionId: string;
  accepted: boolean;
  message?: string;
}

// Team Reunion Interfaces
export interface TeamReunionCreateInput {
  creatorId: string;
  name: string;
  description?: string;
  company: string;
  projectName?: string;
  projectDescription?: string;
  proposedBudget?: number;
  proposedTimeline?: string;
  requiredSkills?: string[];
}

export interface TeamReunionMemberInput {
  teamReunionId: string;
  userId: string;
  proposedRole?: string;
  message?: string;
}

// Response Types
export interface NetworkStats {
  totalConnections: number;
  strongConnections: number;
  companiesWorkedWith: number;
  introductionsMade: number;
  introductionsReceived: number;
  teamReunionsJoined: number;
}

export interface ConnectionSuggestion {
  userId: string;
  name: string;
  avatarUrl?: string;
  mutualConnections: number;
  sharedCompanies: string[];
  sharedSkills: string[];
  suggestionReason: string;
}

export interface IntroductionPath {
  targetUserId: string;
  paths: IntroductionPathStep[][];
  shortestPathLength: number;
}

export interface IntroductionPathStep {
  userId: string;
  name: string;
  relationshipType: RelationshipType;
  company: string;
}
