import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IntegrationHubService } from '../services/integration-hub.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const integrationService = new IntegrationHubService(prisma);

export async function integrationRoutes(fastify: FastifyInstance) {
  // Get all available integration types
  fastify.get('/integrations/types', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { category, executiveRole } = request.query as {
        category?: string;
        executiveRole?: string;
      };

      const types = await integrationService.getIntegrationTypes(category, executiveRole);

      return reply.send(types);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get integrations for an engagement
  fastify.get(
    '/engagements/:engagementId/integrations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { engagementId } = request.params as { engagementId: string };

        const integrations = await prisma.executiveIntegration.findMany({
          where: { engagementId },
          include: {
            integrationType: true,
          },
        });

        return reply.send(integrations);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Connect an integration
  fastify.post(
    '/engagements/:engagementId/integrations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { engagementId } = request.params as { engagementId: string };
        const { integrationTypeId, accessToken, refreshToken, config } = request.body as {
          integrationTypeId: string;
          accessToken: string;
          refreshToken?: string;
          config?: Record<string, unknown>;
        };

        const integration = await integrationService.connectIntegration(
          engagementId,
          integrationTypeId,
          accessToken,
          refreshToken,
          config
        );

        return reply.status(201).send(integration);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Disconnect an integration
  fastify.delete(
    '/integrations/:integrationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { integrationId } = request.params as { integrationId: string };

        await integrationService.disconnectIntegration(integrationId);

        return reply.status(204).send();
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Refresh integration token
  fastify.post(
    '/integrations/:integrationId/refresh',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { integrationId } = request.params as { integrationId: string };
        const { newAccessToken, newRefreshToken } = request.body as {
          newAccessToken: string;
          newRefreshToken?: string;
        };

        const integration = await integrationService.refreshToken(
          integrationId,
          newAccessToken,
          newRefreshToken
        );

        return reply.send(integration);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Update sync status
  fastify.patch(
    '/integrations/:integrationId/sync',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { integrationId } = request.params as { integrationId: string };
        const { status, cachedData, errorMessage } = request.body as {
          status: string;
          cachedData?: Record<string, unknown>;
          errorMessage?: string;
        };

        const integration = await integrationService.updateSyncStatus(
          integrationId,
          status,
          cachedData,
          errorMessage
        );

        return reply.send(integration);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Trigger sync for an integration
  fastify.post(
    '/integrations/:integrationId/sync',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { integrationId } = request.params as { integrationId: string };

        // Mark as syncing
        await integrationService.updateSyncStatus(integrationId, 'SYNCING');

        // In a real implementation, this would trigger an async job
        // For now, we just acknowledge the request
        return reply.send({ message: 'Sync initiated', integrationId });
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get cached data for an integration
  fastify.get(
    '/integrations/:integrationId/data',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { integrationId } = request.params as { integrationId: string };

        const cachedData = await integrationService.getCachedData(integrationId);

        if (!cachedData) {
          return reply.status(404).send({ error: 'No cached data available' });
        }

        return reply.send(cachedData);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Toggle sync enabled
  fastify.patch(
    '/integrations/:integrationId/toggle-sync',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { integrationId } = request.params as { integrationId: string };
        const { enabled } = request.body as { enabled: boolean };

        const integration = await integrationService.toggleSync(integrationId, enabled);

        return reply.send(integration);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Get tool configs for an executive profile
  fastify.get(
    '/profiles/:executiveProfileId/tool-configs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { executiveProfileId } = request.params as { executiveProfileId: string };

        const toolConfigs = await prisma.executiveToolConfig.findMany({
          where: { executiveProfileId },
        });

        return reply.send(toolConfigs);
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update tool config
  fastify.put(
    '/profiles/:executiveProfileId/tool-configs/:toolKey',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { executiveProfileId, toolKey } = request.params as {
          executiveProfileId: string;
          toolKey: string;
        };
        const { preferences, shortcuts, customFields } = request.body as {
          preferences?: Record<string, unknown>;
          shortcuts?: Record<string, unknown>;
          customFields?: Record<string, unknown>;
        };

        const toolConfig = await prisma.executiveToolConfig.upsert({
          where: {
            executiveProfileId_toolKey: {
              executiveProfileId,
              toolKey,
            },
          },
          create: {
            executiveProfileId,
            toolKey,
            preferences: preferences ? JSON.parse(JSON.stringify(preferences)) : {},
            shortcuts: shortcuts ? JSON.parse(JSON.stringify(shortcuts)) : {},
            customFields: customFields ? JSON.parse(JSON.stringify(customFields)) : {},
          },
          update: {
            preferences: preferences ? JSON.parse(JSON.stringify(preferences)) : undefined,
            shortcuts: shortcuts ? JSON.parse(JSON.stringify(shortcuts)) : undefined,
            customFields: customFields ? JSON.parse(JSON.stringify(customFields)) : undefined,
          },
        });

        return reply.send(toolConfig);
      } catch (error: any) {
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // Admin: Seed integration types
  fastify.post('/admin/integrations/seed', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if user is admin (simplified check)
      const user = (request as any).user;
      if (!user?.roles?.includes('ADMIN')) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      await integrationService.seedIntegrationTypes();

      return reply.send({ message: 'Integration types seeded successfully' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Admin: Upsert integration type
  fastify.put('/admin/integrations/types', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.roles?.includes('ADMIN')) {
        return reply.status(403).send({ error: 'Admin access required' });
      }

      const input = request.body as any;

      const integrationType = await integrationService.upsertIntegrationType(input);

      return reply.send(integrationType);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });
}
