// @ts-nocheck
/**
 * SkillPod Work Assistant
 * Context-aware AI assistant for freelancers working in SkillPod
 * Sprint M7: AI Work Assistant
 */

import { getLogger } from '@skillancer/logger';
import { getMetrics } from '@skillancer/metrics';

const logger = getLogger('work-assistant');
const metrics = getMetrics();

// =============================================================================
// TYPES
// =============================================================================

export type AssistanceMode = 'code_review' | 'writing' | 'design' | 'general';

export interface WorkContext {
  sessionId: string;
  contractId: string;
  currentApp: string;
  fileType?: string;
  language?: string;
  content?: string;
  cursorPosition?: { line: number; column: number };
}

export interface AssistantQuery {
  question: string;
  context: WorkContext;
  mode?: AssistanceMode;
}

export interface AssistantResponse {
  answer: string;
  suggestions?: Suggestion[];
  relatedActions?: Action[];
  confidence: number;
}

export interface Suggestion {
  id: string;
  type: 'improvement' | 'fix' | 'tip' | 'warning';
  title: string;
  description: string;
  code?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Action {
  id: string;
  label: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface UserFeedback {
  suggestionId: string;
  helpful: boolean;
  action: 'accepted' | 'modified' | 'rejected';
  comment?: string;
}

export interface AssistantSettings {
  enabled: boolean;
  autoSuggest: boolean;
  modes: AssistanceMode[];
  privacyLevel: 'strict' | 'balanced' | 'open';
  notificationFrequency: 'always' | 'important' | 'never';
}

// =============================================================================
// WORK ASSISTANT SERVICE
// =============================================================================

export class WorkAssistantService {
  private llmClient: LLMClient;
  private privacyFilter: PrivacyFilter;
  private settings: Map<string, AssistantSettings> = new Map();

  constructor(llmClient: LLMClient, privacyFilter: PrivacyFilter) {
    this.llmClient = llmClient;
    this.privacyFilter = privacyFilter;
  }

  // ---------------------------------------------------------------------------
  // QUERY HANDLING
  // ---------------------------------------------------------------------------

  /**
   * Handle a general assistant query
   */
  async query(query: AssistantQuery): Promise<AssistantResponse> {
    const { question, context, mode } = query;
    logger.info('Processing assistant query', { mode, app: context.currentApp });

    // Filter sensitive data before processing
    const sanitizedContext = await this.privacyFilter.sanitize(context);

    // Detect appropriate mode if not specified
    const effectiveMode = mode ?? this.detectMode(context);

    // Route to appropriate handler
    let response: AssistantResponse;
    switch (effectiveMode) {
      case 'code_review':
        response = await this.handleCodeQuery(question, sanitizedContext);
        break;
      case 'writing':
        response = await this.handleWritingQuery(question, sanitizedContext);
        break;
      case 'design':
        response = await this.handleDesignQuery(question, sanitizedContext);
        break;
      default:
        response = await this.handleGeneralQuery(question, sanitizedContext);
    }

    metrics.increment('work_assistant.query', { mode: effectiveMode });

    return response;
  }

  /**
   * Detect the appropriate assistance mode from context
   */
  private detectMode(context: WorkContext): AssistanceMode {
    const { currentApp, fileType, language } = context;

    // Code-related files
    const codeExtensions = ['js', 'ts', 'py', 'java', 'go', 'rb', 'php', 'cpp', 'c'];
    if (language || (fileType && codeExtensions.includes(fileType))) {
      return 'code_review';
    }

    // Writing-related apps
    const writingApps = ['word', 'docs', 'notion', 'markdown'];
    if (writingApps.some((app) => currentApp.toLowerCase().includes(app))) {
      return 'writing';
    }

    // Design-related apps
    const designApps = ['figma', 'sketch', 'photoshop', 'illustrator', 'xd'];
    if (designApps.some((app) => currentApp.toLowerCase().includes(app))) {
      return 'design';
    }

    return 'general';
  }

  // ---------------------------------------------------------------------------
  // MODE-SPECIFIC HANDLERS
  // ---------------------------------------------------------------------------

  private async handleCodeQuery(
    question: string,
    context: WorkContext
  ): Promise<AssistantResponse> {
    const prompt = this.buildCodePrompt(question, context);

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt: this.getCodeSystemPrompt(),
      temperature: 0.3,
      maxTokens: 2000,
    });

    return this.parseCodeResponse(response);
  }

