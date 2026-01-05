/**
 * @module @skillancer/auth-svc/routes/certification
 * Certification management routes
 */

import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook } from '../middleware/rate-limit.js';
import {
  createCertificationSchema,
  updateCertificationSchema,
  certificationListQuerySchema,
  certificationIdParamSchema,
} from '../schemas/certification.js';
import { getCertificationService } from '../services/certification.service.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface CertIdParams {
  certId: string;
}

interface UsernameParams {
  username: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getUserId(request: FastifyRequest): string {
  if (!request.user?.id) {
    throw new Error('User not authenticated');
  }
  return request.user.id;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /certifications - Create certification
 */
async function createCertificationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const data = createCertificationSchema.parse(request.body);
  const certificationService = getCertificationService();

  const certification = await certificationService.create(userId, data);

  void reply.status(201).send({
    success: true,
    message: 'Certification created successfully',
    certification,
  });
}

/**
 * GET /certifications - Get user's certifications
 */
async function getCertificationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const query = certificationListQuerySchema.parse(request.query);
  const certificationService = getCertificationService();

  const result = await certificationService.getUserCertifications(userId, query);

  void reply.send({
    success: true,
    ...result,
  });
}

/**
 * GET /certifications/expiring - Get expiring certifications
 */
async function getExpiringCertificationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { days } = request.query as { days?: string };
  const daysAhead = days ? Number.parseInt(days, 10) : 30;
  const certificationService = getCertificationService();

  const certifications = await certificationService.getExpiringCertifications(userId, daysAhead);

  void reply.send({
    success: true,
    data: certifications,
    count: certifications.length,
  });
}

/**
 * GET /certifications/expired - Get expired certifications
 */
async function getExpiredCertificationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const certificationService = getCertificationService();

  const certifications = await certificationService.getExpiredCertifications(userId);

  void reply.send({
    success: true,
    data: certifications,
    count: certifications.length,
  });
}

/**
 * GET /certifications/:certId - Get single certification
 */
async function getCertificationHandler(
  request: FastifyRequest<{ Params: CertIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { certId } = certificationIdParamSchema.parse(request.params);
  const certificationService = getCertificationService();

  const certification = await certificationService.getById(certId, userId);

  void reply.send({
    success: true,
    certification,
  });
}

/**
 * PUT /certifications/:certId - Update certification
 */
async function updateCertificationHandler(
  request: FastifyRequest<{ Params: CertIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { certId } = certificationIdParamSchema.parse(request.params);
  const data = updateCertificationSchema.parse(request.body);
  const certificationService = getCertificationService();

  const certification = await certificationService.update(certId, userId, data);

  void reply.send({
    success: true,
    message: 'Certification updated successfully',
    certification,
  });
}

/**
 * DELETE /certifications/:certId - Delete certification
 */
async function deleteCertificationHandler(
  request: FastifyRequest<{ Params: CertIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { certId } = certificationIdParamSchema.parse(request.params);
  const certificationService = getCertificationService();

  await certificationService.delete(certId, userId);

  void reply.send({
    success: true,
    message: 'Certification deleted successfully',
  });
}

/**
 * GET /certifications/public/:username - Get public certifications for a user
 */
async function getPublicCertificationsHandler(
  request: FastifyRequest<{ Params: UsernameParams }>,
  reply: FastifyReply
): Promise<void> {
  const { username } = request.params;
  const query = certificationListQuerySchema.parse(request.query);
  const certificationService = getCertificationService();

  const result = await certificationService.getPublicCertifications(username, query);

  void reply.send({
    success: true,
    ...result,
  });
}

// =============================================================================
// ADMIN ROUTE HANDLERS
// =============================================================================

/**
 * POST /certifications/admin/:certId/verify - Verify certification (admin only)
 */
async function verifyCertificationHandler(
  request: FastifyRequest<{ Params: CertIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const { certId } = certificationIdParamSchema.parse(request.params);
  const certificationService = getCertificationService();

  const certification = await certificationService.verify(certId);

  void reply.send({
    success: true,
    message: 'Certification verified successfully',
    certification,
  });
}

/**
 * POST /certifications/admin/:certId/unverify - Unverify certification (admin only)
 */
async function unverifyCertificationHandler(
  request: FastifyRequest<{ Params: CertIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const { certId } = certificationIdParamSchema.parse(request.params);
  const certificationService = getCertificationService();

  const certification = await certificationService.unverify(certId);

  void reply.send({
    success: true,
    message: 'Certification unverified',
    certification,
  });
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function certificationRoutes(fastify: FastifyInstance): Promise<void> {
  // Authenticated routes
  await fastify.register((authenticatedRoutes) => {
    authenticatedRoutes.addHook('preHandler', authMiddleware);
    authenticatedRoutes.addHook('preHandler', profileRateLimitHook);

    // CRUD operations
    authenticatedRoutes.post('/', createCertificationHandler);
    authenticatedRoutes.get('/', getCertificationsHandler);
    authenticatedRoutes.get('/expiring', getExpiringCertificationsHandler);
    authenticatedRoutes.get('/expired', getExpiredCertificationsHandler);
    authenticatedRoutes.get('/:certId', getCertificationHandler);
    authenticatedRoutes.put('/:certId', updateCertificationHandler);
    authenticatedRoutes.delete('/:certId', deleteCertificationHandler);
  });

  // Admin routes
  await fastify.register((adminRoutes) => {
    adminRoutes.addHook('preHandler', authMiddleware);
    adminRoutes.addHook('preHandler', adminMiddleware);

    adminRoutes.post('/admin/:certId/verify', verifyCertificationHandler);
    adminRoutes.post('/admin/:certId/unverify', unverifyCertificationHandler);
  });

  // Public routes
  fastify.get('/public/:username', getPublicCertificationsHandler);
}

export default certificationRoutes;
