/**
 * @module @skillancer/copilot-svc/openapi
 * OpenAPI/Swagger documentation for Copilot Service
 */

import type { FastifyInstance } from 'fastify';

export const openApiConfig = {
  openapi: {
    info: {
      title: 'Skillancer Copilot Service API',
      description: `
## Overview

The Copilot Service provides AI-powered assistance for freelancers on the Skillancer platform.
It helps with proposal writing, rate optimization, profile enhancement, and client communication.

## Key Features

- **Proposal Generation**: AI-assisted proposal writing based on job requirements
- **Rate Optimization**: Data-driven rate recommendations based on market analysis
- **Profile Enhancement**: Suggestions for improving freelancer profiles
- **Message Assistance**: Smart reply suggestions for client communications

## Authentication

All endpoints require JWT authentication:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limits

- Standard endpoints: 100 requests/minute
- AI generation endpoints: 20 requests/minute
- Profile analysis: 10 requests/minute
      `,
      version: '1.0.0',
      contact: {
        name: 'Skillancer Platform Team',
        email: 'platform@skillancer.io',
      },
    },
    servers: [
      { url: 'http://localhost:3011', description: 'Local development' },
      { url: 'https://api.skillancer.io/copilot', description: 'Production' },
    ],
    tags: [
      { name: 'Proposals', description: 'AI-powered proposal assistance' },
      { name: 'Rates', description: 'Rate optimization and recommendations' },
      { name: 'Profile', description: 'Profile enhancement suggestions' },
      { name: 'Messages', description: 'Message and communication assistance' },
      { name: 'Health', description: 'Service health checks' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ProposalDraft: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            jobId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
            suggestedRate: { $ref: '#/components/schemas/Money' },
            estimatedDuration: { type: 'string' },
            tone: { type: 'string', enum: ['PROFESSIONAL', 'FRIENDLY', 'FORMAL', 'CASUAL'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            versions: { type: 'array', items: { $ref: '#/components/schemas/ProposalVersion' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ProposalVersion: {
          type: 'object',
          properties: {
            version: { type: 'integer' },
            content: { type: 'string' },
            changes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ProposalGenerationRequest: {
          type: 'object',
          properties: {
            jobId: { type: 'string', format: 'uuid' },
            jobDescription: { type: 'string' },
            clientInfo: { type: 'object' },
            emphasizeSkills: { type: 'array', items: { type: 'string' } },
            tone: { type: 'string', enum: ['PROFESSIONAL', 'FRIENDLY', 'FORMAL', 'CASUAL'] },
            includePortfolio: { type: 'boolean' },
            customInstructions: { type: 'string' },
          },
          required: ['jobId', 'jobDescription'],
        },
        RateRecommendation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            skill: { type: 'string' },
            currentRate: { $ref: '#/components/schemas/Money' },
            recommendedRate: { $ref: '#/components/schemas/Money' },
            rateRange: {
              type: 'object',
              properties: {
                min: { $ref: '#/components/schemas/Money' },
                max: { $ref: '#/components/schemas/Money' },
              },
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            factors: { type: 'array', items: { $ref: '#/components/schemas/RateFactor' } },
            marketPosition: { type: 'string', enum: ['BELOW_MARKET', 'MARKET_RATE', 'ABOVE_MARKET', 'PREMIUM'] },
            recommendation: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        RateFactor: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            impact: { type: 'string', enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'] },
            weight: { type: 'number' },
            description: { type: 'string' },
          },
        },
        ProfileSuggestion: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            category: { type: 'string', enum: ['HEADLINE', 'SUMMARY', 'SKILLS', 'PORTFOLIO', 'EXPERIENCE'] },
            currentValue: { type: 'string' },
            suggestedValue: { type: 'string' },
            reason: { type: 'string' },
            impact: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            accepted: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ProfileAnalysis: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            overallScore: { type: 'number', minimum: 0, maximum: 100 },
            completeness: { type: 'number', minimum: 0, maximum: 100 },
            effectiveness: { type: 'number', minimum: 0, maximum: 100 },
            suggestions: { type: 'array', items: { $ref: '#/components/schemas/ProfileSuggestion' } },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            analyzedAt: { type: 'string', format: 'date-time' },
          },
        },
        MessageSuggestion: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            conversationId: { type: 'string', format: 'uuid' },
            originalMessage: { type: 'string' },
            suggestedReplies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  tone: { type: 'string' },
                  intent: { type: 'string' },
                },
              },
            },
            context: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Money: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string', pattern: '^[A-Z]{3}$' },
          },
          required: ['amount', 'currency'],
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

    console.info('[COPILOT-SVC] OpenAPI documentation available at /docs');
  } catch (err) {
    console.warn('[COPILOT-SVC] OpenAPI documentation not available:', (err as Error).message);
  }
}
