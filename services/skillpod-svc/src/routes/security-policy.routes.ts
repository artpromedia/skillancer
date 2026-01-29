/**
 * @module @skillancer/skillpod-svc/routes/security-policy
 * Security policy management routes
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable import/order */

import { z } from 'zod';

import { requireAuth, requireAdmin } from '../plugins/auth.js';
import type { FastifyInstance } from 'fastify';
import type { SecurityPolicyService } from '../services/security-policy.service.js';
import type { PodSecurityPolicyInput } from '../types/containment.types.js';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const ClipboardPolicyEnum = z.enum([
  'BLOCKED',
  'READ_ONLY',
  'WRITE_ONLY',
  'BIDIRECTIONAL',
  'APPROVAL_REQUIRED',
]);

const FileTransferPolicyEnum = z.enum(['BLOCKED', 'ALLOWED', 'APPROVAL_REQUIRED', 'LOGGED_ONLY']);

const PrintingPolicyEnum = z.enum([
  'BLOCKED',
  'LOCAL_ONLY',
  'PDF_ONLY',
  'ALLOWED',
  'APPROVAL_REQUIRED',
]);

const UsbPolicyEnum = z.enum(['BLOCKED', 'STORAGE_BLOCKED', 'WHITELIST_ONLY', 'ALLOWED']);

const PeripheralPolicyEnum = z.enum(['BLOCKED', 'ALLOWED', 'SESSION_PROMPT']);

const NetworkPolicyEnum = z.enum(['BLOCKED', 'RESTRICTED', 'MONITORED', 'UNRESTRICTED']);

const WatermarkConfigSchema = z.object({
  text: z.string().optional(),
  showUsername: z.boolean().default(true),
  showTimestamp: z.boolean().default(false),
  showIpAddress: z.boolean().default(false),
  position: z.enum(['center', 'corner', 'tiled']).default('corner'),
  opacity: z.number().min(0).max(1).default(0.2),
  fontSize: z.number().min(8).max(72).default(12),
  color: z.string().default('#888888'),
});

const CreatePolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),

  // Clipboard controls
  clipboardPolicy: ClipboardPolicyEnum.optional(),
  clipboardInbound: z.boolean().optional(),
  clipboardOutbound: z.boolean().optional(),
  clipboardMaxSize: z.number().positive().optional(),
  clipboardAllowedTypes: z.array(z.string()).optional(),

  // File transfer controls
  fileDownloadPolicy: FileTransferPolicyEnum.optional(),
  fileUploadPolicy: FileTransferPolicyEnum.optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  blockedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().positive().optional(),

  // Printing controls
  printingPolicy: PrintingPolicyEnum.optional(),
  allowLocalPrinting: z.boolean().optional(),
  allowPdfExport: z.boolean().optional(),

  // Peripheral controls
  usbPolicy: UsbPolicyEnum.optional(),
  allowedUsbDevices: z.array(z.string()).optional(),
  webcamPolicy: PeripheralPolicyEnum.optional(),
  microphonePolicy: PeripheralPolicyEnum.optional(),

  // Screen capture controls
  screenCaptureBlocking: z.boolean().optional(),
  watermarkEnabled: z.boolean().optional(),
  watermarkConfig: WatermarkConfigSchema.optional(),

  // Network controls
  networkPolicy: NetworkPolicyEnum.optional(),
  allowedDomains: z.array(z.string()).optional(),
  blockedDomains: z.array(z.string()).optional(),
  allowInternet: z.boolean().optional(),

  // Session controls
  idleTimeout: z.number().min(1).max(480).optional(),
  maxSessionDuration: z.number().min(15).max(1440).optional(),
  requireMfa: z.boolean().optional(),

  // Audit settings
  recordSession: z.boolean().optional(),
  logKeystrokes: z.boolean().optional(),
  logClipboard: z.boolean().optional(),
  logFileAccess: z.boolean().optional(),
});

const UpdatePolicySchema = CreatePolicySchema.partial();

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

interface PolicyParams {
  policyId: string;
}

interface TenantQuery {
  tenantId: string;
}

interface CloneBody {
  newName: string;
}

