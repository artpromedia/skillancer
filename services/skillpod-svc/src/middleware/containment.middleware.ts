/**
 * @module @skillancer/skillpod-svc/middleware/containment
 * Data containment enforcement middleware for VDI sessions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DataContainmentService } from '../services/data-containment.service.js';
import type { SessionSecurityContext } from '../types/containment.types.js';

// =============================================================================
// TYPES
// =============================================================================

declare module 'fastify' {
  interface FastifyRequest {
    sessionContext?: SessionSecurityContext;
    containmentChecked?: boolean;
  }
}

interface ContainmentMiddlewareOptions {
  /**
   * Whether to enforce containment (if false, only logs)
   */
  enforceMode: boolean;

  /**
   * Routes to exclude from containment checks
   */
  excludeRoutes?: string[];

  /**
   * Header name containing session ID
   */
  sessionIdHeader?: string;

  /**
   * Custom error handler
   */
  onViolation?: (
    request: FastifyRequest,
    violation: { type: string; reason: string }
  ) => Promise<void>;
}

// =============================================================================
// MIDDLEWARE FACTORY
// =============================================================================

/**
 * Create containment enforcement middleware
 */
export function createContainmentMiddleware(
  containmentService: DataContainmentService,
  options: ContainmentMiddlewareOptions
) {
  const {
    enforceMode = true,
    excludeRoutes = ['/health', '/metrics', '/ready'],
    sessionIdHeader = 'x-session-id',
    onViolation,
  } = options;

  /**
   * Main containment check hook
   */
  async function containmentHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip excluded routes
    if (excludeRoutes.some(route => request.url.startsWith(route))) {
      return;
    }

    // Get session ID from header or query
    const sessionId = request.headers[sessionIdHeader] as string ||
                     (request.query as Record<string, unknown>)?.sessionId as string;

    if (!sessionId) {
      // No session context, skip containment checks
      return;
    }

    // Load session context
    const context = await containmentService.getSessionContext(sessionId);
    if (!context) {
      if (enforceMode) {
        reply.status(403).send({
          error: 'Session not found or expired',
          code: 'SESSION_NOT_FOUND',
        });
        return;
      }
      return;
    }

    // Attach context to request
    request.sessionContext = context;

    // Update last activity
    await containmentService.updateSessionContext(sessionId, {
      lastActivity: new Date(),
    });
  }

  /**
   * Pre-handler for checking idle timeout
   */
  async function idleTimeoutCheck(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const context = request.sessionContext;
    if (!context) return;

    const { policy, lastActivity } = context;
    const idleMinutes = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60);

    if (idleMinutes > policy.idleTimeout) {
      if (onViolation) {
        await onViolation(request, {
          type: 'IDLE_TIMEOUT',
          reason: `Session idle for ${Math.round(idleMinutes)} minutes (limit: ${policy.idleTimeout})`,
        });
      }

      if (enforceMode) {
        reply.status(440).send({
          error: 'Session idle timeout exceeded',
          code: 'IDLE_TIMEOUT',
          idleMinutes: Math.round(idleMinutes),
          limit: policy.idleTimeout,
        });
        return;
      }
    }
  }

  /**
   * Pre-handler for checking max session duration
   */
  async function sessionDurationCheck(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const context = request.sessionContext;
    if (!context || !context.policy.maxSessionDuration) return;

    // Get session start time from Redis or database
    // This would need to be implemented based on session storage
    // For now, we skip this check
  }

  /**
   * Register middleware on Fastify instance
   */
  function register(app: FastifyInstance): void {
    // Add hook for loading session context
    app.addHook('preHandler', containmentHook);

    // Add hooks for timeout checks
    app.addHook('preHandler', idleTimeoutCheck);
    app.addHook('preHandler', sessionDurationCheck);
  }

  return {
    register,
    containmentHook,
    idleTimeoutCheck,
    sessionDurationCheck,
  };
}

// =============================================================================
// ROUTE-LEVEL MIDDLEWARE
// =============================================================================

/**
 * Create middleware for specific containment checks on routes
 */
