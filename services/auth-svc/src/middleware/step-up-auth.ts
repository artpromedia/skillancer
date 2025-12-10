/**
 * @module @skillancer/auth-svc/middleware/step-up-auth
 * Step-up authentication middleware
 */

import { getStepUpService, type SensitiveOperation } from '../services/step-up-auth.service.js';

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Create middleware that requires step-up authentication for sensitive operations
 *
 * @param operation - The sensitive operation being performed
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * fastify.delete('/account', {
 *   preHandler: [authMiddleware, requireStepUpAuth('delete_account')],
 * }, deleteAccountHandler);
 * ```
 */
export function requireStepUpAuth(operation: SensitiveOperation) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const stepUpService = getStepUpService();
    const user = request.user as { id: string } | undefined;
    const userId = user?.id;

    if (!userId) {
      await reply.code(401).send({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
      return;
    }

    const hasValidStepUp = await stepUpService.hasValidStepUp(userId, operation);

    if (!hasValidStepUp) {
      // Initiate step-up challenge
      const challenge = await stepUpService.initiateStepUp(userId, operation);

      await reply.code(401).send({
        error: 'Step-up authentication required',
        code: 'STEP_UP_AUTH_REQUIRED',
        operation,
        challengeId: challenge.challengeId,
        availableMethods: challenge.availableMethods,
        expiresAt: challenge.expiresAt.toISOString(),
      });
      return;
    }

    // Step-up auth is valid, proceed
  };
}

/**
 * Middleware to check if step-up is valid but not require it
 * (useful for conditional step-up based on operation context)
 */
export function checkStepUpAuth(operation: SensitiveOperation) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const stepUpService = getStepUpService();
    const user = request.user as { id: string } | undefined;
    const userId = user?.id;

    if (!userId) {
      return;
    }

    const hasValidStepUp = await stepUpService.hasValidStepUp(userId, operation);

    // Attach step-up status to request for use in handlers
    (request as FastifyRequest & { stepUpValid?: boolean }).stepUpValid = hasValidStepUp;
  };
}
