// @ts-nocheck
/**
 * Containment-Aware AI Proxy
 * Routes AI calls through secure containment
 * Sprint M7: AI Work Assistant
 */

import { getLogger } from '@skillancer/logger';
import { getMetrics } from '@skillancer/metrics';

import { type PrivacyFilter, createPrivacyFilter, FilterResult } from './privacy-filter.js';
import { CrisisPreFilter, createPreFilter, type UserContext as CrisisUserContext, CRISIS_RESOURCES } from './preFilter.js';

const logger = getLogger('containment-ai-proxy');
const metrics = getMetrics();

// =============================================================================
// TYPES
// =============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'local' | 'hybrid';

export interface AIRequest {
  type: 'completion' | 'chat' | 'embedding' | 'code_review' | 'writing_check';
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  sessionId: string;
  userId: string;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  provider: AIProvider;
  processingTime: number;
  cached: boolean;
  crisisDetected?: boolean;
  crisisResources?: string;
  crisisMessage?: string;
}

export interface ProxyConfig {
  defaultProvider: AIProvider;
  localModelEndpoint?: string;
  cloudProviders: {
    openai?: { apiKey: string; model: string };
    anthropic?: { apiKey: string; model: string };
  };
  privacyFirst: boolean;
  maxContextLength: number;
  cacheEnabled: boolean;
  cacheTTLSeconds: number;
  enableCrisisDetection?: boolean;
}

export interface ContainmentContext {
  sessionId: string;
  podId: string;
  contractId: string;
  containmentLevel: 'strict' | 'standard' | 'relaxed';
  allowedOperations: string[];
  // User context for crisis detection
  userId: string;
  isMinor?: boolean;
  parentGuardianId?: string;
  schoolId?: string;
  tenantId?: string;
}

// =============================================================================
// CONTAINMENT AI PROXY
// =============================================================================

export class ContainmentAIProxy {
  private privacyFilter: PrivacyFilter;
  private crisisFilter: CrisisPreFilter;
  private config: ProxyConfig;
  private cache: Map<string, { response: AIResponse; expiry: number }> = new Map();
  private requestQueue: Map<string, Promise<AIResponse>> = new Map();

  constructor(config: ProxyConfig) {
    this.config = config;
    this.privacyFilter = createPrivacyFilter({
      enablePII: true,
      enableFinancial: true,
      enableCredentials: true,
      enableHealth: true,
      redactionMethod: 'placeholder',
    });
    this.crisisFilter = createPreFilter({
      enableCrisisDetection: config.enableCrisisDetection ?? true,
      enableParentNotification: true,
      parentNotificationThreshold: 'high',
      blockHighSeverity: false,
      auditAllDetections: true,
    });
  }

  // ---------------------------------------------------------------------------
  // MAIN REQUEST HANDLING
  // ---------------------------------------------------------------------------

