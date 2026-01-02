/**
 * Hire Routes
 *
 * API routes for clients to initiate and manage engagements with executives.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@skillancer/database';
import { platformFeeService } from '../services/platform-fee.service.js';

interface EngagementDraftParams {
  draftId: string;
}

interface EngagementParams {
  engagementId: string;
}

interface InitiateEngagementBody {
  executiveId: string;
  executiveType: string;
  hoursPerWeek: number;
  startDate?: string;
  expectedDuration?: string;
  objectives?: string[];
}

interface UpdateDraftBody {
  scopeOfWork?: string;
  deliverables?: string[];
  successMetrics?: string[];
  outOfScope?: string[];
  billingModel?: 'RETAINER' | 'HOURLY';
  monthlyRetainer?: number;
  hourlyRate?: number;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  workspaceName?: string;
  integrations?: string[];
  skillpodEnabled?: boolean;
}

interface ContractSignBody {
  signature: string;
  agreedToTerms: boolean;
  signedAt: string;
}

export async function hireRoutes(fastify: FastifyInstance) {
  // =========================================================================
  // ENGAGEMENT INITIATION
  // =========================================================================

  /**
   * POST /engagements/initiate - Initiate engagement with executive
   */
  fastify.post(
    '/engagements/initiate',
    async (request: FastifyRequest<{ Body: InitiateEngagementBody }>, reply: FastifyReply) => {
      const user = request.user;

      if (!user?.tenantId) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const body = request.body;

      // Verify executive exists and is available
      const executive = await prisma.executiveProfile.findUnique({
        where: { id: body.executiveId },
        select: {
          id: true,
          executiveType: true,
          currentClients: true,
          maxClients: true,
          availableFrom: true,
          hoursPerWeekMax: true,
          hourlyRateMin: true,
          monthlyRetainerMin: true,
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      if (!executive) {
        return reply.code(404).send({ error: 'Executive not found' });
      }

      if (executive.currentClients >= executive.maxClients) {
        return reply.code(400).send({ error: 'Executive is at capacity' });
      }

      // Create engagement draft (PROPOSAL status)
      const engagement = await prisma.executiveEngagement.create({
        data: {
          executiveId: body.executiveId,
          clientTenantId: user.tenantId,
          clientContactId: user.id,
          title: `${executive.executiveType.replace('FRACTIONAL_', '')} Engagement`,
          role: executive.executiveType,
          status: 'PROPOSAL',
          hoursPerWeek: body.hoursPerWeek,
          startDate: body.startDate ? new Date(body.startDate) : undefined,
          billingModel: 'RETAINER',
          currency: 'USD',
          billingCycle: 'MONTHLY',
        },
      });

      // Create workspace shell
      await prisma.executiveWorkspace.create({
        data: {
          engagementId: engagement.id,
          skillpodEnabled: true,
          enabledWidgets: ['overview', 'tasks', 'meetings'],
        },
      });

      return reply.code(201).send({
        draftId: engagement.id,
        status: 'PROPOSAL',
        executive: {
          id: executive.id,
          name: `${executive.user.firstName} ${executive.user.lastName}`,
          type: executive.executiveType,
        },
        nextStep: 'scope_of_work',
        message: 'Engagement draft created. Complete the scope of work to proceed.',
      });
    }
  );

  // =========================================================================
  // DRAFT MANAGEMENT
  // =========================================================================

  /**
   * GET /engagements/draft/:draftId - Get engagement draft
   */
  fastify.get(
    '/engagements/draft/:draftId',
    async (request: FastifyRequest<{ Params: EngagementDraftParams }>, reply: FastifyReply) => {
      const user = request.user;
      const { draftId } = request.params;

      const engagement = await prisma.executiveEngagement.findUnique({
        where: { id: draftId },
        include: {
          executive: {
            select: {
              id: true,
              headline: true,
              executiveType: true,
              hourlyRateMin: true,
              monthlyRetainerMin: true,
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          workspace: true,
        },
      });

      if (!engagement) {
        return reply.code(404).send({ error: 'Engagement draft not found' });
      }

      if (engagement.clientTenantId !== user?.tenantId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Determine completion status
      const steps = {
        details: true, // Always complete if draft exists
        scope: !!engagement.scopeOfWork,
        pricing: !!(engagement.monthlyRetainer || engagement.hourlyRate),
        workspace: !!engagement.workspace,
        contract: engagement.status === 'CONTRACT_SENT' || engagement.status !== 'PROPOSAL',
      };

      return {
        id: engagement.id,
        status: engagement.status,
        executive: {
          id: engagement.executive.id,
          name: `${engagement.executive.user.firstName} ${engagement.executive.user.lastName}`,
          headline: engagement.executive.headline,
          type: engagement.executive.executiveType,
        },
        details: {
          hoursPerWeek: engagement.hoursPerWeek,
          startDate: engagement.startDate,
          billingModel: engagement.billingModel,
        },
        scope: engagement.scopeOfWork
          ? {
              scopeOfWork: engagement.scopeOfWork,
            }
          : null,
        pricing: {
          billingModel: engagement.billingModel,
          monthlyRetainer: engagement.monthlyRetainer,
          hourlyRate: engagement.hourlyRate,
          currency: engagement.currency,
          billingCycle: engagement.billingCycle,
        },
        workspace: engagement.workspace,
        completionStatus: steps,
        nextStep: getNextStep(steps),
      };
    }
  );

  /**
   * PUT /engagements/draft/:draftId - Update engagement draft
   */
  fastify.put(
    '/engagements/draft/:draftId',
    async (
      request: FastifyRequest<{ Params: EngagementDraftParams; Body: UpdateDraftBody }>,
      reply: FastifyReply
    ) => {
      const user = request.user;
      const { draftId } = request.params;
      const body = request.body;

      const engagement = await prisma.executiveEngagement.findUnique({
        where: { id: draftId },
        include: { workspace: true },
      });

      if (!engagement) {
        return reply.code(404).send({ error: 'Engagement draft not found' });
      }

      if (engagement.clientTenantId !== user?.tenantId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      if (engagement.status !== 'PROPOSAL') {
        return reply.code(400).send({ error: 'Cannot modify engagement after submission' });
      }

      // Update engagement
      const updateData: Record<string, unknown> = {};

      if (body.scopeOfWork !== undefined) {
        updateData.scopeOfWork = body.scopeOfWork;
      }

      if (body.billingModel !== undefined) {
        updateData.billingModel = body.billingModel;
      }

      if (body.monthlyRetainer !== undefined) {
        updateData.monthlyRetainer = body.monthlyRetainer;
      }

      if (body.hourlyRate !== undefined) {
        updateData.hourlyRate = body.hourlyRate;
      }

      if (body.billingCycle !== undefined) {
        updateData.billingCycle = body.billingCycle;
      }

      const updated = await prisma.executiveEngagement.update({
        where: { id: draftId },
        data: updateData,
      });

      // Update workspace if provided
      if (engagement.workspace && (body.workspaceName || body.skillpodEnabled !== undefined)) {
        await prisma.executiveWorkspace.update({
          where: { id: engagement.workspace.id },
          data: {
            workspaceName: body.workspaceName,
            skillpodEnabled: body.skillpodEnabled,
          },
        });
      }

      return {
        id: updated.id,
        status: updated.status,
        message: 'Draft updated successfully',
      };
    }
  );

  /**
   * POST /engagements/draft/:draftId/submit - Submit for executive review
   */
  fastify.post(
    '/engagements/draft/:draftId/submit',
    async (request: FastifyRequest<{ Params: EngagementDraftParams }>, reply: FastifyReply) => {
      const user = request.user;
      const { draftId } = request.params;

      const engagement = await prisma.executiveEngagement.findUnique({
        where: { id: draftId },
      });

      if (!engagement) {
        return reply.code(404).send({ error: 'Engagement draft not found' });
      }

      if (engagement.clientTenantId !== user?.tenantId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      if (engagement.status !== 'PROPOSAL') {
        return reply.code(400).send({ error: 'Engagement already submitted' });
      }

      // Validate required fields
      if (!engagement.scopeOfWork) {
        return reply.code(400).send({ error: 'Scope of work is required' });
      }

      if (!engagement.monthlyRetainer && !engagement.hourlyRate) {
        return reply.code(400).send({ error: 'Pricing is required' });
      }

      // Update status
      const updated = await prisma.executiveEngagement.update({
        where: { id: draftId },
        data: {
          status: 'CONTRACT_SENT',
          proposalSentAt: new Date(),
        },
      });

      // TODO: Notify executive
      // await notificationService.notifyExecutiveOfProposal(engagement.executiveId, engagement);

      return {
        id: updated.id,
        status: updated.status,
        message: 'Proposal submitted to executive for review.',
        nextStep: 'await_executive_review',
      };
    }
  );

  // =========================================================================
  // CONTRACT MANAGEMENT
  // =========================================================================

  /**
   * POST /engagements/:engagementId/contract - Generate contract
   */
  fastify.post(
    '/engagements/:engagementId/contract',
    async (request: FastifyRequest<{ Params: EngagementParams }>, reply: FastifyReply) => {
      const { engagementId } = request.params;

      const engagement = await prisma.executiveEngagement.findUnique({
        where: { id: engagementId },
        include: {
          executive: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      if (!engagement) {
        return reply.code(404).send({ error: 'Engagement not found' });
      }

      // Generate contract (in production, use document generation service)
      const contractId = `contract_${engagementId.substring(0, 8)}_${Date.now()}`;

      await prisma.executiveEngagement.update({
        where: { id: engagementId },
        data: { contractId },
      });

      // Calculate platform fees estimate
      const monthlyAmount =
        engagement.monthlyRetainer?.toNumber() ||
        (engagement.hourlyRate?.toNumber() || 0) * engagement.hoursPerWeek * 4;

      const feeEstimate = platformFeeService.estimateFees(monthlyAmount, 12);

      return {
        contractId,
        engagement: {
          id: engagement.id,
          title: engagement.title,
          executive: `${engagement.executive.user.firstName} ${engagement.executive.user.lastName}`,
        },
        terms: {
          startDate: engagement.startDate,
          hoursPerWeek: engagement.hoursPerWeek,
          billingModel: engagement.billingModel,
          monthlyRetainer: engagement.monthlyRetainer,
          hourlyRate: engagement.hourlyRate,
          currency: engagement.currency,
          billingCycle: engagement.billingCycle,
          paymentTerms: engagement.paymentTerms,
        },
        platformFees: {
          structure: 'Declining platform fee: 15% months 1-3, 10% months 4-12, 5% thereafter',
          estimate: feeEstimate.totals,
        },
        signatureRequired: true,
      };
    }
  );

  /**
   * POST /engagements/:engagementId/sign - Sign contract
   */
  fastify.post(
    '/engagements/:engagementId/sign',
    async (
      request: FastifyRequest<{ Params: EngagementParams; Body: ContractSignBody }>,
      reply: FastifyReply
    ) => {
      const user = request.user;
      const { engagementId } = request.params;
      const body = request.body;

      const engagement = await prisma.executiveEngagement.findUnique({
        where: { id: engagementId },
      });

      if (!engagement) {
        return reply.code(404).send({ error: 'Engagement not found' });
      }

      if (!body.agreedToTerms) {
        return reply.code(400).send({ error: 'Must agree to terms' });
      }

      // Determine who is signing
      const isClient = engagement.clientContactId === user?.id;
      const isExecutive = user?.executiveId === engagement.executiveId;

      if (!isClient && !isExecutive) {
        return reply.code(403).send({ error: 'Not authorized to sign' });
      }

      // Store signature (in production, use e-signature service)
      // For now, just track that signature was provided

      // If both parties have signed, activate the engagement
      // Simplified: client signs first, then executive
      if (isClient) {
        // Client signed, await executive
        return {
          success: true,
          message: 'Contract signed. Awaiting executive signature.',
          nextStep: 'executive_signature',
        };
      }

      if (isExecutive) {
        // Executive signed, activate engagement
        await prisma.executiveEngagement.update({
          where: { id: engagementId },
          data: {
            status: 'ACTIVE',
          },
        });

        return {
          success: true,
          message: 'Contract fully executed. Engagement activated.',
          nextStep: 'kickoff',
        };
      }

      return reply.code(400).send({ error: 'Unable to process signature' });
    }
  );

  /**
   * POST /engagements/:engagementId/activate - Activate engagement
   */
  fastify.post(
    '/engagements/:engagementId/activate',
    async (request: FastifyRequest<{ Params: EngagementParams }>, reply: FastifyReply) => {
      const { engagementId } = request.params;

      const engagement = await prisma.executiveEngagement.findUnique({
        where: { id: engagementId },
        include: { executive: true },
      });

      if (!engagement) {
        return reply.code(404).send({ error: 'Engagement not found' });
      }

      if (engagement.status !== 'ACTIVE') {
        return reply.code(400).send({ error: 'Engagement must be in active status' });
      }

      // Activate the engagement
      const now = new Date();
      const updated = await prisma.executiveEngagement.update({
        where: { id: engagementId },
        data: {
          status: 'ACTIVE',
          startDate: engagement.startDate || now,
        },
      });

      // Increment executive's client count
      await prisma.executiveProfile.update({
        where: { id: engagement.executiveId },
        data: {
          currentClients: { increment: 1 },
          lastActivityAt: now,
        },
      });

      // TODO: Send notifications, provision integrations, etc.

      return {
        id: updated.id,
        status: 'ACTIVE',
        startDate: updated.startDate,
        message: 'Engagement activated successfully!',
        workspace: `/executive/engagements/${engagementId}`,
      };
    }
  );

  // =========================================================================
  // CLIENT ENGAGEMENT LIST
  // =========================================================================

  /**
   * GET /engagements - Get client's engagements
   */
  fastify.get('/engagements', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user?.tenantId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const engagements = await prisma.executiveEngagement.findMany({
      where: { clientTenantId: user.tenantId },
      include: {
        executive: {
          select: {
            id: true,
            headline: true,
            executiveType: true,
            profilePhotoUrl: true,
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      engagements: engagements.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        executive: {
          id: e.executive.id,
          name: `${e.executive.user.firstName} ${e.executive.user.lastName}`,
          headline: e.executive.headline,
          type: e.executive.executiveType,
          photoUrl: e.executive.profilePhotoUrl,
        },
        hoursPerWeek: e.hoursPerWeek,
        startDate: e.startDate,
        createdAt: e.createdAt,
      })),
    };
  });
}

// =========================================================================
// HELPERS
// =========================================================================

function getNextStep(steps: Record<string, boolean>): string {
  if (!steps.scope) return 'scope_of_work';
  if (!steps.pricing) return 'pricing';
  if (!steps.workspace) return 'workspace';
  if (!steps.contract) return 'contract';
  return 'complete';
}
