// @ts-nocheck
/**
 * Verification API Routes
 * Internal and public endpoints for credential verification
 * Sprint M4: Portable Verified Work History
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { getWorkHistoryVerifier } from '../verification/work-history-verifier';
import { getEarningsVerifier } from '../verification/earnings-verifier';
import { getReviewVerifier } from '../verification/review-verifier';
import { getPortableCredentialService } from '../credentials/portable-credential';
import { PlatformRegistry } from '../integrations/platform-connector';

const router = Router();

// ============================================================================
// SCHEMAS
// ============================================================================

const SyncPlatformSchema = z.object({
  platformId: z.enum(['upwork', 'fiverr', 'freelancer', 'linkedin']),
  forceRefresh: z.boolean().optional().default(false),
});

const VerifyWorkHistorySchema = z.object({
  itemIds: z.array(z.string()).min(1).max(100),
  verificationLevel: z
    .enum(['PLATFORM_CONNECTED', 'PLATFORM_VERIFIED', 'CRYPTOGRAPHICALLY_SEALED'])
    .optional(),
});

const IssueCredentialSchema = z.object({
  type: z.enum(['WorkHistory', 'Earnings', 'Skills', 'Reviews', 'CompleteProfile']),
  itemIds: z.array(z.string()).optional(),
  includeBlockchainAnchor: z.boolean().optional().default(false),
});

const ExportCredentialSchema = z.object({
  credentialId: z.string(),
  format: z.enum([
    'json-ld',
    'jwt',
    'pdf',
    'png',
    'embed-html',
    'embed-markdown',
    'linkedin',
    'qr',
  ]),
});

const PublicVerifySchema = z.object({
  credentialId: z.string(),
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

interface AuthenticatedRequest extends Request {
  userId: string;
  tenantId?: string;
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  (req as AuthenticatedRequest).userId = userId;
  next();
};

// ============================================================================
// PLATFORM INTEGRATION ROUTES
// ============================================================================

/**
 * GET /api/v1/verification/platforms
 * List connected platforms and their sync status
 */
router.get('/platforms', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    const connections = await prisma.platformConnection.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        status: true,
        lastSyncAt: true,
        syncStats: true,
        createdAt: true,
      },
    });

    const platforms = [
      { id: 'upwork', name: 'Upwork', available: true },
      { id: 'fiverr', name: 'Fiverr', available: true },
      { id: 'freelancer', name: 'Freelancer.com', available: true },
      { id: 'linkedin', name: 'LinkedIn', available: false },
    ];

    const result = platforms.map((platform) => {
      const connection = connections.find((c) => c.platform === platform.id);
      return {
        ...platform,
        connected: !!connection,
        status: connection?.status || null,
        lastSyncAt: connection?.lastSyncAt || null,
        syncStats: connection?.syncStats || null,
      };
    });

    res.json({ platforms: result });
  } catch (error) {
    logger.error('Error fetching platforms', { error });
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

/**
 * POST /api/v1/verification/platforms/connect
 * Initiate OAuth connection to a platform
 */
router.post('/platforms/connect', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { platformId } = SyncPlatformSchema.pick({ platformId: true }).parse(req.body);

    const connector = PlatformRegistry.get(platformId);
    if (!connector) {
      return res.status(400).json({ error: 'Platform not supported' });
    }

    const redirectUri = `${process.env.API_BASE_URL}/api/v1/verification/platforms/callback`;
    const authUrl = connector.getAuthorizationUrl(redirectUri);

    // Store state for callback verification
    await prisma.oauthState.create({
      data: {
        userId,
        platform: platformId,
        state: new URL(authUrl).searchParams.get('state') || '',
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    res.json({ authorizationUrl: authUrl });
  } catch (error) {
    logger.error('Error initiating platform connection', { error });
    res.status(500).json({ error: 'Failed to initiate connection' });
  }
});

/**
 * GET /api/v1/verification/platforms/callback
 * OAuth callback handler
 */
router.get('/platforms/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${process.env.WEB_APP_URL}/dashboard/work-history?error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(
        `${process.env.WEB_APP_URL}/dashboard/work-history?error=invalid_callback`
      );
    }

    // Verify state and get user
    const oauthState = await prisma.oauthState.findFirst({
      where: {
        state: state as string,
        expiresAt: { gt: new Date() },
      },
    });

    if (!oauthState) {
      return res.redirect(`${process.env.WEB_APP_URL}/dashboard/work-history?error=invalid_state`);
    }

    const connector = PlatformRegistry.get(oauthState.platform);
    if (!connector) {
      return res.redirect(
        `${process.env.WEB_APP_URL}/dashboard/work-history?error=platform_not_found`
      );
    }

    // Exchange code for tokens
    const tokens = await connector.exchangeCodeForTokens(code as string, oauthState.redirectUri);

    // Store connection
    await prisma.platformConnection.upsert({
      where: {
        userId_platform: {
          userId: oauthState.userId,
          platform: oauthState.platform,
        },
      },
      create: {
        userId: oauthState.userId,
        platform: oauthState.platform,
        accessToken: tokens.accessToken, // In production, encrypt this
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        status: 'connected',
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        status: 'connected',
        updatedAt: new Date(),
      },
    });

    // Cleanup state
    await prisma.oauthState.delete({ where: { id: oauthState.id } });

    // Redirect with success
    res.redirect(
      `${process.env.WEB_APP_URL}/dashboard/work-history/connect/${oauthState.platform}?success=true`
    );
  } catch (error) {
    logger.error('OAuth callback error', { error });
    res.redirect(`${process.env.WEB_APP_URL}/dashboard/work-history?error=callback_failed`);
  }
});

