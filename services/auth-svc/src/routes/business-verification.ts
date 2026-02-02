// @ts-nocheck
/**
 * @module @skillancer/auth-svc/routes/business-verification
 * Business Verification Routes
 *
 * Endpoints for:
 * - Starting business verification (agencies, companies)
 * - Uploading business documents
 * - Getting business verification status
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const logger = createLogger({ serviceName: 'business-verification' });

// =============================================================================
// SCHEMAS
// =============================================================================

const startBusinessVerificationSchema = z.object({
  businessType: z.enum(['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP', 'NON_PROFIT']),
  businessName: z.string().min(2).max(200),
  businessAddress: z.object({
    street: z.string().min(5),
    city: z.string().min(2),
    state: z.string().min(2).max(50),
    postalCode: z.string().min(3).max(20),
    country: z.string().length(2), // ISO country code
  }),
  taxIdType: z.enum(['EIN', 'SSN', 'VAT', 'OTHER']),
  taxIdNumber: z.string().min(5).max(50),
  website: z.string().url().optional(),
  yearEstablished: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

const uploadDocumentSchema = z.object({
  documentType: z.enum([
    'BUSINESS_LICENSE',
    'CERTIFICATE_OF_INCORPORATION',
    'TAX_REGISTRATION',
    'PROOF_OF_ADDRESS',
    'ARTICLES_OF_ORGANIZATION',
    'OPERATING_AGREEMENT',
    'EIN_LETTER',
    'OTHER',
  ]),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
});

const updateBusinessInfoSchema = z.object({
  businessName: z.string().min(2).max(200).optional(),
  businessAddress: z
    .object({
      street: z.string().min(5),
      city: z.string().min(2),
      state: z.string().min(2).max(50),
      postalCode: z.string().min(3).max(20),
      country: z.string().length(2),
    })
    .optional(),
  website: z.string().url().optional(),
  description: z.string().max(2000).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

const businessVerificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET BUSINESS VERIFICATION STATUS
  // ===========================================================================

  /**
   * GET /business-verification/status
   * Get current user's business verification status
   */
  fastify.get(
    '/status',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get business verification record
      const businessVerification = await prisma.businessVerification.findFirst({
        where: { userId },
        include: {
          documents: {
            select: {
              id: true,
              documentType: true,
              fileName: true,
              status: true,
              uploadedAt: true,
              verifiedAt: true,
              rejectionReason: true,
            },
            orderBy: { uploadedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!businessVerification) {
        return reply.send({
          hasBusinessProfile: false,
          status: 'NOT_STARTED',
          requiredDocuments: getRequiredDocuments('CORPORATION'),
          benefits: getBusinessVerificationBenefits(false),
        });
      }

      // Calculate verification progress
      const requiredDocs = getRequiredDocuments(businessVerification.businessType);
      const uploadedDocs = businessVerification.documents.map((d) => d.documentType);
      const verifiedDocs = businessVerification.documents
        .filter((d) => d.status === 'VERIFIED')
        .map((d) => d.documentType);

      const documentsProgress = {
        required: requiredDocs.length,
        uploaded: uploadedDocs.filter((d) => requiredDocs.includes(d)).length,
        verified: verifiedDocs.filter((d) => requiredDocs.includes(d)).length,
      };

      return reply.send({
        hasBusinessProfile: true,
        status: businessVerification.status,
        verifiedAt: businessVerification.verifiedAt?.toISOString() ?? null,
        business: {
          type: businessVerification.businessType,
          name: businessVerification.businessName,
          address: businessVerification.businessAddress,
          taxIdType: businessVerification.taxIdType,
          taxIdLastFour: businessVerification.taxIdNumber?.slice(-4) ?? null,
          website: businessVerification.website,
          yearEstablished: businessVerification.yearEstablished,
        },
        documents: businessVerification.documents.map((d) => ({
          id: d.id,
          type: d.documentType,
          fileName: d.fileName,
          status: d.status,
          uploadedAt: d.uploadedAt.toISOString(),
          verifiedAt: d.verifiedAt?.toISOString() ?? null,
          rejectionReason: d.rejectionReason,
        })),
        documentsProgress,
        requiredDocuments: requiredDocs,
        missingDocuments: requiredDocs.filter((d) => !uploadedDocs.includes(d)),
        benefits: getBusinessVerificationBenefits(businessVerification.status === 'VERIFIED'),
      });
    }
  );

  // ===========================================================================
  // START BUSINESS VERIFICATION
  // ===========================================================================

  /**
   * POST /business-verification/start
   * Start the business verification process
   */
  fastify.post(
    '/start',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = startBusinessVerificationSchema.parse(request.body);

      // Check for existing verification
      const existing = await prisma.businessVerification.findFirst({
        where: {
          userId,
          status: { in: ['PENDING', 'IN_REVIEW', 'VERIFIED'] },
        },
      });

      if (existing) {
        return reply.status(400).send({
          error: 'VERIFICATION_EXISTS',
          message: 'You already have an active or completed business verification',
          existingStatus: existing.status,
        });
      }

      // Create business verification record
      const verification = await prisma.businessVerification.create({
        data: {
          userId,
          businessType: body.businessType,
          businessName: body.businessName,
          businessAddress: body.businessAddress,
          taxIdType: body.taxIdType,
          taxIdNumber: body.taxIdNumber, // In production, encrypt this
          website: body.website,
          yearEstablished: body.yearEstablished,
          status: 'PENDING',
        },
      });

      logger.info(
        { userId, verificationId: verification.id, businessType: body.businessType },
        'Business verification started'
      );

      return reply.status(201).send({
        verificationId: verification.id,
        status: 'PENDING',
        businessType: body.businessType,
        businessName: body.businessName,
        requiredDocuments: getRequiredDocuments(body.businessType),
        nextStep: 'Upload required documents to complete verification',
      });
    }
  );

  // ===========================================================================
  // GET UPLOAD URL
  // ===========================================================================

  /**
   * POST /business-verification/documents/upload-url
   * Get a pre-signed URL for document upload
   */
  fastify.post(
    '/documents/upload-url',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = uploadDocumentSchema.parse(request.body);

      // Verify user has active business verification
      const verification = await prisma.businessVerification.findFirst({
        where: {
          userId,
          status: { in: ['PENDING', 'IN_REVIEW'] },
        },
      });

      if (!verification) {
        return reply.status(400).send({
          error: 'NO_ACTIVE_VERIFICATION',
          message: 'Please start business verification first',
        });
      }

      // Validate file type
      const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

      if (!allowedMimeTypes.includes(body.mimeType)) {
        return reply.status(400).send({
          error: 'INVALID_FILE_TYPE',
          message: 'Only PDF, JPEG, PNG, and WebP files are allowed',
          allowedTypes: allowedMimeTypes,
        });
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (body.fileSize > maxSize) {
        return reply.status(400).send({
          error: 'FILE_TOO_LARGE',
          message: 'File size must be less than 10MB',
          maxSize,
        });
      }

      // Create document record
      const document = await prisma.businessDocument.create({
        data: {
          businessVerificationId: verification.id,
          documentType: body.documentType,
          fileName: body.fileName,
          fileSize: body.fileSize,
          mimeType: body.mimeType,
          status: 'PENDING_UPLOAD',
          uploadedAt: new Date(),
        },
      });

      // Generate pre-signed upload URL (mock for now)
      const uploadKey = `business-docs/${userId}/${document.id}/${body.fileName}`;
      const uploadUrl = `https://storage.example.com/upload?key=${encodeURIComponent(uploadKey)}&token=mock_token`;

      logger.info(
        { userId, documentId: document.id, documentType: body.documentType },
        'Document upload URL generated'
      );

      return reply.status(201).send({
        documentId: document.id,
        uploadUrl,
        uploadKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        instructions: 'Use PUT request to upload file to the provided URL',
      });
    }
  );

  // ===========================================================================
  // CONFIRM DOCUMENT UPLOAD
  // ===========================================================================

  /**
   * POST /business-verification/documents/:documentId/confirm
   * Confirm that document was uploaded successfully
   */
  fastify.post(
    '/documents/:documentId/confirm',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { documentId } = request.params as { documentId: string };

      // Get document and verify ownership
      const document = await prisma.businessDocument.findUnique({
        where: { id: documentId },
        include: {
          businessVerification: {
            select: { userId: true, id: true },
          },
        },
      });

      if (!document) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      if (document.businessVerification.userId !== userId) {
        return reply.status(403).send({ error: 'Not authorized' });
      }

      if (document.status !== 'PENDING_UPLOAD') {
        return reply.status(400).send({
          error: 'INVALID_STATUS',
          message: 'Document has already been confirmed or processed',
        });
      }

      // Update document status
      await prisma.businessDocument.update({
        where: { id: documentId },
        data: {
          status: 'PENDING_REVIEW',
          uploadedAt: new Date(),
        },
      });

      // Check if all required documents are uploaded
      const verification = await prisma.businessVerification.findUnique({
        where: { id: document.businessVerification.id },
        include: {
          documents: {
            where: { status: { in: ['PENDING_REVIEW', 'VERIFIED'] } },
          },
        },
      });

      const requiredDocs = getRequiredDocuments(verification?.businessType ?? 'CORPORATION');
      const uploadedDocTypes = verification?.documents.map((d) => d.documentType) ?? [];
      const allDocsUploaded = requiredDocs.every((d) => uploadedDocTypes.includes(d));

      // If all required docs uploaded, move to review
      if (allDocsUploaded && verification?.status === 'PENDING') {
        await prisma.businessVerification.update({
          where: { id: verification.id },
          data: { status: 'IN_REVIEW' },
        });
      }

      logger.info({ userId, documentId }, 'Document upload confirmed');

      return reply.send({
        success: true,
        documentId,
        status: 'PENDING_REVIEW',
        allRequiredDocumentsUploaded: allDocsUploaded,
        verificationStatus: allDocsUploaded ? 'IN_REVIEW' : 'PENDING',
      });
    }
  );

  // ===========================================================================
  // UPDATE BUSINESS INFO
  // ===========================================================================

  /**
   * PATCH /business-verification/info
   * Update business information
   */
  fastify.patch(
    '/info',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = updateBusinessInfoSchema.parse(request.body);

      const verification = await prisma.businessVerification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!verification) {
        return reply.status(404).send({ error: 'No business verification found' });
      }

      // Only allow updates if not verified
      if (verification.status === 'VERIFIED') {
        return reply.status(400).send({
          error: 'CANNOT_UPDATE',
          message: 'Cannot update verified business information. Please contact support.',
        });
      }

      await prisma.businessVerification.update({
        where: { id: verification.id },
        data: {
          businessName: body.businessName ?? verification.businessName,
          businessAddress: body.businessAddress ?? verification.businessAddress,
          website: body.website ?? verification.website,
        },
      });

      logger.info({ userId, verificationId: verification.id }, 'Business info updated');

      return reply.send({
        success: true,
        message: 'Business information updated',
      });
    }
  );

  // ===========================================================================
  // GET DOCUMENT REQUIREMENTS
  // ===========================================================================

  /**
   * GET /business-verification/requirements
   * Get document requirements for each business type
   */
  fastify.get('/requirements', async (_request: FastifyRequest, reply: FastifyReply) => {
    const businessTypes = [
      'SOLE_PROPRIETOR',
      'LLC',
      'CORPORATION',
      'PARTNERSHIP',
      'NON_PROFIT',
    ] as const;

    const requirements = businessTypes.map((type) => ({
      businessType: type,
      displayName: getBusinessTypeDisplayName(type),
      requiredDocuments: getRequiredDocuments(type).map((docType) => ({
        type: docType,
        displayName: getDocumentDisplayName(docType),
        description: getDocumentDescription(docType),
      })),
    }));

    return reply.send({ requirements });
  });
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getRequiredDocuments(businessType: string): string[] {
  const requirements: Record<string, string[]> = {
    SOLE_PROPRIETOR: ['TAX_REGISTRATION', 'PROOF_OF_ADDRESS'],
    LLC: [
      'CERTIFICATE_OF_INCORPORATION',
      'ARTICLES_OF_ORGANIZATION',
      'EIN_LETTER',
      'PROOF_OF_ADDRESS',
    ],
    CORPORATION: [
      'CERTIFICATE_OF_INCORPORATION',
      'TAX_REGISTRATION',
      'EIN_LETTER',
      'PROOF_OF_ADDRESS',
    ],
    PARTNERSHIP: ['OPERATING_AGREEMENT', 'TAX_REGISTRATION', 'PROOF_OF_ADDRESS'],
    NON_PROFIT: [
      'CERTIFICATE_OF_INCORPORATION',
      'TAX_REGISTRATION',
      'EIN_LETTER',
      'PROOF_OF_ADDRESS',
    ],
  };

  return requirements[businessType] || requirements.CORPORATION;
}

