/**
 * @module @skillancer/intelligence-svc/openapi
 * OpenAPI/Swagger documentation for Intelligence Service
 */

import type { FastifyInstance } from 'fastify';

export const openApiConfig = {
  openapi: {
    info: {
      title: 'Skillancer Intelligence Service API',
      description: `
## Overview

The Intelligence Service provides advanced analytics, predictions, and insights for the Skillancer platform.
It powers data-driven decision making through outcome tracking, predictive analytics, risk assessment,
and industry benchmarking.

## Key Features

- **Outcome Tracking**: Track and analyze project outcomes and success metrics
- **Predictive Analytics**: ML-powered predictions for success rates and earnings
- **Risk Assessment**: Evaluate contract and client risk factors
- **Benchmarking**: Compare performance against industry standards

## Authentication

All endpoints require JWT authentication:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limits

- Standard endpoints: 100 requests/minute
- Prediction endpoints: 30 requests/minute
- Benchmark reports: 10 requests/minute
      `,
      version: '1.0.0',
      contact: {
        name: 'Skillancer Platform Team',
        email: 'platform@skillancer.io',
      },
    },
    servers: [
      { url: 'http://localhost:3010', description: 'Local development' },
      { url: 'https://api.skillancer.io/intelligence', description: 'Production' },
    ],
    tags: [
      { name: 'Outcomes', description: 'Outcome tracking and analysis' },
      { name: 'Predictions', description: 'Predictive analytics' },
      { name: 'Risk', description: 'Risk assessment' },
      { name: 'Benchmarks', description: 'Industry benchmarking' },
      { name: 'Health', description: 'Service health checks' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Outcome: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            contractId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['CONTRACT_COMPLETION', 'MILESTONE', 'REVIEW', 'PAYMENT'] },
            status: { type: 'string', enum: ['SUCCESS', 'PARTIAL', 'FAILURE'] },
            metrics: { $ref: '#/components/schemas/OutcomeMetrics' },
            factors: { type: 'array', items: { $ref: '#/components/schemas/OutcomeFactor' } },
            recordedAt: { type: 'string', format: 'date-time' },
          },
        },
        OutcomeMetrics: {
          type: 'object',
          properties: {
            deliveryTime: { type: 'integer', description: 'Days from start to completion' },
            budgetVariance: { type: 'number', description: 'Percentage over/under budget' },
            clientRating: { type: 'number', minimum: 1, maximum: 5 },
            freelancerRating: { type: 'number', minimum: 1, maximum: 5 },
            revisionCount: { type: 'integer' },
            communicationScore: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
        OutcomeFactor: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            impact: { type: 'string', enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'] },
            weight: { type: 'number', minimum: 0, maximum: 1 },
            description: { type: 'string' },
          },
        },
        Prediction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['SUCCESS_RATE', 'EARNINGS', 'COMPLETION_TIME', 'CLIENT_SATISFACTION'] },
            targetId: { type: 'string', format: 'uuid' },
            targetType: { type: 'string', enum: ['CONTRACT', 'PROPOSAL', 'USER'] },
            prediction: { type: 'number' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            factors: { type: 'array', items: { $ref: '#/components/schemas/PredictionFactor' } },
            validUntil: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PredictionFactor: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'number' },
            contribution: { type: 'number' },
            direction: { type: 'string', enum: ['POSITIVE', 'NEGATIVE'] },
          },
        },
        RiskAssessment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            targetId: { type: 'string', format: 'uuid' },
            targetType: { type: 'string', enum: ['CONTRACT', 'CLIENT', 'FREELANCER'] },
            overallRisk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            riskScore: { type: 'number', minimum: 0, maximum: 100 },
            riskFactors: { type: 'array', items: { $ref: '#/components/schemas/RiskFactor' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            assessedAt: { type: 'string', format: 'date-time' },
          },
        },
        RiskFactor: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['PAYMENT', 'SCOPE', 'TIMELINE', 'COMMUNICATION', 'REPUTATION'] },
            name: { type: 'string' },
            severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            score: { type: 'number', minimum: 0, maximum: 100 },
            description: { type: 'string' },
            mitigation: { type: 'string' },
          },
        },
        Benchmark: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            category: { type: 'string' },
            skill: { type: 'string' },
            region: { type: 'string' },
            experienceLevel: { type: 'string', enum: ['ENTRY', 'MID', 'SENIOR', 'EXPERT'] },
            metrics: { $ref: '#/components/schemas/BenchmarkMetrics' },
            sampleSize: { type: 'integer' },
            period: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        BenchmarkMetrics: {
          type: 'object',
          properties: {
            hourlyRate: { $ref: '#/components/schemas/StatisticalRange' },
            projectValue: { $ref: '#/components/schemas/StatisticalRange' },
            successRate: { $ref: '#/components/schemas/StatisticalRange' },
            completionTime: { $ref: '#/components/schemas/StatisticalRange' },
            clientRating: { $ref: '#/components/schemas/StatisticalRange' },
          },
        },
        StatisticalRange: {
          type: 'object',
          properties: {
            min: { type: 'number' },
            max: { type: 'number' },
            median: { type: 'number' },
            p25: { type: 'number' },
            p75: { type: 'number' },
            mean: { type: 'number' },
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

    console.info('[INTELLIGENCE-SVC] OpenAPI documentation available at /docs');
  } catch (err) {
    console.warn('[INTELLIGENCE-SVC] OpenAPI documentation not available:', (err as Error).message);
  }
}
