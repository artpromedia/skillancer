import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { okrService } from '../services/okr.service';
import { OKRStatus } from '@prisma/client';

// OKR Routes - Objectives, Key Results, Check-ins

interface EngagementParams {
  engagementId: string;
}

interface ObjectiveParams extends EngagementParams {
  objectiveId: string;
}

interface KeyResultParams extends ObjectiveParams {
  keyResultId: string;
}

interface CreateObjectiveBody {
  title: string;
  description?: string;
  ownerId: string;
  timeframe: string;
  parentObjectiveId?: string;
}

interface UpdateObjectiveBody {
  title?: string;
  description?: string;
  status?: OKRStatus;
  ownerId?: string;
  endDate?: Date;
}

interface CreateKeyResultBody {
  title: string;
  description?: string;
  targetValue: number;
  startValue?: number;
  unit: string;
  ownerId: string;
  keyResultType: 'NUMBER' | 'PERCENTAGE' | 'CURRENCY' | 'BOOLEAN';
}

interface UpdateKeyResultBody {
  currentValue?: number;
  confidence?: number;
  notes?: string;
}

interface CheckInBody {
  objectiveId: string;
  userId: string;
  notes?: string;
  overallConfidence: number;
  keyResultUpdates?: Record<string, { value: number; confidence: number }>;
}

export async function okrRoutes(fastify: FastifyInstance): Promise<void> {
  // ==================== OBJECTIVES ====================

  // Create objective for an engagement
  fastify.post<{ Params: EngagementParams; Body: CreateObjectiveBody }>(
    '/engagements/:engagementId/objectives',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title', 'ownerId', 'timeframe'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            ownerId: { type: 'string' },
            timeframe: { type: 'string' },
            parentObjectiveId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { engagementId } = request.params;
      const { title, description, ownerId, timeframe, parentObjectiveId } = request.body;

      const objective = await okrService.createObjective({
        engagementId,
        title,
        description,
        ownerId,
        timeframe,
        parentObjectiveId,
      });

      return reply.status(201).send({ data: objective });
    }
  );

  // List objectives for an engagement
  fastify.get<{
    Params: EngagementParams;
    Querystring: { timeframe?: string; ownerId?: string; status?: OKRStatus };
  }>('/engagements/:engagementId/objectives', async (request, reply) => {
    const { engagementId } = request.params;
    const { timeframe, ownerId, status } = request.query;

    const objectives = await okrService.getObjectives(engagementId, {
      timeframe,
      ownerId,
      status,
    });

    return reply.send({ data: objectives });
  });

  // Get objective by ID
  fastify.get<{ Params: ObjectiveParams }>(
    '/engagements/:engagementId/objectives/:objectiveId',
    async (request, reply) => {
      const { objectiveId } = request.params;

      const objective = await okrService.getObjective(objectiveId);

      if (!objective) {
        return reply.status(404).send({ error: 'Objective not found' });
      }

      return reply.send({ data: objective });
    }
  );

  // Update objective
  fastify.patch<{ Params: ObjectiveParams; Body: UpdateObjectiveBody }>(
    '/engagements/:engagementId/objectives/:objectiveId',
    async (request, reply) => {
      const { objectiveId } = request.params;

      const objective = await okrService.updateObjective(objectiveId, request.body);

      return reply.send({ data: objective });
    }
  );

  // Delete objective
  fastify.delete<{ Params: ObjectiveParams }>(
    '/engagements/:engagementId/objectives/:objectiveId',
    async (request, reply) => {
      const { objectiveId } = request.params;

      await okrService.deleteObjective(objectiveId);

      return reply.status(204).send();
    }
  );

  // ==================== KEY RESULTS ====================

  // Add key result to objective
  fastify.post<{ Params: ObjectiveParams; Body: CreateKeyResultBody }>(
    '/engagements/:engagementId/objectives/:objectiveId/key-results',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title', 'targetValue', 'unit', 'ownerId', 'keyResultType'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            targetValue: { type: 'number' },
            startValue: { type: 'number' },
            unit: { type: 'string' },
            ownerId: { type: 'string' },
            keyResultType: {
              type: 'string',
              enum: ['NUMBER', 'PERCENTAGE', 'CURRENCY', 'BOOLEAN'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { objectiveId } = request.params;
      const { title, description, targetValue, startValue, unit, ownerId, keyResultType } =
        request.body;

      const keyResult = await okrService.createKeyResult({
        objectiveId,
        title,
        description,
        targetValue,
        startValue,
        unit,
        ownerId,
        keyResultType,
      });

      return reply.status(201).send({ data: keyResult });
    }
  );

  // Update key result value
  fastify.patch<{ Params: KeyResultParams; Body: UpdateKeyResultBody }>(
    '/engagements/:engagementId/objectives/:objectiveId/key-results/:keyResultId',
    async (request, reply) => {
      const { keyResultId } = request.params;
      const { currentValue, confidence, notes } = request.body;

      // Use updateKeyResultValue which is the actual method in the service
      const keyResult = await okrService.updateKeyResultValue(
        keyResultId,
        request.user?.id ?? 'system', // Get userId from request context
        {
          currentValue: currentValue ?? 0,
          confidence,
          notes,
        }
      );

      return reply.send({ data: keyResult });
    }
  );

  // ==================== CHECK-INS ====================

  // Create check-in
  fastify.post<{ Body: CheckInBody }>(
    '/check-ins',
    {
      schema: {
        body: {
          type: 'object',
          required: ['objectiveId', 'userId', 'overallConfidence'],
          properties: {
            objectiveId: { type: 'string' },
            userId: { type: 'string' },
            notes: { type: 'string' },
            overallConfidence: { type: 'number', minimum: 0, maximum: 100 },
            keyResultUpdates: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const { objectiveId, userId, notes, overallConfidence, keyResultUpdates } = request.body;

      const checkIn = await okrService.createCheckIn({
        objectiveId,
        userId,
        notes,
        overallConfidence,
        keyResultUpdates,
      });

      return reply.status(201).send({ data: checkIn });
    }
  );

  // ==================== DASHBOARD AGGREGATIONS ====================

  // Get OKR tree for an engagement
  fastify.get<{ Params: EngagementParams; Querystring: { timeframe?: string } }>(
    '/engagements/:engagementId/okr-tree',
    async (request, reply) => {
      const { engagementId } = request.params;
      const { timeframe } = request.query;

      const tree = await okrService.getOKRTree(engagementId, timeframe);

      return reply.send({ data: tree });
    }
  );

  // Get OKR summary for an engagement
  fastify.get<{ Params: EngagementParams; Querystring: { timeframe?: string } }>(
    '/engagements/:engagementId/okr-summary',
    async (request, reply) => {
      const { engagementId } = request.params;
      const { timeframe } = request.query;

      const summary = await okrService.getOKRSummary(engagementId, timeframe);

      return reply.send({ data: summary });
    }
  );
}

export default okrRoutes;