/**
 * POST /api/v1/verification/platforms/sync
 * Sync data from a connected platform
 */
router.post('/platforms/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { platformId, forceRefresh } = SyncPlatformSchema.parse(req.body);

    const connection = await prisma.platformConnection.findUnique({
      where: {
        userId_platform: { userId, platform: platformId },
      },
    });

    if (!connection) {
      return res.status(400).json({ error: 'Platform not connected' });
    }

    const connector = PlatformRegistry.get(platformId);
    if (!connector) {
      return res.status(400).json({ error: 'Platform not supported' });
    }

    // Update status to syncing
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: { status: 'syncing' },
    });

    // Perform sync (in production, this would be a background job)
    try {
      await connector.connect(userId, connection.accessToken);

      const [profile, workHistory, reviews, earnings] = await Promise.all([
        connector.fetchProfile(),
        connector.fetchWorkHistory(),
        connector.fetchReviews(),
        connector.fetchEarnings(),
      ]);

      // Store work history items
      for (const item of workHistory) {
        await prisma.workHistoryItem.upsert({
          where: {
            userId_platform_externalId: {
              userId,
              platform: platformId,
              externalId: item.id,
            },
          },
          create: {
            userId,
            platform: platformId,
            externalId: item.id,
            title: item.title,
            client: item.client,
            category: item.category || '',
            startDate: item.startDate,
            endDate: item.endDate,
            amount: item.totalAmount || 0,
            currency: item.currency || 'USD',
            status: item.status,
            description: item.description || '',
            skills: item.skills || [],
            verificationLevel: 'PLATFORM_CONNECTED',
            rawData: item as any,
          },
          update: {
            title: item.title,
            client: item.client,
            category: item.category || '',
            startDate: item.startDate,
            endDate: item.endDate,
            amount: item.totalAmount || 0,
            status: item.status,
            description: item.description || '',
            skills: item.skills || [],
            rawData: item as any,
            updatedAt: new Date(),
          },
        });
      }

      // Store reviews
      for (const review of reviews) {
        await prisma.review.upsert({
          where: {
            userId_platform_externalId: {
              userId,
              platform: platformId,
              externalId: review.id,
            },
          },
          create: {
            userId,
            platform: platformId,
            externalId: review.id,
            projectId: review.projectId,
            rating: review.rating,
            text: review.text || '',
            reviewerName: review.reviewerName || 'Anonymous',
            reviewDate: review.date,
          },
          update: {
            rating: review.rating,
            text: review.text || '',
            reviewerName: review.reviewerName || 'Anonymous',
            reviewDate: review.date,
            updatedAt: new Date(),
          },
        });
      }

      // Update connection with sync stats
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          status: 'connected',
          lastSyncAt: new Date(),
          syncStats: {
            projects: workHistory.length,
            reviews: reviews.length,
            totalEarnings: earnings.total,
            lastSync: new Date().toISOString(),
          },
        },
      });

      res.json({
        success: true,
        stats: {
          projects: workHistory.length,
          reviews: reviews.length,
          earnings: earnings.total,
        },
      });
    } catch (syncError) {
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: { status: 'error' },
      });
      throw syncError;
    }
  } catch (error) {
    logger.error('Error syncing platform', { error });
    res.status(500).json({ error: 'Failed to sync platform' });
  }
});

