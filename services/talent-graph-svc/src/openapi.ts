/**
 * @module @skillancer/talent-graph-svc/openapi
 * OpenAPI/Swagger documentation for Talent Graph Service
 */

import type { FastifyInstance } from 'fastify';

export const openApiConfig = {
  openapi: {
    info: {
      title: 'Skillancer Talent Graph Service API',
      description: `
## Overview

The Talent Graph Service manages professional relationships and network connections on the Skillancer platform.
It enables professional introductions, relationship tracking, and network analytics to help users grow their careers.

## Key Features

- **Relationship Mapping**: Track professional connections and collaboration history
- **Professional Introductions**: Facilitate warm introductions through mutual connections
- **Reunion Events**: Organize networking events for past collaborators
- **Network Analytics**: Insights into professional network growth and engagement

## Authentication

All endpoints require JWT authentication:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limits

- Standard endpoints: 100 requests/minute
- Introduction requests: 10 requests/minute
      `,
      version: '1.0.0',
      contact: {
        name: 'Skillancer Platform Team',
        email: 'platform@skillancer.io',
      },
    },
    servers: [
      { url: 'http://localhost:3009', description: 'Local development' },
      { url: 'https://api.skillancer.io/talent-graph', description: 'Production' },
    ],
    tags: [
      { name: 'Relationships', description: 'Professional relationship management' },
      { name: 'Introductions', description: 'Warm introduction requests' },
      { name: 'Reunions', description: 'Networking event management' },
      { name: 'Analytics', description: 'Network analytics and insights' },
      { name: 'Health', description: 'Service health checks' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Relationship: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            connectedUserId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['COLLABORATOR', 'CLIENT', 'VENDOR', 'MENTOR', 'MENTEE', 'PEER'] },
            strength: { type: 'number', minimum: 0, maximum: 100 },
            collaborationHistory: { type: 'array', items: { $ref: '#/components/schemas/Collaboration' } },
            lastInteraction: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Collaboration: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            projectName: { type: 'string' },
            role: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            rating: { type: 'number', minimum: 1, maximum: 5 },
          },
        },
        Introduction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            requesterId: { type: 'string', format: 'uuid' },
            targetId: { type: 'string', format: 'uuid' },
            connectorId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'EXPIRED'] },
            message: { type: 'string' },
            reason: { type: 'string' },
            respondedAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Reunion: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organizerId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['VIRTUAL', 'IN_PERSON', 'HYBRID'] },
            scheduledAt: { type: 'string', format: 'date-time' },
            location: { type: 'string' },
            virtualMeetingUrl: { type: 'string', format: 'uri' },
            attendees: { type: 'array', items: { $ref: '#/components/schemas/ReunionAttendee' } },
            maxAttendees: { type: 'integer' },
            status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'] },
          },
        },
        ReunionAttendee: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['INVITED', 'CONFIRMED', 'DECLINED', 'ATTENDED'] },
            invitedAt: { type: 'string', format: 'date-time' },
            respondedAt: { type: 'string', format: 'date-time' },
          },
        },
        NetworkAnalytics: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            totalConnections: { type: 'integer' },
            connectionsByType: { type: 'object', additionalProperties: { type: 'integer' } },
            averageRelationshipStrength: { type: 'number' },
            networkGrowthRate: { type: 'number' },
            introductionSuccessRate: { type: 'number' },
            topCollaborators: { type: 'array', items: { type: 'string', format: 'uuid' } },
            industryReach: { type: 'array', items: { type: 'string' } },
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

    await app.register(swagger.default as any, openApiConfig as any);
    await app.register(swaggerUi.default as any, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });

    console.info('[TALENT-GRAPH-SVC] OpenAPI documentation available at /docs');
  } catch (err) {
    console.warn('[TALENT-GRAPH-SVC] OpenAPI documentation not available:', (err as Error).message);
  }
}
