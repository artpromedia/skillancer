// @ts-nocheck
/**
 * AI Assistant Routes
 * API endpoints for SkillPod AI assistant
 * Sprint M7: AI Work Assistant
 */

import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@skillancer/logger';
import { getMetrics } from '@skillancer/metrics';
import { Hono } from 'hono';
import { z } from 'zod';

import { createContainmentAIProxy } from '../ai/containment-ai-proxy.js';
import { createPrivacyFilter } from '../ai/privacy-filter.js';

import type { CodeReviewAssistant } from '../ai/code-review-assistant.js';
import type { WorkAssistantService } from '../ai/work-assistant.js';
import type { WritingAssistant } from '../ai/writing-assistant.js';

const logger = getLogger('ai-assistant-routes');
const metrics = getMetrics();

// =============================================================================
// SCHEMAS
// =============================================================================

const querySchema = z.object({
  question: z.string().min(1).max(10000),
  context: z.object({
    sessionId: z.string(),
    contractId: z.string(),
    currentApp: z.string(),
    fileType: z.string().optional(),
    language: z.string().optional(),
    content: z.string().optional(),
    cursorPosition: z
      .object({
        line: z.number(),
        column: z.number(),
      })
      .optional(),
  }),
  mode: z.enum(['code_review', 'writing', 'design', 'general']).optional(),
});

const codeReviewSchema = z.object({
  code: z.string().min(1).max(50000),
  language: z.string(),
  sessionId: z.string(),
  reviewType: z.enum(['full', 'security', 'performance', 'style']).optional(),
});

const writingCheckSchema = z.object({
  text: z.string().min(1).max(50000),
  mode: z.enum(['formal', 'casual', 'technical', 'marketing']).optional(),
  sessionId: z.string(),
  checkType: z.enum(['grammar', 'tone', 'clarity', 'all']).optional(),
});

const feedbackSchema = z.object({
  suggestionId: z.string(),
  helpful: z.boolean(),
  action: z.enum(['accepted', 'modified', 'rejected']),
  comment: z.string().optional(),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  autoSuggest: z.boolean(),
  modes: z.array(z.enum(['code_review', 'writing', 'design', 'general'])),
  privacyLevel: z.enum(['strict', 'balanced', 'open']),
  notificationFrequency: z.enum(['always', 'important', 'never']),
});

// =============================================================================
// ROUTE DEPENDENCIES
// =============================================================================

export interface AIAssistantRoutesDeps {
  workAssistant: WorkAssistantService;
  codeReviewAssistant: CodeReviewAssistant;
  writingAssistant: WritingAssistant;
  settingsStore: AISettingsStore;
  feedbackStore: AIFeedbackStore;
}

export interface AISettingsStore {
  get(userId: string): Promise<z.infer<typeof settingsSchema> | null>;
  set(userId: string, settings: z.infer<typeof settingsSchema>): Promise<void>;
}

export interface AIFeedbackStore {
  record(userId: string, feedback: z.infer<typeof feedbackSchema>): Promise<void>;
}

// =============================================================================
// ROUTES
// =============================================================================