function getBusinessTypeDisplayName(type: string): string {
  const names: Record<string, string> = {
    SOLE_PROPRIETOR: 'Sole Proprietor',
    LLC: 'Limited Liability Company (LLC)',
    CORPORATION: 'Corporation',
    PARTNERSHIP: 'Partnership',
    NON_PROFIT: 'Non-Profit Organization',
  };
  return names[type] || type;
}

function getDocumentDisplayName(docType: string): string {
  const names: Record<string, string> = {
    BUSINESS_LICENSE: 'Business License',
    CERTIFICATE_OF_INCORPORATION: 'Certificate of Incorporation',
    TAX_REGISTRATION: 'Tax Registration Certificate',
    PROOF_OF_ADDRESS: 'Proof of Business Address',
    ARTICLES_OF_ORGANIZATION: 'Articles of Organization',
    OPERATING_AGREEMENT: 'Operating Agreement',
    EIN_LETTER: 'EIN Confirmation Letter',
    OTHER: 'Other Document',
  };
  return names[docType] || docType;
}

function getDocumentDescription(docType: string): string {
  const descriptions: Record<string, string> = {
    BUSINESS_LICENSE: 'Official business license from your state or local government',
    CERTIFICATE_OF_INCORPORATION:
      'Certificate showing your business is legally registered as a corporation',
    TAX_REGISTRATION: 'Document showing your business tax registration number',
    PROOF_OF_ADDRESS: 'Utility bill, bank statement, or lease agreement showing business address',
    ARTICLES_OF_ORGANIZATION: 'LLC formation document filed with your state',
    OPERATING_AGREEMENT: 'Document outlining ownership and management structure',
    EIN_LETTER: 'IRS letter confirming your Employer Identification Number',
    OTHER: 'Additional supporting document',
  };
  return descriptions[docType] || '';
}

function getBusinessVerificationBenefits(isVerified: boolean): {
  label: string;
  available: boolean;
}[] {
  return [
    { label: 'Verified Business badge on profile', available: isVerified },
    { label: 'Higher project value limits', available: isVerified },
    { label: 'Team member management', available: isVerified },
    { label: 'Invoice with business details', available: isVerified },
    { label: 'Enterprise client access', available: isVerified },
    { label: 'Bulk hiring capabilities', available: isVerified },
    { label: 'Dedicated account manager', available: isVerified },
    { label: 'Custom contract terms', available: isVerified },
  ];
}

export default businessVerificationRoutes;
