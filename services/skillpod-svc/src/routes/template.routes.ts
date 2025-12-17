/**
 * @module @skillancer/skillpod-svc/routes/template
 * Template management API routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import { z } from 'zod';

import type { TemplateService } from '../services/template.service.js';
import type { TemplateCategory } from '@prisma/client';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const ResourceSpecSchema = z.object({
  cpu: z.number().min(1).max(128),
  memory: z.number().min(1024).max(524288),
  storage: z.number().min(10).max(10000),
  gpu: z.boolean().optional(),
  gpuType: z.string().optional(),
});

const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  installCommand: z.string().optional(),
  verifyCommand: z.string().optional(),
  configPath: z.string().optional(),
});

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  shortDescription: z.string().max(200).optional(),
  category: z.enum([
    'DEVELOPMENT',
    'FINANCE',
    'DESIGN',
    'DATA_SCIENCE',
    'GENERAL',
    'SECURITY',
    'DEVOPS',
    'CUSTOM',
  ]),
  tags: z.array(z.string()).optional(),
  baseImageId: z.string().uuid(),
  installedTools: z.array(ToolDefinitionSchema),
  defaultConfig: z.record(z.unknown()).optional(),
  defaultResources: ResourceSpecSchema,
  minResources: ResourceSpecSchema.optional(),
  maxResources: ResourceSpecSchema.optional(),
  startupScript: z.string().optional(),
  environmentVars: z.record(z.string()).optional(),
  iconUrl: z.string().url().optional(),
  screenshotUrls: z.array(z.string().url()).optional(),
  documentationUrl: z.string().url().optional(),
  isPublic: z.boolean().optional(),
});

const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const CloneTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  customizations: z
    .object({
      additionalTools: z.array(ToolDefinitionSchema).optional(),
      removeTools: z.array(z.string()).optional(),
      overrideResources: ResourceSpecSchema.partial().optional(),
      overrideConfig: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const RateTemplateSchema = z.object({
  rating: z.number().min(1).max(5),
  review: z.string().max(1000).optional(),
});

const ListTemplatesQuerySchema = z.object({
  category: z
    .enum([
      'DEVELOPMENT',
      'FINANCE',
      'DESIGN',
      'DATA_SCIENCE',
      'GENERAL',
      'SECURITY',
      'DEVOPS',
      'CUSTOM',
    ])
    .optional(),
  tags: z
    .string()
    .optional()
    .transform((v) => v?.split(',')),
  search: z.string().optional(),
  includeGlobal: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 20)),
});

// =============================================================================
// ROUTE PLUGIN
// =============================================================================

interface TemplateRoutesOptions {
  templateService: TemplateService;
}

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    tenantId: string;
    roles: string[];
  };
}

export const templateRoutes: FastifyPluginAsync<TemplateRoutesOptions> = async (
  fastify,
  options
) => {
  const { templateService } = options;

  // ===========================================================================
  // LIST TEMPLATES
  // ===========================================================================
  fastify.get(
    '/',
    {
      schema: {
        querystring: ListTemplatesQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              templates: { type: 'array' },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const query = ListTemplatesQuerySchema.parse(request.query);
      const tenantId = request.user?.tenantId;

      const result = await templateService.listTemplates({
        tenantId,
        category: query.category as TemplateCategory | undefined,
        tags: query.tags,
        search: query.search,
        includeGlobal: query.includeGlobal ?? true,
        page: query.page,
        limit: query.limit,
      });

      return reply.send({
        ...result,
        page: query.page || 1,
        limit: query.limit || 20,
      });
    }
  );

  // ===========================================================================
  // GET TEMPLATE BY ID
  // ===========================================================================
  fastify.get<{
    Params: { templateId: string };
  }>(
    '/:templateId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
          required: ['templateId'],
        },
      },
    },
    async (request, reply) => {
      const { templateId } = request.params;

      const template = await templateService.getTemplateById(templateId);

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      return reply.send({ template });
    }
  );

  // ===========================================================================
  // GET TEMPLATE BY SLUG
  // ===========================================================================
  fastify.get<{
    Params: { slug: string };
  }>(
    '/slug/:slug',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
          },
          required: ['slug'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { slug } = request.params;
      const tenantId = request.user?.tenantId || null;

      const template = await templateService.getTemplateBySlug(tenantId, slug);

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      return reply.send({ template });
    }
  );

  // ===========================================================================
  // CREATE TEMPLATE
  // ===========================================================================
  fastify.post(
    '/',
    {
      schema: {
        body: CreateTemplateSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const body = CreateTemplateSchema.parse(request.body);
      const tenantId = request.user?.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      try {
        const template = await templateService.createTemplate({
          ...body,
          tenantId,
        });

        return await reply.status(201).send({ template });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('SLUG_EXISTS')) {
            return reply.status(409).send({ error: 'Template slug already exists' });
          }
          if (error.message.includes('BASE_IMAGE_NOT_FOUND')) {
            return reply.status(400).send({ error: 'Base image not found' });
          }
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // UPDATE TEMPLATE
  // ===========================================================================
  fastify.patch<{
    Params: { templateId: string };
  }>(
    '/:templateId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
          required: ['templateId'],
        },
        body: UpdateTemplateSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { templateId } = request.params;
      const body = UpdateTemplateSchema.parse(request.body);
      const tenantId = request.user?.tenantId;

      // Verify ownership
      const existingTemplate = await templateService.getTemplateById(templateId);
      if (!existingTemplate) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      if (existingTemplate.tenantId !== tenantId) {
        return reply.status(403).send({ error: 'Cannot modify template from another tenant' });
      }

      const template = await templateService.updateTemplate(templateId, body);

      return reply.send({ template });
    }
  );

  // ===========================================================================
  // DELETE TEMPLATE
  // ===========================================================================
  fastify.delete<{
    Params: { templateId: string };
  }>(
    '/:templateId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
          required: ['templateId'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { templateId } = request.params;
      const tenantId = request.user?.tenantId;

      // Verify ownership
      const existingTemplate = await templateService.getTemplateById(templateId);
      if (!existingTemplate) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      if (existingTemplate.tenantId !== tenantId) {
        return reply.status(403).send({ error: 'Cannot delete template from another tenant' });
      }

      await templateService.deleteTemplate(templateId);

      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // CLONE TEMPLATE
  // ===========================================================================
  fastify.post<{
    Params: { templateId: string };
  }>(
    '/:templateId/clone',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
          required: ['templateId'],
        },
        body: CloneTemplateSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { templateId } = request.params;
      const body = CloneTemplateSchema.parse(request.body);
      const tenantId = request.user?.tenantId;

      if (!tenantId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      try {
        const template = await templateService.cloneTemplate(templateId, {
          tenantId,
          ...body,
        });

        return await reply.status(201).send({ template });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('TEMPLATE_NOT_FOUND')) {
            return reply.status(404).send({ error: 'Source template not found' });
          }
          if (error.message.includes('SLUG_EXISTS')) {
            return reply.status(409).send({ error: 'Template slug already exists' });
          }
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // RATE TEMPLATE
  // ===========================================================================
  fastify.post<{
    Params: { templateId: string };
  }>(
    '/:templateId/rate',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
          required: ['templateId'],
        },
        body: RateTemplateSchema,
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const { templateId } = request.params;
      const body = RateTemplateSchema.parse(request.body);
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      await templateService.rateTemplate({
        templateId,
        userId,
        rating: body.rating,
        review: body.review,
      });

      return reply.status(200).send({ success: true });
    }
  );

  // ===========================================================================
  // GET TEMPLATE RATINGS
  // ===========================================================================
  fastify.get<{
    Params: { templateId: string };
  }>(
    '/:templateId/ratings',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', format: 'uuid' },
          },
          required: ['templateId'],
        },
      },
    },
    async (request, reply) => {
      const { templateId } = request.params;

      const template = await templateService.getTemplateById(templateId);

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      return reply.send({
        avgRating: template.avgRating,
        ratingCount: template.ratingCount,
        ratings: template.ratings || [],
      });
    }
  );
};

export default templateRoutes;