export function createRouteContainmentMiddleware(
  containmentService: DataContainmentService
) {
  /**
   * Require clipboard access for a route
   */
  function requireClipboardAccess(direction: 'inbound' | 'outbound') {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const context = request.sessionContext;
      if (!context) {
        reply.status(403).send({ error: 'No session context' });
        return;
      }

      const body = request.body as Record<string, unknown>;
      const result = await containmentService.checkClipboardAccess({
        sessionId: context.sessionId,
        direction,
        contentType: body.contentType as string || 'text/plain',
        contentLength: body.contentLength as number || 0,
      });

      if (!result.allowed) {
        reply.status(403).send({
          error: result.reason,
          code: 'CLIPBOARD_BLOCKED',
          requiresApproval: result.requiresApproval,
        });
      }
    };
  }

  /**
   * Require file transfer access for a route
   */
  function requireFileTransferAccess(direction: 'UPLOAD' | 'DOWNLOAD') {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const context = request.sessionContext;
      if (!context) {
        reply.status(403).send({ error: 'No session context' });
        return;
      }

      const body = request.body as Record<string, unknown>;
      const result = await containmentService.checkFileTransfer({
        sessionId: context.sessionId,
        direction,
        fileName: body.fileName as string || '',
        fileType: body.fileType as string || '',
        fileSize: body.fileSize as number || 0,
        fileHash: body.fileHash as string | undefined,
      });

      if (!result.allowed) {
        reply.status(403).send({
          error: result.reason,
          code: direction === 'DOWNLOAD' ? 'DOWNLOAD_BLOCKED' : 'UPLOAD_BLOCKED',
          requiresApproval: result.requiresApproval,
          requestId: result.requestId,
        });
      }
    };
  }

  /**
   * Require network access for a route
   */
  function requireNetworkAccess() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const context = request.sessionContext;
      if (!context) {
        reply.status(403).send({ error: 'No session context' });
        return;
      }

      const body = request.body as Record<string, unknown>;
      const result = await containmentService.checkNetworkAccess({
        sessionId: context.sessionId,
        targetUrl: body.targetUrl as string || '',
        protocol: body.protocol as string || 'https',
      });

      if (!result.allowed) {
        reply.status(403).send({
          error: result.reason,
          code: 'NETWORK_BLOCKED',
        });
      }
    };
  }

  /**
   * Require peripheral access for a route
   */
  function requirePeripheralAccess(
    deviceType: 'usb' | 'webcam' | 'microphone' | 'printer'
  ) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const context = request.sessionContext;
      if (!context) {
        reply.status(403).send({ error: 'No session context' });
        return;
      }

      const body = request.body as Record<string, unknown>;
      const result = await containmentService.checkPeripheralAccess({
        sessionId: context.sessionId,
        deviceType,
        deviceId: body.deviceId as string | undefined,
        deviceClass: body.deviceClass as string | undefined,
      });

      if (!result.allowed) {
        reply.status(403).send({
          error: result.reason,
          code: 'PERIPHERAL_BLOCKED',
          requiresPrompt: result.requiresPrompt,
        });
      }
    };
  }

  /**
   * Block screen capture
   */
  function blockScreenCapture() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const context = request.sessionContext;
      if (!context) {
        reply.status(403).send({ error: 'No session context' });
        return;
      }

      const result = await containmentService.checkScreenCapture(context.sessionId);

      if (!result.allowed) {
        reply.status(403).send({
          error: result.reason,
          code: 'SCREEN_CAPTURE_BLOCKED',
        });
      }
    };
  }

  return {
    requireClipboardAccess,
    requireFileTransferAccess,
    requireNetworkAccess,
    requirePeripheralAccess,
    blockScreenCapture,
  };
}

// =============================================================================
// WATERMARK INJECTION MIDDLEWARE
// =============================================================================

/**
 * Create middleware for injecting watermark into responses
 */
export function createWatermarkMiddleware(
  containmentService: DataContainmentService
) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
  ): Promise<unknown> => {
    const context = request.sessionContext;
    if (!context) return payload;

    // Generate watermark config
    const watermark = await containmentService.generateWatermarkConfig(
      context.sessionId
    );

    if (!watermark.enabled) return payload;

    // Add watermark headers for client-side rendering
    reply.header('X-Watermark-Enabled', 'true');
    reply.header('X-Watermark-Text', encodeURIComponent(watermark.text));
    reply.header(
      'X-Watermark-Config',
      encodeURIComponent(JSON.stringify(watermark.config))
    );

    return payload;
  };
}
