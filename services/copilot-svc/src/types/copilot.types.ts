// AI Copilot Type Definitions

export enum InteractionType {
  PROPOSAL_DRAFT = 'PROPOSAL_DRAFT',
  PROPOSAL_REVIEW = 'PROPOSAL_REVIEW',
  MESSAGE_ASSIST = 'MESSAGE_ASSIST',
  RATE_SUGGEST = 'RATE_SUGGEST',
  SKILL_MATCH = 'SKILL_MATCH',
  MARKET_INSIGHT = 'MARKET_INSIGHT',
  CONTRACT_REVIEW = 'CONTRACT_REVIEW',
  PROFILE_OPTIMIZE = 'PROFILE_OPTIMIZE',
}

export enum ProposalDraftStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum SuggestionType {
  RATE_ADJUSTMENT = 'RATE_ADJUSTMENT',
  SKILL_HIGHLIGHT = 'SKILL_HIGHLIGHT',
  TONE_IMPROVEMENT = 'TONE_IMPROVEMENT',
  LENGTH_ADJUSTMENT = 'LENGTH_ADJUSTMENT',
  CALL_TO_ACTION = 'CALL_TO_ACTION',
  PERSONALIZATION = 'PERSONALIZATION',
}

// Copilot Interaction Interfaces
export interface CopilotInteractionInput {
  userId: string;
  interactionType: InteractionType;
  inputContext: InputContext;
}

export interface InputContext {
  jobId?: string;
  jobTitle?: string;
  jobDescription?: string;
  clientName?: string;
  clientIndustry?: string;
  budget?: { min: number; max: number };
  duration?: string;
  requiredSkills?: string[];
  userSkills?: string[];
  previousMessages?: string[];
  draftContent?: string;
  additionalNotes?: string;
}

export interface CopilotResponse {
  interactionId: string;
  content: string;
  suggestions: Suggestion[];
  confidence: number;
  tokensUsed: number;
  processingTime: number;
}

export interface Suggestion {
  type: SuggestionType;
  description: string;
  originalText?: string;
  suggestedText?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Proposal Draft Interfaces
export interface ProposalDraftInput {
  userId: string;
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  clientName?: string;
  clientIndustry?: string;
  budget?: { min: number; max: number };
  requiredSkills: string[];
  userSkills: string[];
  proposedRate?: number;
  proposedTimeline?: string;
  tone?: 'PROFESSIONAL' | 'FRIENDLY' | 'FORMAL';
  emphasis?: string[];
}

export interface ProposalDraftResult {
  draftId: string;
  content: string;
  coverLetter: string;
  keyPoints: string[];
  suggestedRate: number;
  rateJustification: string;
  estimatedWinRate: number;
  improvements: ProposalImprovement[];
}

export interface ProposalImprovement {
  section: string;
  current: string;
  suggested: string;
  reason: string;
}

// Rate Suggestion Interfaces
export interface RateSuggestionInput {
  userId: string;
  skills: string[];
  experience: number;
  location?: string;
  industry?: string;
  projectType?: string;
  projectComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RateSuggestionResult {
  suggestedHourlyRate: { min: number; max: number; optimal: number };
  suggestedProjectRate?: { min: number; max: number; optimal: number };
  marketPosition: 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET';
  competitorRange: { min: number; max: number };
  factors: RateFactor[];
  recommendations: string[];
}

export interface RateFactor {
  factor: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  weight: number;
  explanation: string;
}

// Message Assist Interfaces
export interface MessageAssistInput {
  userId: string;
  conversationContext: string[];
  draftMessage?: string;
  intent?: 'NEGOTIATE' | 'CLARIFY' | 'DECLINE' | 'ACCEPT' | 'FOLLOW_UP';
  tone?: 'PROFESSIONAL' | 'FRIENDLY' | 'ASSERTIVE';
}

export interface MessageAssistResult {
  suggestedMessage: string;
  alternativeVersions: string[];
  toneAnalysis: {
    current: string;
    recommended: string;
  };
  keyPointsCovered: string[];
  missingPoints: string[];
}

// Profile Optimization Interfaces
export interface ProfileOptimizeInput {
  userId: string;
  currentHeadline?: string;
  currentSummary?: string;
  skills: string[];
  experience: any[];
  targetRoles?: string[];
  targetIndustries?: string[];
}

export interface ProfileOptimizeResult {
  optimizedHeadline: string;
  optimizedSummary: string;
  skillsToHighlight: string[];
  skillsToAdd: string[];
  keywordSuggestions: string[];
  completenessScore: number;
  improvements: {
    section: string;
    suggestion: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

// Market Insight Interfaces
export interface MarketInsightInput {
  skills: string[];
  industry?: string;
  location?: string;
  projectType?: string;
}

export interface MarketInsightResult {
  demandLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  demandTrend: 'RISING' | 'STABLE' | 'FALLING';
  averageRate: { hourly: number; project: number };
  competitionLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  topCompetitors: number;
  skillGaps: string[];
  emergingSkills: string[];
  marketTips: string[];
}