export function securityPolicyRoutes(
  app: FastifyInstance,
  policyService: SecurityPolicyService
): void {
  // ===========================================================================
  // LIST POLICIES
  // ===========================================================================

  app.get<{ Querystring: TenantQuery }>(
    '/policies',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: z.object({
          tenantId: z.string().uuid(),
        }),
        response: {
          200: z.object({
            policies: z.array(z.any()),
          }),
        },
      },
    },
    async (request) => {
      const { tenantId } = request.query;
      const policies = await policyService.listPolicies(tenantId);
      return { policies };
    }
  );

  // ===========================================================================
  // GET POLICY
  // ===========================================================================

  app.get<{ Params: PolicyParams }>(
    '/policies/:policyId',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;
      const policy = await policyService.getPolicy(policyId);

      if (!policy) {
        return reply.status(404).send({ error: 'Policy not found' });
      }

      return { policy };
    }
  );

  // ===========================================================================
  // GET DEFAULT POLICY
  // ===========================================================================

  app.get<{ Querystring: TenantQuery }>(
    '/policies/default',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: z.object({
          tenantId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { tenantId } = request.query;
      const policy = await policyService.getDefaultPolicy(tenantId);

      if (!policy) {
        return reply.status(404).send({ error: 'No default policy found' });
      }

      return { policy };
    }
  );

  // ===========================================================================
  // CREATE POLICY
  // ===========================================================================

  app.post<{ Querystring: TenantQuery; Body: PodSecurityPolicyInput }>(
    '/policies',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: z.object({
          tenantId: z.string().uuid(),
        }),
        body: CreatePolicySchema,
      },
    },
    async (request, reply) => {
      const { tenantId } = request.query;
      const input = request.body;

      // Validate policy
      const validation = policyService.validatePolicy(input);
      if (!validation.valid) {
        return reply.status(400).send({
          error: 'Invalid policy configuration',
          details: validation.errors,
        });
      }

      const policy = await policyService.createPolicy(tenantId, input);
      return reply.status(201).send({ policy });
    }
  );

  // ===========================================================================
  // UPDATE POLICY
  // ===========================================================================

  app.patch<{ Params: PolicyParams; Body: Partial<PodSecurityPolicyInput> }>(
    '/policies/:policyId',
    {
      preHandler: [requireAdmin],
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
        body: UpdatePolicySchema,
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;
      const input = request.body;

      try {
        const policy = await policyService.updatePolicy(policyId, input);
        return { policy };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: 'Policy not found' });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // DELETE POLICY
  // ===========================================================================

  app.delete<{ Params: PolicyParams }>(
    '/policies/:policyId',
    {
      preHandler: [requireAdmin],
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;

      try {
        await policyService.deletePolicy(policyId);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('active sessions')) {
            return reply.status(409).send({ error: error.message });
          }
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: 'Policy not found' });
          }
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // SET DEFAULT POLICY
  // ===========================================================================

  app.post<{ Params: PolicyParams; Querystring: TenantQuery }>(
    '/policies/:policyId/set-default',
    {
      preHandler: [requireAdmin],
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
        querystring: z.object({
          tenantId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;
      const { tenantId } = request.query;

      try {
        const policy = await policyService.setDefaultPolicy(tenantId, policyId);
        return { policy };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // CLONE POLICY
  // ===========================================================================

  app.post<{ Params: PolicyParams; Body: CloneBody }>(
    '/policies/:policyId/clone',
    {
      preHandler: [requireAdmin],
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
        body: z.object({
          newName: z.string().min(1).max(100),
        }),
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;
      const { newName } = request.body;

      try {
        const policy = await policyService.clonePolicy(policyId, newName);
        return reply.status(201).send({ policy });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: 'Policy not found' });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // VALIDATE POLICY
  // ===========================================================================

  app.post<{ Body: PodSecurityPolicyInput }>(
    '/policies/validate',
    {
      preHandler: [requireAuth],
      schema: {
        body: CreatePolicySchema,
      },
    },
    async (request) => {
      const input = request.body;
      const validation = policyService.validatePolicy(input);
      return validation;
    }
  );
}