/**
 * DELETE /api/v1/verification/platforms/:platformId
 * Disconnect a platform
 */
router.delete('/platforms/:platformId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { platformId } = req.params;

    await prisma.platformConnection.delete({
      where: {
        userId_platform: { userId, platform: platformId },
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error disconnecting platform', { error });
    res.status(500).json({ error: 'Failed to disconnect platform' });
  }
});

// ============================================================================
// WORK HISTORY ROUTES
// ============================================================================

/**
 * GET /api/v1/verification/work-history
 * Get user's work history with verification status
 */
router.get('/work-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { platform, verified, limit = 50, offset = 0 } = req.query;

    const where: any = { userId };
    if (platform) where.platform = platform;
    if (verified === 'true') {
      where.verificationLevel = { in: ['PLATFORM_VERIFIED', 'CRYPTOGRAPHICALLY_SEALED'] };
    }

    const [items, total] = await Promise.all([
      prisma.workHistoryItem.findMany({
        where,
        orderBy: { startDate: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.workHistoryItem.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + items.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching work history', { error });
    res.status(500).json({ error: 'Failed to fetch work history' });
  }
});

/**
 * POST /api/v1/verification/work-history
 * Add manual work history entry
 */
router.post('/work-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    const item = await prisma.workHistoryItem.create({
      data: {
        userId,
        platform: 'manual',
        externalId: `manual-${Date.now()}`,
        title: req.body.title,
        client: req.body.client,
        category: req.body.category || '',
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        amount: req.body.amount || 0,
        currency: req.body.currency || 'USD',
        status: 'completed',
        description: req.body.description || '',
        skills: req.body.skills || [],
        verificationLevel: 'SELF_REPORTED',
      },
    });

    res.status(201).json({ item });
  } catch (error) {
    logger.error('Error creating work history item', { error });
    res.status(500).json({ error: 'Failed to create work history item' });
  }
});

/**
 * POST /api/v1/verification/work-history/verify
 * Verify work history items
 */
router.post('/work-history/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { itemIds, verificationLevel } = VerifyWorkHistorySchema.parse(req.body);

    const verifier = getWorkHistoryVerifier();
    const results: any[] = [];

    for (const itemId of itemIds) {
      const item = await prisma.workHistoryItem.findFirst({
        where: { id: itemId, userId },
      });

      if (!item) {
        results.push({ id: itemId, error: 'Not found' });
        continue;
      }

      const verification = await verifier.verify({
        id: item.id,
        title: item.title,
        client: { name: item.client },
        platform: item.platform,
        startDate: item.startDate,
        endDate: item.endDate || undefined,
        totalAmount: item.amount,
        currency: item.currency,
        status: item.status,
      });

      await prisma.workHistoryItem.update({
        where: { id: item.id },
        data: {
          verificationLevel: verification.level,
          verificationHash: verification.hash,
          verificationData: verification as any,
          verifiedAt: new Date(),
        },
      });

      results.push({
        id: item.id,
        level: verification.level,
        score: verification.score,
        checks: verification.checks,
      });
    }

    res.json({ results });
  } catch (error) {
    logger.error('Error verifying work history', { error });
    res.status(500).json({ error: 'Failed to verify work history' });
  }
});

