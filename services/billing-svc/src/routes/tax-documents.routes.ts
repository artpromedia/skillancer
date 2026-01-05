// @ts-nocheck
/**
 * Tax Documents API Routes
 * 1099s, summaries, and export endpoints
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '@skillancer/logger';
import { Router, type Request, type Response } from 'express';

import { getTaxDocumentsService } from '../tax/tax-documents-service.js';
import { getTaxPrepIntegration } from '../tax/tax-prep-integration.js';

const logger = createLogger({ serviceName: 'tax-documents-routes' });
const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      logger.error('Route error', { error, path: req.path });
      res.status(500).json({ error: 'Internal server error' });
    });
  };
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /tax/documents
 * List tax documents
 */
router.get(
  '/documents',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = req.query.year ? Number.parseInt(req.query.year as string) : undefined;
    const type = req.query.type as string | undefined;

    const taxDocsService = getTaxDocumentsService();
    const documents = await taxDocsService.getDocuments(userId, { year, type });

    res.json({ documents });
  })
);

/**
 * GET /tax/documents/:id
 * Get document details
 */
router.get(
  '/documents/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const taxDocsService = getTaxDocumentsService();
    const document = await taxDocsService.getDocumentById(id, userId);

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ document });
  })
);

/**
 * GET /tax/documents/:id/download
 * Download document PDF
 */
router.get(
  '/documents/:id/download',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const taxDocsService = getTaxDocumentsService();
    const downloadUrl = await taxDocsService.getDownloadUrl(id, userId);

    if (!downloadUrl) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ downloadUrl });
  })
);

/**
 * POST /tax/documents/upload
 * Upload external 1099
 */
router.post(
  '/documents/upload',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { type, year, issuer, amount, fileUrl } = req.body;

    if (!type || !year || !issuer) {
      res.status(400).json({ error: 'type, year, and issuer required' });
      return;
    }

    const taxDocsService = getTaxDocumentsService();
    const document = await taxDocsService.uploadExternalDocument({
      userId,
      type,
      year,
      issuer,
      amount,
      fileUrl,
    });

    res.json({ document });
  })
);

/**
 * GET /tax/summary/:year
 * Get annual tax summary
 */
router.get(
  '/summary/:year',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = Number.parseInt(req.params.year);
    if (isNaN(year)) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const taxDocsService = getTaxDocumentsService();
    const summary = await taxDocsService.getAnnualSummary(userId, year);

    res.json({ summary });
  })
);

/**
 * GET /tax/export/turbotax
 * Export data for TurboTax
 */
router.get(
  '/export/turbotax',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = Number.parseInt(req.query.year as string) || new Date().getFullYear() - 1;

    const integration = getTaxPrepIntegration();
    const exportData = await integration.exportForTurboTax(userId, year);

    res.json({ data: exportData });
  })
);

/**
 * POST /tax/integrations/turbotax/connect
 * Connect TurboTax account
 */
router.post(
  '/integrations/turbotax/connect',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { authCode, redirectUri } = req.body;

    const integration = getTaxPrepIntegration();
    const result = await integration.connectTurboTax(userId, authCode, redirectUri);

    res.json(result);
  })
);

/**
 * DELETE /tax/integrations/turbotax
 * Disconnect TurboTax
 */
router.delete(
  '/integrations/turbotax',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const integration = getTaxPrepIntegration();
    await integration.disconnectTurboTax(userId);

    res.json({ success: true });
  })
);

/**
 * GET /tax/integrations
 * Get connected integrations
 */
router.get(
  '/integrations',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const integration = getTaxPrepIntegration();
    const integrations = await integration.getConnectedIntegrations(userId);

    res.json({ integrations });
  })
);

export default router;