  private async handleWritingQuery(
    question: string,
    context: WorkContext
  ): Promise<AssistantResponse> {
    const prompt = this.buildWritingPrompt(question, context);

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt: this.getWritingSystemPrompt(),
      temperature: 0.5,
      maxTokens: 1500,
    });

    return this.parseWritingResponse(response);
  }

  private async handleDesignQuery(
    question: string,
    context: WorkContext
  ): Promise<AssistantResponse> {
    const prompt = this.buildDesignPrompt(question, context);

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt: this.getDesignSystemPrompt(),
      temperature: 0.6,
      maxTokens: 1500,
    });

    return this.parseDesignResponse(response);
  }

  private async handleGeneralQuery(
    question: string,
    context: WorkContext
  ): Promise<AssistantResponse> {
    const prompt = `
Context: User is working in ${context.currentApp} on contract ${context.contractId}

Question: ${question}

Provide a helpful, concise answer.
`;

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt: `You are a helpful AI assistant for freelancers. 
Be concise and practical. Focus on actionable advice.
Do not discuss client confidential information.`,
      temperature: 0.5,
      maxTokens: 1000,
    });

    return {
      answer: response,
      confidence: 0.8,
    };
  }

  // ---------------------------------------------------------------------------
  // PROMPTS
  // ---------------------------------------------------------------------------

  private buildCodePrompt(question: string, context: WorkContext): string {
    return `
Language: ${context.language || 'unknown'}
Current file type: ${context.fileType || 'unknown'}

Code context (if available):
${context.content ? context.content.substring(0, 1000) : 'No code provided'}

Question: ${question}

Provide helpful guidance for this code-related question.
`;
  }

  private buildWritingPrompt(question: string, context: WorkContext): string {
    return `
Application: ${context.currentApp}

Text context (if available):
${context.content ? context.content.substring(0, 500) : 'No text provided'}

Question: ${question}

Provide writing assistance.
`;
  }

  private buildDesignPrompt(question: string, context: WorkContext): string {
    return `
Design application: ${context.currentApp}

Question: ${question}

Provide design guidance and best practices.
`;
  }

  private getCodeSystemPrompt(): string {
    return `You are an expert code reviewer and programming assistant.
Provide clear, actionable feedback on code.
Focus on:
- Correctness and bug prevention
- Best practices and patterns
- Performance considerations
- Security issues
- Readability and maintainability

Be specific with suggestions and provide code examples when helpful.`;
  }

  private getWritingSystemPrompt(): string {
    return `You are a professional writing assistant.
Help improve clarity, grammar, tone, and structure.
Adapt to the user's writing style and the document's purpose.
Be constructive and provide specific suggestions.`;
  }

  private getDesignSystemPrompt(): string {
    return `You are a design expert familiar with UI/UX principles.
Provide guidance on visual design, user experience, and design systems.
Focus on practical, implementable suggestions.`;
  }

  // ---------------------------------------------------------------------------
  // RESPONSE PARSING
  // ---------------------------------------------------------------------------

  private parseCodeResponse(response: string): AssistantResponse {
    // Parse structured response from LLM
    return {
      answer: response,
      suggestions: this.extractCodeSuggestions(response),
      relatedActions: [
        { id: '1', label: 'Apply fix', action: 'apply_fix', params: {} },
        { id: '2', label: 'Explain more', action: 'explain', params: {} },
      ],
      confidence: 0.85,
    };
  }

  private parseWritingResponse(response: string): AssistantResponse {
    return {
      answer: response,
      suggestions: this.extractWritingSuggestions(response),
      confidence: 0.8,
    };
  }

  private parseDesignResponse(response: string): AssistantResponse {
    return {
      answer: response,
      confidence: 0.75,
    };
  }

  private extractCodeSuggestions(response: string): Suggestion[] {
    // In production: Parse structured LLM output
    return [];
  }

  private extractWritingSuggestions(response: string): Suggestion[] {
    return [];
  }

  // ---------------------------------------------------------------------------
  // CONTEXTUAL SUGGESTIONS
  // ---------------------------------------------------------------------------

  /**
   * Get proactive suggestions based on current work
   */
  async getContextualSuggestions(context: WorkContext): Promise<Suggestion[]> {
    const mode = this.detectMode(context);

    if (!context.content) {
      return [];
    }

    const sanitizedContext = await this.privacyFilter.sanitize(context);

    switch (mode) {
      case 'code_review':
        return this.getCodeSuggestions(sanitizedContext);
      case 'writing':
        return this.getWritingSuggestions(sanitizedContext);
      default:
        return [];
    }
  }

  private async getCodeSuggestions(context: WorkContext): Promise<Suggestion[]> {
    // Quick static analysis + LLM for context-aware suggestions
    const suggestions: Suggestion[] = [];

    // Check for common issues in code
    if (context.content) {
      // Simple pattern checks (in production: use AST analysis)
      if (context.content.includes('console.log')) {
        suggestions.push({
          id: 'debug-log',
          type: 'tip',
          title: 'Debug logging detected',
          description: 'Consider removing console.log statements before committing',
          priority: 'low',
        });
      }

      if (context.content.includes('TODO')) {
        suggestions.push({
          id: 'todo-found',
          type: 'tip',
          title: 'TODO comment found',
          description: 'You have TODO comments that may need attention',
          priority: 'medium',
        });
      }
    }

    return suggestions;
  }

  private async getWritingSuggestions(context: WorkContext): Promise<Suggestion[]> {
    return [];
  }

  // ---------------------------------------------------------------------------
  // FEEDBACK
  // ---------------------------------------------------------------------------

  /**
   * Record user feedback on suggestions
   */
  async recordFeedback(feedback: UserFeedback): Promise<void> {
    logger.info('Recording feedback', {
      suggestionId: feedback.suggestionId,
      helpful: feedback.helpful,
      action: feedback.action,
    });

    metrics.increment('work_assistant.feedback', {
      helpful: String(feedback.helpful),
      action: feedback.action,
    });

    // Store for model improvement
    // In production: Send to feedback collection service
  }

  // ---------------------------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------------------------

  async getSettings(userId: string): Promise<AssistantSettings> {
    const cached = this.settings.get(userId);
    if (cached) return cached;

    // Default settings
    return {
      enabled: true,
      autoSuggest: true,
      modes: ['code_review', 'writing', 'general'],
      privacyLevel: 'balanced',
      notificationFrequency: 'important',
    };
  }

  async updateSettings(userId: string, settings: Partial<AssistantSettings>): Promise<void> {
    const current = await this.getSettings(userId);
    const updated = { ...current, ...settings };
    this.settings.set(userId, updated);

    logger.info('Updated assistant settings', { userId });
    // In production: Persist to database
  }
}

// =============================================================================
// INTERFACES
// =============================================================================

interface LLMClient {
  generate(params: {
    prompt: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  }): Promise<string>;
}

interface PrivacyFilter {
  sanitize(context: WorkContext): Promise<WorkContext>;
}

// =============================================================================
// FACTORY
// =============================================================================

let service: WorkAssistantService | null = null;

export function getWorkAssistantService(): WorkAssistantService {
  if (!service) {
    // In production: Initialize with real dependencies
    const mockLLM: LLMClient = {
      async generate(params) {
        return 'AI response placeholder';
      },
    };

    const mockPrivacyFilter: PrivacyFilter = {
      async sanitize(context) {
        return context;
      },
    };

    service = new WorkAssistantService(mockLLM, mockPrivacyFilter);
  }
  return service;
}
