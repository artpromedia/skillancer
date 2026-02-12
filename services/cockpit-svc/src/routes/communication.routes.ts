/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module @skillancer/cockpit-svc/routes/communication
 * Communication Platform Integration Routes - Discord
 */

import { z } from 'zod';

import type {
  DiscordIntegrationService,
  DiscordInteraction,
} from '../services/integrations/discord-integration.service.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================================
// Request Schemas
// ============================================================================

const integrationIdParamSchema = z.object({
  integrationId: z.string().uuid(),
});

const discordNotificationConfigSchema = z.object({
  guildId: z.string().optional(),
  notificationChannelId: z.string().optional(),
  notifyOnPayment: z.boolean().optional(),
  notifyOnInvoice: z.boolean().optional(),
  notifyOnProject: z.boolean().optional(),
  notifyOnDeadline: z.boolean().optional(),
});

const testNotificationSchema = z.object({
  channelId: z.string(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

export interface CommunicationRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
  discordService: DiscordIntegrationService;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerCommunicationRoutes(
  app: FastifyInstance,
  deps: CommunicationRouteDeps
): void {
  const { prisma, discordService } = deps;

  // ============================================================================
  // Discord Routes
  // ============================================================================

  /**
   * List Discord guilds for an integration
   */
  app.get(
    '/integrations/:integrationId/discord/guilds',
    {
      schema: {
        tags: ['Integrations', 'Discord'],
        summary: 'List Discord guilds (servers)',
        params: integrationIdParamSchema,
        response: {
          200: z.object({
            guilds: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                icon: z.string().nullable(),
              })
            ),
          }),
        },
      },
    },
    async (request: FastifyRequest<{ Params: { integrationId: string } }>, reply: FastifyReply) => {
      const { integrationId } = request.params;

      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });

      if (integration?.provider !== 'DISCORD') {
        return reply.status(404).send({ error: 'Discord integration not found' });
      }

      const guilds = await discordService.getGuilds(integration);
      return {
        guilds: guilds.map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon ?? null,
        })),
      };
    }
  );

  /**
   * List Discord channels for a guild
   */
  app.get(
    '/integrations/:integrationId/discord/guilds/:guildId/channels',
    {
      schema: {
        tags: ['Integrations', 'Discord'],
        summary: 'List Discord channels for a guild',
        params: z.object({
          integrationId: z.string().uuid(),
          guildId: z.string(),
        }),
        response: {
          200: z.object({
            channels: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                type: z.number(),
              })
            ),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { integrationId: string; guildId: string } }>,
      reply: FastifyReply
    ) => {
      const { integrationId, guildId } = request.params;

      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });

      if (integration?.provider !== 'DISCORD') {
        return reply.status(404).send({ error: 'Discord integration not found' });
      }

      const channels = await discordService.getGuildChannels(integration, guildId);
      return {
        channels: channels.map((ch) => ({
          id: ch.id,
          name: ch.name ?? 'unknown',
          type: ch.type,
        })),
      };
    }
  );

  /**
   * Configure Discord notification settings
   */
  app.patch(
    '/integrations/:integrationId/discord/notifications',
    {
      schema: {
        tags: ['Integrations', 'Discord'],
        summary: 'Configure Discord notification settings',
        params: integrationIdParamSchema,
        body: discordNotificationConfigSchema,
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { integrationId: string };
        Body: z.infer<typeof discordNotificationConfigSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { integrationId } = request.params;
      const config = request.body;

      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });

      if (integration?.provider !== 'DISCORD') {
        return reply.status(404).send({ error: 'Discord integration not found' });
      }

      const existingOptions = (integration.syncOptions as Record<string, unknown>) ?? {};
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          syncOptions: {
            ...existingOptions,
            ...config,
          },
        },
      });

      return { success: true };
    }
  );

  /**
   * Send test notification to Discord
   */
  app.post(
    '/integrations/:integrationId/discord/test',
    {
      schema: {
        tags: ['Integrations', 'Discord'],
        summary: 'Send test notification to Discord',
        params: integrationIdParamSchema,
        body: testNotificationSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            messageId: z.string(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { integrationId: string };
        Body: z.infer<typeof testNotificationSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { integrationId } = request.params;
      const { channelId } = request.body;

      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });

      if (integration?.provider !== 'DISCORD') {
        return reply.status(404).send({ error: 'Discord integration not found' });
      }

      const messageId = await discordService.sendMessage(integration, channelId, {
        embeds: [
          {
            title: '🎉 Test Notification',
            description: 'Your Discord integration is working correctly!',
            color: 0x5865f2,
          },
        ],
      });

      return { success: true, messageId };
    }
  );

  // ============================================================================
  // Discord Webhook Endpoints (Public - no auth required)
  // ============================================================================

  /**
   * Handle Discord interactions (slash commands, buttons, etc.)
   */
  app.post(
    '/discord/interactions',
    {
      schema: {
        tags: ['Integrations', 'Discord', 'Webhooks'],
        summary: 'Handle Discord interactions',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const interaction = request.body as DiscordInteraction;

      // Handle ping (required for Discord verification)
      if (interaction.type === 1) {
        return reply.send({ type: 1 });
      }

      // Find integration by guild ID or user ID
      const guildId = interaction.guild_id;
      const userId = interaction.member?.user?.id ?? interaction.user?.id;

      let integration = null;

      if (guildId) {
        integration = await prisma.integration.findFirst({
          where: {
            provider: 'DISCORD',
            providerAccountId: guildId,
            status: 'CONNECTED',
          },
        });
      }

      if (!integration && userId) {
        // Try to find by user metadata
        integration = await prisma.integration.findFirst({
          where: {
            provider: 'DISCORD',
            status: 'CONNECTED',
            metadata: {
              path: ['user_id'],
              equals: userId,
            },
          },
        });
      }

      if (!integration) {
        return reply.send({
          type: 4,
          data: {
            content:
              'Discord integration not connected. Please connect at skillancer.com/settings/integrations',
            flags: 64,
          },
        });
      }

      const response = await discordService.handleInteraction(integration, interaction);
      return reply.send(response);
    }
  );

  /**
   * Register Discord slash commands (admin endpoint)
   */
  app.post(
    '/discord/register-commands',
    {
      schema: {
        tags: ['Integrations', 'Discord', 'Admin'],
        summary: 'Register Discord slash commands',
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      await discordService.registerSlashCommands();
      return reply.send({ success: true });
    }
  );
}
