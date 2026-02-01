/**
 * SkillPod AI Client
 * Client library for SkillPod Work Assistant
 * Sprint M7: AI Work Assistant
 */

// =============================================================================
// TYPES
// =============================================================================

export interface WorkContext {
  sessionId: string;
  contractId: string;
  currentApp: string;
  fileType?: string;
  language?: string;
  content?: string;
  cursorPosition?: { line: number; column: number };
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

export interface CodeReviewResult {
  issues: CodeIssue[];
  summary: {
    totalIssues: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    overallQuality: number;
    strengths: string[];
    areasToImprove: string[];
  };
  suggestions: CodeSuggestion[];
  documentation?: {
    summary: string;
    parameters?: Array<{ name: string; type: string; description: string }>;
    returns?: string;
    examples?: string[];
  };
}

export interface CodeIssue {
  id: string;
  category: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  title: string;
  description: string;
  line: number;
  column?: number;
  suggestedFix?: string;
}

export interface CodeSuggestion {
  id: string;
  type: 'refactor' | 'simplify' | 'optimize' | 'modernize';
  title: string;
  description: string;
  originalCode: string;
  suggestedCode: string;
  lineStart: number;
  lineEnd: number;
  impact: 'low' | 'medium' | 'high';
}

export interface WritingCheckResult {
  issues: WritingIssue[];
  suggestions: WritingSuggestion[];
  alternatives: Array<{
    original: string;
    alternatives: string[];
  }>;
  overallScore: number;
}

export interface WritingIssue {
  id: string;
  category: 'grammar' | 'spelling' | 'style' | 'clarity' | 'tone';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  position: { start: number; end: number };
  suggestedFix?: string;
}

export interface WritingSuggestion {
  id: string;
  type: 'tone' | 'clarity' | 'structure' | 'vocabulary';
  title: string;
  description: string;
  original: string;
  improved: string;
}

export interface AssistantSettings {
  enabled: boolean;
  autoSuggest: boolean;
  modes: Array<'code_review' | 'writing' | 'design' | 'general'>;
  privacyLevel: 'strict' | 'balanced' | 'open';
  notificationFrequency: 'always' | 'important' | 'never';
}

export interface AIFeedback {
  suggestionId: string;
  helpful: boolean;
  action: 'accepted' | 'modified' | 'rejected';
  comment?: string;
}

// =============================================================================
// API CLIENT
// =============================================================================

class SkillPodAIClient {
  private readonly baseUrl: string;
  private sessionId: string | null = null;
  private authToken: string | null = null;

  constructor(baseUrl: string = '/api/ai/assistant') {
    this.baseUrl = baseUrl;
  }

  setSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private async fetch<T>(
    endpoint: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // ASSISTANT QUERIES
  // ---------------------------------------------------------------------------

  /**
   * Query the AI assistant
   */
  async queryAssistant(question: string, context: WorkContext): Promise<AssistantResponse> {
    return this.fetch<AssistantResponse>('/query', {
      method: 'POST',
      body: {
        question,
        context,
        mode: this.inferMode(context),
      },
    });
  }

  /**
   * Get contextual suggestions based on current work
   */
  async getContextualSuggestions(context?: string): Promise<Suggestion[]> {
    const params = new URLSearchParams();
    if (this.sessionId) params.set('sessionId', this.sessionId);
    if (context) params.set('context', context);

    const result = await this.fetch<{ suggestions: Suggestion[] }>(
      `/contextual-suggestions?${params}`
    );
    return result.suggestions;
  }

  // ---------------------------------------------------------------------------
  // CODE REVIEW
  // ---------------------------------------------------------------------------

  /**
   * Review code for issues and improvements
   */
  async reviewCode(
    code: string,
    language: string,
    reviewType: 'full' | 'security' | 'performance' | 'style' = 'full'
  ): Promise<CodeReviewResult> {
    return this.fetch<CodeReviewResult>('/code-review', {
      method: 'POST',
      body: {
        code,
        language,
        sessionId: this.sessionId,
        reviewType,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // WRITING CHECK
  // ---------------------------------------------------------------------------

  /**
   * Check writing for grammar, tone, and clarity
   */
  async checkWriting(
    text: string,
    mode: 'formal' | 'casual' | 'technical' | 'marketing' = 'formal',
    checkType: 'grammar' | 'tone' | 'clarity' | 'all' = 'all'
  ): Promise<WritingCheckResult> {
    return this.fetch<WritingCheckResult>('/writing-check', {
      method: 'POST',
      body: {
        text,
        mode,
        sessionId: this.sessionId,
        checkType,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------------------------

  /**
   * Get user's AI assistant settings
   */
  async getSettings(): Promise<AssistantSettings> {
    return this.fetch<AssistantSettings>('/settings');
  }

  /**
   * Update AI assistant settings
   */
  async updateSettings(settings: AssistantSettings): Promise<void> {
    await this.fetch('/settings', {
      method: 'PUT',
      body: settings,
    });
  }

  // ---------------------------------------------------------------------------
  // FEEDBACK
  // ---------------------------------------------------------------------------

  /**
   * Submit feedback on a suggestion
   */
  async submitFeedback(feedback: AIFeedback): Promise<void> {
    await this.fetch('/feedback', {
      method: 'POST',
      body: feedback,
    });
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  private inferMode(context: WorkContext): string {
    if (
      context.language ||
      (context.fileType && /\.(js|ts|py|java|go|rb|php)$/.exec(context.fileType))
    ) {
      return 'code_review';
    }
    if (context.fileType && /\.(md|txt|doc|docx)$/.exec(context.fileType)) {
      return 'writing';
    }
    if (context.fileType && /\.(figma|sketch|psd|ai)$/.exec(context.fileType)) {
      return 'design';
    }
    return 'general';
  }
}

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';

export function useSkillPodAI(sessionId?: string) {
  const client = useMemo(() => {
    const c = new SkillPodAIClient();
    if (sessionId) c.setSession(sessionId);
    return c;
  }, [sessionId]);

  return {
    queryAssistant: client.queryAssistant.bind(client),
    getContextualSuggestions: client.getContextualSuggestions.bind(client),
    reviewCode: client.reviewCode.bind(client),
    checkWriting: client.checkWriting.bind(client),
    getSettings: client.getSettings.bind(client),
    updateSettings: client.updateSettings.bind(client),
    submitFeedback: client.submitFeedback.bind(client),
  };
}

export function useCodeReview(sessionId?: string) {
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useSkillPodAI(sessionId);

  const review = useCallback(
    async (
      code: string,
      language: string,
      reviewType?: 'full' | 'security' | 'performance' | 'style'
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await client.reviewCode(code, language, reviewType);
        setResult(res);
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Review failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return { result, isLoading, error, review };
}

export function useWritingCheck(sessionId?: string) {
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useSkillPodAI(sessionId);

  const check = useCallback(
    async (text: string, mode?: 'formal' | 'casual' | 'technical' | 'marketing') => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await client.checkWriting(text, mode);
        setResult(res);
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Check failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return { result, isLoading, error, check };
}

export function useAssistantSettings(sessionId?: string) {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const client = useSkillPodAI(sessionId);

  useEffect(() => {
    client
      .getSettings()
      .then(setSettings)
      .catch(() => {
        // Use defaults
        setSettings({
          enabled: true,
          autoSuggest: true,
          modes: ['code_review', 'writing', 'general'],
          privacyLevel: 'balanced',
          notificationFrequency: 'important',
        });
      })
      .finally(() => setIsLoading(false));
  }, [client]);

  const update = useCallback(
    async (newSettings: AssistantSettings) => {
      await client.updateSettings(newSettings);
      setSettings(newSettings);
    },
    [client]
  );

  return { settings, isLoading, update };
}

interface SendMessageResponse {
  message: string;
  suggestions?: string[];
  codeBlocks?: Array<{
    language: string;
    code: string;
  }>;
}

export function useSkillPodAssistant(sessionId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const client = useSkillPodAI(sessionId);

  // Simulate connection state
  useEffect(() => {
    const timer = setTimeout(() => setIsConnected(true), 500);
    return () => clearTimeout(timer);
  }, [sessionId]);

  const sendMessage = useCallback(
    async (message: string): Promise<SendMessageResponse> => {
      setIsLoading(true);
      try {
        const response = await client.queryAssistant(message, {
          sessionId,
          applicationContext: 'skillpod-assistant',
        });
        return {
          message: response.answer,
          suggestions: response.suggestions?.map((s) => s.title),
          codeBlocks: response.suggestions
            ?.filter((s) => s.code)
            .map((s) => ({
              language: 'typescript',
              code: s.code || '',
            })),
        };
      } finally {
        setIsLoading(false);
      }
    },
    [client, sessionId]
  );

  return { sendMessage, isConnected, isLoading };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const skillPodAIClient = new SkillPodAIClient();
export { SkillPodAIClient };
