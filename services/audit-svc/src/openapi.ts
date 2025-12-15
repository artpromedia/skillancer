/**
 * @module @skillancer/audit-svc/openapi
 * OpenAPI/Swagger documentation configuration
 */

import type { FastifyInstance } from 'fastify';

export const openApiConfig = {
  openapi: {
    info: {
      title: 'Skillancer Audit Service API',
      description: `
## Overview

The Audit Service provides comprehensive audit logging, compliance reporting, and data integrity verification
for the Skillancer platform. It supports GDPR, HIPAA, SOC2, and PCI compliance requirements.

## Authentication

All endpoints require authentication via JWT token. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Permissions

Different endpoints require different permissions:
- \`audit:read\` - Read audit logs and basic reports
- \`audit:write\` - Create audit log entries
- \`audit:admin\` - Access integrity verification and maintenance
- \`audit:compliance\` - Generate compliance reports
- \`audit:gdpr\` - Access GDPR-specific endpoints
- \`audit:gdpr:delete\` - Anonymize user data

## Rate Limits

- Standard endpoints: 100 requests/minute
- Export endpoints: 10 requests/minute
- Compliance reports: 20 requests/minute

## Data Retention

Audit logs follow configurable retention policies:
- \`SHORT\`: 90 days
- \`STANDARD\`: 1 year
- \`EXTENDED\`: 7 years
- \`PERMANENT\`: Never deleted

## Integrity Verification

All audit logs are cryptographically signed using SHA-256 hash chains to ensure tamper-proof records.
      `,
      version: '1.0.0',
      contact: {
        name: 'Skillancer Platform Team',
        email: 'platform@skillancer.io',
      },
      license: {
        name: 'Proprietary',
        url: 'https://skillancer.io/terms',
      },
    },
    servers: [
      {
        url: 'http://localhost:3006',
        description: 'Local development',
      },
      {
        url: 'https://api.skillancer.io/audit',
        description: 'Production',
      },
    ],
    tags: [
      {
        name: 'Audit Logs',
        description: 'CRUD operations for audit log entries',
      },
      {
        name: 'Analytics',
        description: 'Audit log analytics and dashboards',
      },
      {
        name: 'Compliance',
        description: 'Compliance reporting and policy management',
      },
      {
        name: 'GDPR',
        description: 'GDPR-specific operations (DSAR, anonymization)',
      },
      {
        name: 'Integrity',
        description: 'Data integrity verification',
      },
      {
        name: 'Export',
        description: 'Audit log export operations',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        AuditLogEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            eventType: { type: 'string', description: 'Type of audit event' },
            eventCategory: {
              type: 'string',
              enum: [
                'AUTHENTICATION',
                'AUTHORIZATION',
                'USER_MANAGEMENT',
                'DATA_ACCESS',
                'DATA_MODIFICATION',
                'SYSTEM',
                'SECURITY',
                'PAYMENT',
                'CONTRACT',
                'SKILLPOD',
                'COMMUNICATION',
                'COMPLIANCE',
              ],
            },
            action: { type: 'string', description: 'Human-readable action description' },
            actor: { $ref: '#/components/schemas/Actor' },
            resource: { $ref: '#/components/schemas/Resource' },
            outcome: { $ref: '#/components/schemas/Outcome' },
            changes: { $ref: '#/components/schemas/Changes' },
            request: { $ref: '#/components/schemas/Request' },
            timestamp: { type: 'string', format: 'date-time' },
            integrityHash: { type: 'string', description: 'SHA-256 hash for integrity' },
            previousHash: { type: 'string', description: 'Hash of previous log entry' },
            complianceTags: {
              type: 'array',
              items: { type: 'string', enum: ['GDPR', 'HIPAA', 'SOC2', 'PCI', 'PII'] },
            },
            retentionPolicy: {
              type: 'string',
              enum: ['SHORT', 'STANDARD', 'EXTENDED', 'PERMANENT'],
            },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
        Actor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['USER', 'SYSTEM', 'SERVICE', 'ADMIN', 'API_KEY', 'ANONYMOUS'],
            },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
          },
          required: ['id', 'type'],
        },
        Resource: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            id: { type: 'string' },
            name: { type: 'string' },
            parentType: { type: 'string' },
            parentId: { type: 'string' },
          },
          required: ['type', 'id'],
        },
        Outcome: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED'] },
            statusCode: { type: 'integer' },
            duration: { type: 'integer', description: 'Duration in milliseconds' },
            errorCode: { type: 'string' },
            errorMessage: { type: 'string' },
          },
          required: ['status'],
        },
        Changes: {
          type: 'object',
          properties: {
            before: { type: 'object', additionalProperties: true },
            after: { type: 'object', additionalProperties: true },
            diff: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  oldValue: {},
                  newValue: {},
                },
              },
            },
          },
        },
        Request: {
          type: 'object',
          properties: {
            method: { type: 'string' },
            path: { type: 'string' },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 500 },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/AuditLogEntry' },
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
            filters: { type: 'object' },
          },
        },
        ComplianceReport: {
          type: 'object',
          properties: {
            tag: { type: 'string' },
            period: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' },
              },
            },
            summary: {
              type: 'object',
              properties: {
                totalEvents: { type: 'integer' },
                successfulEvents: { type: 'integer' },
                failedEvents: { type: 'integer' },
                uniqueActors: { type: 'integer' },
                uniqueResources: { type: 'integer' },
                complianceScore: { type: 'number' },
              },
            },
            eventsByCategory: { type: 'object', additionalProperties: { type: 'integer' } },
            eventsByOutcome: { type: 'object', additionalProperties: { type: 'integer' } },
            violations: {
              type: 'array',
              items: { $ref: '#/components/schemas/PolicyViolation' },
            },
            recommendations: { type: 'array', items: { type: 'string' } },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PolicyViolation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            eventType: { type: 'string' },
            resource: { $ref: '#/components/schemas/Resource' },
            actor: { $ref: '#/components/schemas/Actor' },
            violation: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          },
        },
        IntegrityVerification: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            totalChecked: { type: 'integer' },
            brokenChains: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  error: { type: 'string' },
                },
              },
            },
            verificationTime: { type: 'integer', description: 'Time in milliseconds' },
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
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
} as const;

/**
 * Register OpenAPI/Swagger documentation with Fastify
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  // Dynamic import to handle optional dependency
  try {
    const swagger = await import('@fastify/swagger');
    const swaggerUi = await import('@fastify/swagger-ui');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    await app.register(swagger.default, openApiConfig as any);

    await app.register(swaggerUi.default, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        syntaxHighlight: {
          theme: 'monokai',
        },
      },
      staticCSP: true,
      transformStaticCSP: (header: string) => header,
    });

    console.info('[AUDIT-SVC] OpenAPI documentation available at /docs');
  } catch (err) {
    console.warn('[AUDIT-SVC] OpenAPI documentation not available:', (err as Error).message);
  }
}
