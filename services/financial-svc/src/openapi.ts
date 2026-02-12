/**
 * @module @skillancer/financial-svc/openapi
 * OpenAPI/Swagger documentation for Financial Service
 */

import type { FastifyInstance } from 'fastify';

export const openApiConfig = {
  openapi: {
    info: {
      title: 'Skillancer Financial Service API',
      description: `
## Overview

The Financial Service provides advanced financial products for freelancers and enterprise clients
on the Skillancer platform, including corporate cards, invoice financing, tax vaults, and banking integrations.

## Key Features

- **Corporate Cards**: Virtual and physical cards for freelancers with spending controls
- **Invoice Financing**: Early payment options for approved invoices
- **Tax Vault**: Automated tax withholding and management
- **Banking Integration**: Direct deposit and payment processing

## Authentication

All endpoints require JWT authentication:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Compliance

This service is PCI DSS compliant. All card data is tokenized and encrypted.

## Rate Limits

- Standard endpoints: 100 requests/minute
- Financial transactions: 20 requests/minute
      `,
      version: '1.0.0',
      contact: {
        name: 'Skillancer Platform Team',
        email: 'platform@skillancer.io',
      },
    },
    servers: [
      { url: 'http://localhost:3008', description: 'Local development' },
      { url: 'https://api.skillancer.io/financial', description: 'Production' },
    ],
    tags: [
      { name: 'Cards', description: 'Corporate card management' },
      { name: 'Financing', description: 'Invoice financing operations' },
      { name: 'Tax Vault', description: 'Tax withholding management' },
      { name: 'Banking', description: 'Bank account integrations' },
      { name: 'Health', description: 'Service health checks' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        CorporateCard: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['VIRTUAL', 'PHYSICAL'] },
            status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'FROZEN', 'CANCELLED'] },
            last4: { type: 'string', pattern: '^[0-9]{4}$' },
            expiryMonth: { type: 'integer', minimum: 1, maximum: 12 },
            expiryYear: { type: 'integer' },
            spendingLimit: { $ref: '#/components/schemas/Money' },
            currentSpend: { $ref: '#/components/schemas/Money' },
            controls: { $ref: '#/components/schemas/SpendingControls' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        SpendingControls: {
          type: 'object',
          properties: {
            dailyLimit: { $ref: '#/components/schemas/Money' },
            monthlyLimit: { $ref: '#/components/schemas/Money' },
            allowedCategories: { type: 'array', items: { type: 'string' } },
            blockedMerchants: { type: 'array', items: { type: 'string' } },
            requireApprovalAbove: { $ref: '#/components/schemas/Money' },
          },
        },
        InvoiceFinancing: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            amount: { $ref: '#/components/schemas/Money' },
            advanceAmount: { $ref: '#/components/schemas/Money' },
            feeAmount: { $ref: '#/components/schemas/Money' },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'FUNDED', 'REPAID', 'DEFAULTED'],
            },
            fundedAt: { type: 'string', format: 'date-time' },
            dueAt: { type: 'string', format: 'date-time' },
          },
        },
        TaxVault: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            balance: { $ref: '#/components/schemas/Money' },
            withholdingRate: { type: 'number', minimum: 0, maximum: 100 },
            autoWithhold: { type: 'boolean' },
            taxYear: { type: 'integer' },
            estimatedTax: { $ref: '#/components/schemas/Money' },
          },
        },
        BankAccount: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            institutionName: { type: 'string' },
            accountType: { type: 'string', enum: ['CHECKING', 'SAVINGS'] },
            last4: { type: 'string', pattern: '^[0-9]{4}$' },
            status: { type: 'string', enum: ['PENDING', 'VERIFIED', 'FAILED'] },
            isDefault: { type: 'boolean' },
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

    console.info('[FINANCIAL-SVC] OpenAPI documentation available at /docs');
  } catch (err) {
    console.warn('[FINANCIAL-SVC] OpenAPI documentation not available:', (err as Error).message);
  }
}