// ============================================================================
// CREDENTIAL ROUTES
// ============================================================================

/**
 * GET /api/v1/verification/credentials
 * List user's credentials
 */
router.get('/credentials', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;

    const credentials = await prisma.verifiableCredential.findMany({
      where: {
        subjectId: userId,
        status: { not: 'revoked' },
      },
      orderBy: { issuedAt: 'desc' },
    });

    res.json({ credentials });
  } catch (error) {
    logger.error('Error fetching credentials', { error });
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

/**
 * POST /api/v1/verification/credentials/issue
 * Issue a new verifiable credential
 */
router.post('/credentials/issue', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { type, itemIds, includeBlockchainAnchor } = IssueCredentialSchema.parse(req.body);

    const credentialService = getPortableCredentialService();

    // Gather data based on credential type
    let credentialData: any;

    if (type === 'WorkHistory' && itemIds) {
      const items = await prisma.workHistoryItem.findMany({
        where: { id: { in: itemIds }, userId },
      });
      credentialData = items;
    } else if (type === 'CompleteProfile') {
      const [items, reviews, connections] = await Promise.all([
        prisma.workHistoryItem.findMany({ where: { userId } }),
        prisma.review.findMany({ where: { userId } }),
        prisma.platformConnection.findMany({ where: { userId, status: 'connected' } }),
      ]);
      credentialData = { items, reviews, connections };
    }

    const credential = await credentialService.issueCredential(
      type,
      { id: userId },
      credentialData
    );

    // Store credential
    await prisma.verifiableCredential.create({
      data: {
        id: credential.id,
        type: type,
        subjectId: userId,
        credential: credential as any,
        issuedAt: new Date(credential.issuanceDate),
        expiresAt: credential.expirationDate ? new Date(credential.expirationDate) : null,
        status: 'active',
      },
    });

    res.status(201).json({ credential });
  } catch (error) {
    logger.error('Error issuing credential', { error });
    res.status(500).json({ error: 'Failed to issue credential' });
  }
});

/**
 * POST /api/v1/verification/credentials/export
 * Export credential in various formats
 */
router.post('/credentials/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { credentialId, format } = ExportCredentialSchema.parse(req.body);

    const storedCredential = await prisma.verifiableCredential.findFirst({
      where: { id: credentialId, subjectId: userId },
    });

    if (!storedCredential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const credentialService = getPortableCredentialService();
    let result: any;

    switch (format) {
      case 'json-ld':
        result = {
          format: 'json-ld',
          data: storedCredential.credential,
          contentType: 'application/ld+json',
        };
        break;

      case 'jwt':
        // In production, sign as JWT
        result = {
          format: 'jwt',
          data: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
          contentType: 'application/jwt',
        };
        break;

      case 'pdf':
        result = {
          format: 'pdf',
          downloadUrl: `${process.env.API_BASE_URL}/api/v1/verification/credentials/${credentialId}/download/pdf`,
          contentType: 'application/pdf',
        };
        break;

      case 'png':
        result = {
          format: 'png',
          downloadUrl: `${process.env.API_BASE_URL}/api/v1/verification/credentials/${credentialId}/download/png`,
          contentType: 'image/png',
        };
        break;

      case 'embed-html':
        result = {
          format: 'embed-html',
          data: `<a href="${process.env.WEB_APP_URL}/verify/${credentialId}" target="_blank" rel="noopener"><img src="${process.env.API_BASE_URL}/api/v1/verification/credentials/${credentialId}/badge.svg" alt="Verified by Skillancer" /></a>`,
          contentType: 'text/html',
        };
        break;

      case 'embed-markdown':
        result = {
          format: 'embed-markdown',
          data: `[![Verified by Skillancer](${process.env.API_BASE_URL}/api/v1/verification/credentials/${credentialId}/badge.svg)](${process.env.WEB_APP_URL}/verify/${credentialId})`,
          contentType: 'text/markdown',
        };
        break;

      case 'linkedin':
        const cred = storedCredential.credential as any;
        result = {
          format: 'linkedin',
          addToProfileUrl: `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cred.credentialSubject?.title || 'Verified Freelancer')}&organizationName=Skillancer&issueYear=${new Date(storedCredential.issuedAt).getFullYear()}&issueMonth=${new Date(storedCredential.issuedAt).getMonth() + 1}&certUrl=${encodeURIComponent(`${process.env.WEB_APP_URL}/verify/${credentialId}`)}`,
        };
        break;

      case 'qr':
        result = {
          format: 'qr',
          downloadUrl: `${process.env.API_BASE_URL}/api/v1/verification/credentials/${credentialId}/qr.png`,
          verificationUrl: `${process.env.WEB_APP_URL}/verify/${credentialId}`,
        };
        break;
    }

    res.json(result);
  } catch (error) {
    logger.error('Error exporting credential', { error });
    res.status(500).json({ error: 'Failed to export credential' });
  }
});