  /**
   * Route AI request through containment proxy
   */
  async request(request: AIRequest, containment: ContainmentContext): Promise<AIResponse> {
    const startTime = Date.now();

    logger.info('Processing AI request', {
      type: request.type,
      sessionId: request.sessionId,
      containmentLevel: containment.containmentLevel,
    });

    try {
      // Step 0: Crisis detection (pre-filter)
      const crisisUserContext: CrisisUserContext = {
        userId: containment.userId,
        sessionId: containment.sessionId,
        isMinor: containment.isMinor ?? false,
        parentGuardianId: containment.parentGuardianId,
        schoolId: containment.schoolId,
        tenantId: containment.tenantId,
      };

      const crisisResult = await this.crisisFilter.analyze(request.prompt, crisisUserContext);

      // If crisis detected, include resources in response
      let crisisInfo: { crisisDetected?: boolean; crisisResources?: string; crisisMessage?: string } = {};
      if (crisisResult.crisisDetection) {
        crisisInfo = {
          crisisDetected: true,
          crisisResources: CrisisPreFilter.formatResourcesForDisplay(crisisResult.crisisDetection.response.resources),
          crisisMessage: crisisResult.crisisDetection.response.message,
        };

        logger.warn('Crisis content detected in AI request', {
          userId: containment.userId,
          severity: crisisResult.crisisDetection.severity,
          categories: crisisResult.crisisDetection.categories,
          auditId: crisisResult.crisisDetection.auditId,
        });

        // If content was blocked, return early with crisis resources
        if (crisisResult.wasBlocked) {
          return {
            content: crisisResult.crisisDetection.response.message,
            tokensUsed: 0,
            provider: 'local',
            processingTime: Date.now() - startTime,
            cached: false,
            ...crisisInfo,
          };
        }
      }

      // Step 1: Validate containment permissions
      this.validateContainmentPermissions(request, containment);

      // Step 2: Filter sensitive data
      const filteredRequest = await this.filterRequest(request);

      // Step 3: Check cache
      const cacheKey = this.getCacheKey(filteredRequest);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('Returning cached response', { cacheKey });
        return { ...cached, cached: true, ...crisisInfo };
      }

      // Step 4: Deduplicate concurrent requests
      const existingRequest = this.requestQueue.get(cacheKey);
      if (existingRequest) {
        logger.debug('Waiting for existing request', { cacheKey });
        return await existingRequest;
      }

      // Step 5: Route to appropriate provider
      const responsePromise = this.routeToProvider(filteredRequest, containment);
      this.requestQueue.set(cacheKey, responsePromise);

      try {
        const response = await responsePromise;

        // Step 6: Filter response
        const filteredResponse = await this.filterResponse(response);

        // Step 7: Cache response
        if (this.config.cacheEnabled) {
          this.setCache(cacheKey, filteredResponse);
        }

        // Metrics
        const processingTime = Date.now() - startTime;
        metrics.histogram('ai_proxy_request_duration', processingTime, {
          type: request.type,
          provider: filteredResponse.provider,
        });

        return {
          ...filteredResponse,
          processingTime,
          cached: false,
          ...crisisInfo,
        };
      } finally {
        this.requestQueue.delete(cacheKey);
      }
    } catch (error) {
      logger.error('AI request failed', {
        error,
        sessionId: request.sessionId,
      });
      metrics.increment('ai_proxy_errors', { type: request.type });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // CONTAINMENT VALIDATION
  // ---------------------------------------------------------------------------

  private validateContainmentPermissions(
    request: AIRequest,
    containment: ContainmentContext
  ): void {
    // Check if AI operations are allowed in this containment
    const operationMap: Record<string, string> = {
      completion: 'ai_completion',
      chat: 'ai_chat',
      embedding: 'ai_embedding',
      code_review: 'ai_code_review',
      writing_check: 'ai_writing_check',
    };

    const requiredOperation = operationMap[request.type];
    if (!containment.allowedOperations.includes(requiredOperation)) {
      throw new Error(
        `AI operation ${request.type} not allowed in containment level ${containment.containmentLevel}`
      );
    }

    // Validate session matches containment
    if (request.sessionId !== containment.sessionId) {
      throw new Error('Session ID mismatch with containment context');
    }
  }

  // ---------------------------------------------------------------------------
  // DATA FILTERING
  // ---------------------------------------------------------------------------

  private async filterRequest(request: AIRequest): Promise<AIRequest> {
    // Filter prompt
    const promptResult = await this.privacyFilter.sanitize(request.prompt, {
      sessionId: request.sessionId,
      userId: request.userId,
    });

    // Filter context if present
    let filteredContext: string | undefined;
    if (request.context) {
      const contextResult = await this.privacyFilter.sanitize(request.context, {
        sessionId: request.sessionId,
        userId: request.userId,
      });
      filteredContext = contextResult.sanitizedContent;
    }

    // Log if sensitive data was detected
    if (promptResult.wasModified) {
      logger.info('Sensitive data filtered from request', {
        sessionId: request.sessionId,
        itemsRedacted: promptResult.detectedItems.length,
        complianceFlags: promptResult.complianceFlags,
      });
    }

    return {
      ...request,
      prompt: promptResult.sanitizedContent,
      context: filteredContext,
    };
  }

  private async filterResponse(response: AIResponse): Promise<AIResponse> {
    // Filter response content for any sensitive data that might have been generated
    const result = await this.privacyFilter.sanitize(response.content);

    if (result.wasModified) {
      logger.warn('Sensitive data filtered from AI response', {
        itemsRedacted: result.detectedItems.length,
      });
    }

    return {
      ...response,
      content: result.sanitizedContent,
    };
  }

  // ---------------------------------------------------------------------------
  // PROVIDER ROUTING
  // ---------------------------------------------------------------------------

  private async routeToProvider(
    request: AIRequest,
    containment: ContainmentContext
  ): Promise<AIResponse> {
    // Determine best provider based on containment and privacy settings
    const provider = this.selectProvider(request, containment);

    logger.debug('Routing to provider', { provider, type: request.type });

    switch (provider) {
      case 'local':
        return this.callLocalModel(request);

      case 'openai':
        return this.callOpenAI(request);

      case 'anthropic':
        return this.callAnthropic(request);

      case 'hybrid':
        return this.callHybrid(request, containment);

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private selectProvider(request: AIRequest, containment: ContainmentContext): AIProvider {
    // Strict containment = local model only
    if (containment.containmentLevel === 'strict') {
      return 'local';
    }

    // Privacy-first mode prefers local
    if (this.config.privacyFirst) {
      if (this.isLocalModelCapable(request.type)) {
        return 'local';
      }
      // Fall back to hybrid with extra filtering
      return 'hybrid';
    }

    // Default to configured provider
    return this.config.defaultProvider;
  }

  private isLocalModelCapable(requestType: string): boolean {
    // Local models can handle basic tasks
    const localCapable = ['code_review', 'writing_check', 'embedding'];
    return localCapable.includes(requestType);
  }

  // ---------------------------------------------------------------------------
  // PROVIDER IMPLEMENTATIONS
  // ---------------------------------------------------------------------------

  private async callLocalModel(request: AIRequest): Promise<AIResponse> {
    if (!this.config.localModelEndpoint) {
      throw new Error('Local model endpoint not configured');
    }

    const startTime = Date.now();

    // Call local model (e.g., Ollama, local LLaMA)
    const response = await fetch(this.config.localModelEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        context: request.context,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Local model error: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      content: result.response || result.text || '',
      tokensUsed: result.tokens_used || 0,
      provider: 'local',
      processingTime: Date.now() - startTime,
      cached: false,
    };
  }

  private async callOpenAI(request: AIRequest): Promise<AIResponse> {
    const config = this.config.cloudProviders.openai;
    if (!config) {
      throw new Error('OpenAI not configured');
    }

    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant for freelancers.' },
          { role: 'user', content: request.prompt },
        ],
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI error: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();

    return {
      content: result.choices[0]?.message?.content || '',
      tokensUsed: result.usage?.total_tokens || 0,
      provider: 'openai',
      processingTime: Date.now() - startTime,
      cached: false,
    };
  }

  private async callAnthropic(request: AIRequest): Promise<AIResponse> {
    const config = this.config.cloudProviders.anthropic;
    if (!config) {
      throw new Error('Anthropic not configured');
    }

    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: request.maxTokens || 1000,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic error: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();

    return {
      content: result.content[0]?.text || '',
      tokensUsed: result.usage?.input_tokens + result.usage?.output_tokens || 0,
      provider: 'anthropic',
      processingTime: Date.now() - startTime,
      cached: false,
    };
  }

  private async callHybrid(
    request: AIRequest,
    containment: ContainmentContext
  ): Promise<AIResponse> {
    // Hybrid approach: Use local for sensitive preprocessing, cloud for final

    // Step 1: Generate synthetic context (no real client data)
    const syntheticContext = this.generateSyntheticContext(request);

    // Step 2: Call cloud with synthetic context
    const modifiedRequest = {
      ...request,
      context: syntheticContext,
    };

    // Use OpenAI or Anthropic based on availability
    if (this.config.cloudProviders.openai) {
      return this.callOpenAI(modifiedRequest);
    } else if (this.config.cloudProviders.anthropic) {
      return this.callAnthropic(modifiedRequest);
    } else {
      return this.callLocalModel(modifiedRequest);
    }
  }

  private generateSyntheticContext(request: AIRequest): string {
    // Generate a synthetic version of the context that conveys
    // the structure and intent without real client data

    // This is a placeholder - in production, this would use
    // sophisticated anonymization techniques
    return `[Synthetic context for ${request.type} request]`;
  }

  // ---------------------------------------------------------------------------
  // CACHING
  // ---------------------------------------------------------------------------

  private getCacheKey(request: AIRequest): string {
    const hash = this.hashString(`${request.type}:${request.prompt}:${request.context || ''}`);
    return `ai_cache:${hash}`;
  }

  private getFromCache(key: string): AIResponse | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.response;
  }

  private setCache(key: string, response: AIResponse): void {
    const expiry = Date.now() + this.config.cacheTTLSeconds * 1000;
    this.cache.set(key, { response, expiry });

    // Cleanup old entries periodically
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiry) {
        this.cache.delete(key);
      }
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  /**
   * Get proxy statistics
   */
  getStats(): {
    cacheSize: number;
    pendingRequests: number;
    providers: string[];
  } {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.requestQueue.size,
      providers: Object.keys(this.config.cloudProviders),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('AI proxy cache cleared');
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createContainmentAIProxy(config: ProxyConfig): ContainmentAIProxy {
  return new ContainmentAIProxy(config);
}