export function createAIAssistantRoutes(deps: AIAssistantRoutesDeps): Hono {
  const router = new Hono();

  // ---------------------------------------------------------------------------
  // POST /ai/assistant/query
  // ---------------------------------------------------------------------------

  router.post('/query', zValidator('json', querySchema), async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('userId') as string;

    logger.info('Processing assistant query', {
      userId,
      sessionId: body.context.sessionId,
      mode: body.mode,
    });

    const startTime = Date.now();

    try {
      // Check if AI is enabled for user
      const settings = await deps.settingsStore.get(userId);
      if (settings && !settings.enabled) {
        return c.json({ error: 'AI assistant is disabled' }, 403);
      }

      // Process query
      const response = await deps.workAssistant.query({
        question: body.question,
        context: body.context,
        mode: body.mode,
      });

      // Track metrics
      metrics.histogram('ai_assistant_query_duration', Date.now() - startTime, {
        mode: body.mode || 'general',
      });

      return c.json({
        success: true,
        answer: response.answer,
        suggestions: response.suggestions,
        relatedActions: response.relatedActions,
        confidence: response.confidence,
      });
    } catch (error) {
      logger.error('Assistant query failed', { error, userId });
      metrics.increment('ai_assistant_errors', { type: 'query' });

      return c.json({ error: 'Failed to process query' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /ai/assistant/code-review
  // ---------------------------------------------------------------------------

  router.post('/code-review', zValidator('json', codeReviewSchema), async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('userId') as string;

    logger.info('Processing code review', {
      userId,
      sessionId: body.sessionId,
      language: body.language,
      codeLength: body.code.length,
    });

    const startTime = Date.now();

    try {
      const result = await deps.codeReviewAssistant.review({
        code: body.code,
        language: body.language,
        sessionId: body.sessionId,
        userId,
        reviewType: body.reviewType || 'full',
      });

      metrics.histogram('ai_code_review_duration', Date.now() - startTime, {
        language: body.language,
      });

      return c.json({
        success: true,
        issues: result.issues,
        summary: result.summary,
        suggestions: result.suggestions,
        documentation: result.documentation,
      });
    } catch (error) {
      logger.error('Code review failed', { error, userId });
      metrics.increment('ai_assistant_errors', { type: 'code_review' });

      return c.json({ error: 'Failed to review code' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /ai/assistant/writing-check
  // ---------------------------------------------------------------------------

  router.post('/writing-check', zValidator('json', writingCheckSchema), async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('userId') as string;

    logger.info('Processing writing check', {
      userId,
      sessionId: body.sessionId,
      mode: body.mode,
      textLength: body.text.length,
    });

    const startTime = Date.now();

    try {
      const result = await deps.writingAssistant.check({
        text: body.text,
        mode: body.mode || 'formal',
        sessionId: body.sessionId,
        userId,
        checkType: body.checkType || 'all',
      });

      metrics.histogram('ai_writing_check_duration', Date.now() - startTime, {
        mode: body.mode || 'formal',
      });

      return c.json({
        success: true,
        issues: result.issues,
        suggestions: result.suggestions,
        alternatives: result.alternatives,
        overallScore: result.overallScore,
      });
    } catch (error) {
      logger.error('Writing check failed', { error, userId });
      metrics.increment('ai_assistant_errors', { type: 'writing_check' });

      return c.json({ error: 'Failed to check writing' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /ai/assistant/feedback
  // ---------------------------------------------------------------------------

  router.post('/feedback', zValidator('json', feedbackSchema), async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('userId') as string;

    logger.info('Recording AI feedback', {
      userId,
      suggestionId: body.suggestionId,
      helpful: body.helpful,
      action: body.action,
    });

    try {
      await deps.feedbackStore.record(userId, body);

      metrics.increment('ai_feedback_recorded', {
        helpful: String(body.helpful),
        action: body.action,
      });

      return c.json({
        success: true,
        message: 'Feedback recorded',
      });
    } catch (error) {
      logger.error('Failed to record feedback', { error, userId });
      return c.json({ error: 'Failed to record feedback' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /ai/assistant/settings
  // ---------------------------------------------------------------------------

  router.get('/settings', async (c) => {
    const userId = c.get('userId') as string;

    try {
      const settings = await deps.settingsStore.get(userId);

      if (!settings) {
        // Return defaults
        return c.json({
          enabled: true,
          autoSuggest: true,
          modes: ['code_review', 'writing', 'general'],
          privacyLevel: 'balanced',
          notificationFrequency: 'important',
        });
      }

      return c.json(settings);
    } catch (error) {
      logger.error('Failed to get AI settings', { error, userId });
      return c.json({ error: 'Failed to get settings' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // PUT /ai/assistant/settings
  // ---------------------------------------------------------------------------

  router.put('/settings', zValidator('json', settingsSchema), async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('userId') as string;

    logger.info('Updating AI settings', {
      userId,
      enabled: body.enabled,
      privacyLevel: body.privacyLevel,
    });

    try {
      await deps.settingsStore.set(userId, body);

      return c.json({
        success: true,
        settings: body,
      });
    } catch (error) {
      logger.error('Failed to update AI settings', { error, userId });
      return c.json({ error: 'Failed to update settings' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /ai/assistant/contextual-suggestions
  // ---------------------------------------------------------------------------

  router.get('/contextual-suggestions', async (c) => {
    const userId = c.get('userId') as string;
    const sessionId = c.req.query('sessionId');
    const context = c.req.query('context');

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }

    try {
      // Check if auto-suggest is enabled
      const settings = await deps.settingsStore.get(userId);
      if (settings && !settings.autoSuggest) {
        return c.json({ suggestions: [] });
      }

      const suggestions = await deps.workAssistant.getContextualSuggestions(
        sessionId,
        context || ''
      );

      return c.json({
        suggestions,
      });
    } catch (error) {
      logger.error('Failed to get contextual suggestions', { error, userId });
      return c.json({ suggestions: [] });
    }
  });

  return router;
}

// =============================================================================
// EXPORT
// =============================================================================

export const aiAssistantRoutes = createAIAssistantRoutes;