/**
 * POST /api/v1/verification/credentials/:credentialId/revoke
 * Revoke a credential
 */
router.post(
  '/credentials/:credentialId/revoke',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { credentialId } = req.params;
      const { reason } = req.body;

      const credential = await prisma.verifiableCredential.findFirst({
        where: { id: credentialId, subjectId: userId },
      });

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      await prisma.verifiableCredential.update({
        where: { id: credentialId },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revocationReason: reason,
        },
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error revoking credential', { error });
      res.status(500).json({ error: 'Failed to revoke credential' });
    }
  }
);

// ============================================================================
// PUBLIC VERIFICATION ROUTES
// ============================================================================

/**
 * GET /api/v1/verify/:credentialId
 * Public endpoint to verify a credential
 */
router.get('/verify/:credentialId', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;

    const storedCredential = await prisma.verifiableCredential.findUnique({
      where: { id: credentialId },
    });

    if (!storedCredential) {
      return res.status(404).json({
        verified: false,
        error: 'Credential not found',
      });
    }

    const now = new Date();
    const isExpired = storedCredential.expiresAt && storedCredential.expiresAt < now;
    const isRevoked = storedCredential.status === 'revoked';

    if (isRevoked) {
      return res.json({
        verified: false,
        status: 'revoked',
        revokedAt: storedCredential.revokedAt,
        reason: storedCredential.revocationReason,
      });
    }

    if (isExpired) {
      return res.json({
        verified: false,
        status: 'expired',
        expiredAt: storedCredential.expiresAt,
      });
    }

    // Log verification
    await prisma.credentialVerificationLog.create({
      data: {
        credentialId,
        verifiedAt: now,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
      },
    });

    res.json({
      verified: true,
      status: 'valid',
      credential: storedCredential.credential,
      issuedAt: storedCredential.issuedAt,
      expiresAt: storedCredential.expiresAt,
    });
  } catch (error) {
    logger.error('Error verifying credential', { error });
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * GET /api/v1/verify/:credentialId/badge.svg
 * Get SVG badge for embedding
 */
router.get('/verify/:credentialId/badge.svg', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;

    const storedCredential = await prisma.verifiableCredential.findUnique({
      where: { id: credentialId },
    });

    const isValid =
      storedCredential &&
      storedCredential.status === 'active' &&
      (!storedCredential.expiresAt || storedCredential.expiresAt > new Date());

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" viewBox="0 0 200 40">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${isValid ? '#4F46E5' : '#6B7280'};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${isValid ? '#7C3AED' : '#9CA3AF'};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="200" height="40" rx="8" fill="url(#bg)"/>
        <text x="50" y="25" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
          ${isValid ? '✓ Verified' : '✗ Invalid'}
        </text>
        <text x="120" y="25" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif" font-size="12">
          Skillancer
        </text>
      </svg>
    `;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.send(svg);
  } catch (error) {
    logger.error('Error generating badge', { error });
    res.status(500).send('Error generating badge');
  }
});

export const verificationRoutes = router;
