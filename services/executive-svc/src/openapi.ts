/**
 * @module @skillancer/executive-svc/openapi
 * OpenAPI/Swagger documentation for Executive Service
 */

import type { FastifyInstance } from 'fastify';

export const openApiConfig = {
  openapi: {
    info: {
      title: 'Skillancer Executive Service API',
      description: `
## Overview

The Executive Service provides enterprise-grade client management features for the Skillancer platform.
It enables white-glove service for high-value enterprise clients with dedicated support, custom workspaces,
and advanced engagement tracking.

## Key Features

- **Executive Profiles**: Dedicated profiles for enterprise client executives
- **Client Engagements**: Track and manage enterprise client relationships
- **Custom Workspaces**: Branded workspaces for enterprise clients
- **Integration Hub**: Connect to enterprise systems (SSO, HRIS, billing)

## Authentication

All endpoints require JWT authentication:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limits

- Standard endpoints: 100 requests/minute
- Profile operations: 50 requests/minute
      `,
      version: '1.0.0',
      contact: {
        name: 'Skillancer Platform Team',
        email: 'platform@skillancer.io',
      },
    },
    servers: [
      { url: 'http://localhost:3007', description: 'Local development' },
      { url: 'https://api.skillancer.io/executive', description: 'Production' },
    ],
    tags: [
      { name: 'Executive Profiles', description: 'Executive profile management' },
      { name: 'Engagements', description: 'Client engagement tracking' },
      { name: 'Workspaces', description: 'Custom workspace management' },
      { name: 'Integrations', description: 'Enterprise system integrations' },
      { name: 'Health', description: 'Service health checks' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ExecutiveProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            companyId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            department: { type: 'string' },
            assistantInfo: { $ref: '#/components/schemas/AssistantInfo' },
            preferences: { $ref: '#/components/schemas/Preferences' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'PENDING'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AssistantInfo: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            canApproveContracts: { type: 'boolean' },
            canManagePayments: { type: 'boolean' },
          },
        },
        Preferences: {
          type: 'object',
          properties: {
            communicationChannel: { type: 'string', enum: ['EMAIL', 'PHONE', 'SLACK'] },
            responseTimeExpectation: { type: 'string', enum: ['IMMEDIATE', 'SAME_DAY', 'NEXT_DAY'] },
            timezone: { type: 'string' },
            language: { type: 'string' },
          },
        },
        ClientEngagement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            profileId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['ONBOARDING', 'SUPPORT', 'RENEWAL', 'EXPANSION'] },
            status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
            scheduledAt: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
          },
        },
        Workspace: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            companyId: { type: 'string', format: 'uuid' },
            branding: { $ref: '#/components/schemas/WorkspaceBranding' },
            settings: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        WorkspaceBranding: {
          type: 'object',
          properties: {
            logoUrl: { type: 'string', format: 'uri' },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            customDomain: { type: 'string' },
          },
        },
        Integration: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            companyId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['SSO', 'HRIS', 'BILLING', 'SLACK', 'CUSTOM'] },
            status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'FAILED', 'DISABLED'] },
            config: { type: 'object' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
} as const;

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  try {
    const swagger = await import('@fastify/swagger');
    const swaggerUi = await import('@fastify/swagger-ui');

    await app.register(swagger.default, openApiConfig as any);
    await app.register(swaggerUi.default, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });

    console.info('[EXECUTIVE-SVC] OpenAPI documentation available at /docs');
  } catch (err) {
    console.warn('[EXECUTIVE-SVC] OpenAPI documentation not available:', (err as Error).message);
  }
}
