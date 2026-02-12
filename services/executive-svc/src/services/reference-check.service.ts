/**
 * Reference Check Service
 *
 * Handles executive reference management and verification:
 * - Adding references
 * - Sending reference requests
 * - Processing reference responses
 * - Scoring references
 * - Verification workflows
 */

import { prisma } from '@skillancer/database';
import type {
  ExecutiveReference,
  ReferenceStatus,
  ReferenceRelationship,
} from '../types/prisma-shim.js';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config/index.js';

// Types
export interface AddReferenceInput {
  executiveId: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  relationship: ReferenceRelationship;
  yearsKnown: number;
  workedTogetherAt?: string;
}

export interface ReferenceResponseInput {
  rating: number; // 1-10
  wouldRecommend: boolean;
  leadershipRating?: number;
  technicalRating?: number;
  communicationRating?: number;
  strategicRating?: number;
  strengths: string[];
  areasForGrowth: string[];
  comments?: string;
  additionalContext?: string;
}

// Scoring weights
const REFERENCE_SCORING = {
  overallRating: 0.3,
  wouldRecommend: 0.25,
  subRatings: 0.25, // Average of leadership, technical, etc.
  relationshipWeight: 0.1,
  yearsKnownWeight: 0.1,
};

// Relationship quality scores
const RELATIONSHIP_SCORES: Record<ReferenceRelationship, number> = {
  REPORTED_TO: 100, // Most valuable - their boss
  BOARD_MEMBER: 95,
  INVESTOR: 85,
  PEER: 80,
  CLIENT: 75,
  DIRECT_REPORT: 70,
};

/**
 * Add a new reference
 */
export async function addReference(input: AddReferenceInput): Promise<ExecutiveReference> {
  // Validate email domain (no personal emails for professional refs)
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
  const emailDomain = input.email.split('@')[1]?.toLowerCase();

  if (personalDomains.includes(emailDomain)) {
    throw new Error('Please provide a professional/work email address for references');
  }

  // Check for duplicate references
  const existing = await prisma.executiveReference.findFirst({
    where: {
      executiveId: input.executiveId,
      email: input.email.toLowerCase(),
    },
  });

  if (existing) {
    throw new Error('A reference with this email already exists');
  }

  // Check reference count
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: input.executiveId },
    include: {
      _count: {
        select: { references: true },
      },
    },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  const reference = await prisma.executiveReference.create({
    data: {
      executiveId: input.executiveId,
      name: input.name,
      title: input.title,
      company: input.company,
      email: input.email.toLowerCase(),
      phone: input.phone,
      linkedinUrl: input.linkedinUrl,
      relationship: input.relationship,
      yearsKnown: input.yearsKnown,
      workedTogetherAt: input.workedTogetherAt,
      status: 'PENDING',
    },
  });

  // Log vetting event
  await prisma.vettingEvent.create({
    data: {
      executiveId: input.executiveId,
      eventType: 'REFERENCE_ADDED',
      actorType: 'executive',
      description: `Reference added: ${input.name} (${input.relationship})`,
      metadata: { referenceId: reference.id },
    },
  });

  return reference;
}

/**
 * Request reference (send email)
 */
export async function requestReference(referenceId: string): Promise<ExecutiveReference> {
  const config = getConfig();

  const reference = await prisma.executiveReference.findUnique({
    where: { id: referenceId },
    include: {
      executive: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!reference) {
    throw new Error('Reference not found');
  }

  if (reference.status !== 'PENDING') {
    throw new Error('Reference has already been requested');
  }

  // Generate secure token
  const tokenPayload = {
    referenceId: reference.id,
    executiveId: reference.executiveId,
    email: reference.email,
  };

  const token = jwt.sign(tokenPayload, config.referenceTokenSecret, {
    expiresIn: `${config.referenceTokenExpiryDays}d`,
  });

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + config.referenceTokenExpiryDays);

  // Update reference with token
  const updated = await prisma.executiveReference.update({
    where: { id: referenceId },
    data: {
      status: 'REQUESTED',
      requestToken: token,
      requestTokenExpiry: expiryDate,
      requestSentAt: new Date(),
    },
  });

  // Log vetting event
  await prisma.vettingEvent.create({
    data: {
      executiveId: reference.executiveId,
      eventType: 'REFERENCE_REQUESTED',
      actorType: 'system',
      description: `Reference request sent to ${reference.name}`,
      metadata: { referenceId },
    },
  });

  // TODO: Send email via notification service
  // The email would include:
  // - Executive's name
  // - Relationship context
  // - Link to submit reference: /references/{token}

  return updated;
}

/**
 * Send reminder to reference
 */
export async function sendReferenceReminder(referenceId: string): Promise<ExecutiveReference> {
  const reference = await prisma.executiveReference.findUnique({
    where: { id: referenceId },
    include: {
      executive: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!reference) {
    throw new Error('Reference not found');
  }

  if (reference.status !== 'REQUESTED') {
    throw new Error('Reference is not in requested status');
  }

  // Update reminder count
  const updated = await prisma.executiveReference.update({
    where: { id: referenceId },
    data: {
      reminderSentAt: new Date(),
      reminderCount: reference.reminderCount + 1,
    },
  });

  // TODO: Send reminder email

  return updated;
}

/**
 * Get reference request details (for public reference submission page)
 */
export async function getReferenceRequest(token: string): Promise<{
  reference: ExecutiveReference;
  executiveName: string;
  relationship: string;
  context: string;
} | null> {
  const config = getConfig();

  try {
    const payload = jwt.verify(token, config.referenceTokenSecret) as {
      referenceId: string;
      executiveId: string;
      email: string;
    };

    const reference = await prisma.executiveReference.findUnique({
      where: { id: payload.referenceId },
      include: {
        executive: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!reference) {
      return null;
    }

    // Check if token matches and not expired
    if (reference.requestToken !== token) {
      return null;
    }

    if (reference.requestTokenExpiry && reference.requestTokenExpiry < new Date()) {
      // Mark as expired
      await prisma.executiveReference.update({
        where: { id: reference.id },
        data: { status: 'EXPIRED' },
      });
      return null;
    }

    // Already completed
    if (reference.status === 'COMPLETED') {
      return null;
    }

    const executiveName = `${reference.executive.user.firstName} ${reference.executive.user.lastName}`;

    return {
      reference: { ...reference, executive: undefined } as ExecutiveReference,
      executiveName,
      relationship: reference.relationship,
      context: reference.workedTogetherAt
        ? `You worked together at ${reference.workedTogetherAt}`
        : 'Professional reference',
    };
  } catch {
    return null;
  }
}

/**
 * Submit reference response
 */
export async function submitReferenceResponse(
  token: string,
  input: ReferenceResponseInput
): Promise<ExecutiveReference> {
  const config = getConfig();

  // Verify token
  let payload: { referenceId: string; executiveId: string; email: string };
  try {
    payload = jwt.verify(token, config.referenceTokenSecret) as typeof payload;
  } catch {
    throw new Error('Invalid or expired reference link');
  }

  const reference = await prisma.executiveReference.findUnique({
    where: { id: payload.referenceId },
  });

  if (!reference) {
    throw new Error('Reference not found');
  }

  if (reference.requestToken !== token) {
    throw new Error('Invalid reference link');
  }

  if (reference.status === 'COMPLETED') {
    throw new Error('Reference has already been submitted');
  }

  // Calculate reference score
  const score = calculateReferenceScore(input, reference);

  // Update reference with response
  const updated = await prisma.executiveReference.update({
    where: { id: reference.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      rating: input.rating,
      wouldRecommend: input.wouldRecommend,
      leadershipRating: input.leadershipRating,
      technicalRating: input.technicalRating,
      communicationRating: input.communicationRating,
      strategicRating: input.strategicRating,
      strengths: input.strengths,
      areasForGrowth: input.areasForGrowth,
      comments: input.comments,
      additionalContext: input.additionalContext,
      referenceScore: score,
      // Clear token after use
      requestToken: null,
    },
  });

  // Log vetting event
  await prisma.vettingEvent.create({
    data: {
      executiveId: reference.executiveId,
      eventType: 'REFERENCE_COMPLETED',
      actorType: 'system',
      description: `Reference received from ${reference.name} (score: ${score})`,
      metadata: {
        referenceId: reference.id,
        score,
        wouldRecommend: input.wouldRecommend,
      },
    },
  });

  // Update executive's verified reference count
  await updateVerifiedReferenceCount(reference.executiveId);

  // Check if all required references are complete
  await checkReferenceCompletion(reference.executiveId);

  return updated;
}

/**
 * Calculate reference score (0-100)
 */
function calculateReferenceScore(
  input: ReferenceResponseInput,
  reference: ExecutiveReference
): number {
  // Overall rating (30%) - scale 1-10 to 0-100
  const overallRatingScore = (input.rating / 10) * 100 * REFERENCE_SCORING.overallRating;

  // Would recommend (25%)
  const recommendScore = input.wouldRecommend ? 100 : 0;
  const recommendWeighted = recommendScore * REFERENCE_SCORING.wouldRecommend;

  // Sub-ratings average (25%)
  const subRatings = [
    input.leadershipRating,
    input.technicalRating,
    input.communicationRating,
    input.strategicRating,
  ].filter((r): r is number => r !== undefined);

  const avgSubRating =
    subRatings.length > 0
      ? subRatings.reduce((a, b) => a + b, 0) / subRatings.length
      : input.rating; // Fall back to overall rating

  const subRatingsScore = (avgSubRating / 10) * 100 * REFERENCE_SCORING.subRatings;

  // Relationship quality (10%)
  const relationshipScore =
    RELATIONSHIP_SCORES[reference.relationship] * REFERENCE_SCORING.relationshipWeight;

  // Years known (10%) - more years = more weight, capped at 10 years
  const yearsKnownCapped = Math.min(reference.yearsKnown, 10);
  const yearsScore = (yearsKnownCapped / 10) * 100 * REFERENCE_SCORING.yearsKnownWeight;

  return Math.round(
    overallRatingScore + recommendWeighted + subRatingsScore + relationshipScore + yearsScore
  );
}

/**
 * Update verified reference count for executive
 */
async function updateVerifiedReferenceCount(executiveId: string): Promise<void> {
  const completedCount = await prisma.executiveReference.count({
    where: {
      executiveId,
      status: 'COMPLETED',
    },
  });

  await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: { referencesVerified: completedCount },
  });
}

/**
 * Check if all required references are complete and advance vetting if so
 */
async function checkReferenceCompletion(executiveId: string): Promise<void> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile) return;

  const completedCount = await prisma.executiveReference.count({
    where: {
      executiveId,
      status: 'COMPLETED',
    },
  });

  if (completedCount >= profile.referencesRequired && profile.vettingStage === 'REFERENCE_CHECK') {
    // Calculate average reference score
    const references = await prisma.executiveReference.findMany({
      where: {
        executiveId,
        status: 'COMPLETED',
      },
    });

    const avgScore =
      references.length > 0
        ? Math.round(
            references.reduce((sum, r) => sum + (r.referenceScore || 0), 0) / references.length
          )
        : 0;

    // Update profile with average score
    await prisma.executiveProfile.update({
      where: { id: executiveId },
      data: {
        vettingStage: 'BACKGROUND_CHECK',
        vettingNotes: `Reference check complete. Average score: ${avgScore}`,
      },
    });

    // Log stage advancement
    await prisma.vettingEvent.create({
      data: {
        executiveId,
        eventType: 'STAGE_ADVANCED',
        fromStage: 'REFERENCE_CHECK',
        toStage: 'BACKGROUND_CHECK',
        actorType: 'system',
        description: `All ${profile.referencesRequired} references completed. Average score: ${avgScore}`,
      },
    });

    // TODO: Trigger background check
  }
}

/**
 * Verify reference manually (admin)
 */
export async function verifyReference(
  referenceId: string,
  verified: boolean,
  adminId: string,
  notes?: string
): Promise<ExecutiveReference> {
  const reference = await prisma.executiveReference.update({
    where: { id: referenceId },
    data: {
      verified,
      verifiedBy: adminId,
      verificationNotes: notes,
    },
  });

  return reference;
}

/**
 * Flag suspicious reference
 */
export async function flagReference(
  referenceId: string,
  reason: string
): Promise<ExecutiveReference> {
  return prisma.executiveReference.update({
    where: { id: referenceId },
    data: {
      flagged: true,
      flagReason: reason,
    },
  });
}

/**
 * Get all references for an executive
 */
export async function getExecutiveReferences(executiveId: string): Promise<ExecutiveReference[]> {
  return prisma.executiveReference.findMany({
    where: { executiveId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete a reference (only if not yet requested)
 */
export async function deleteReference(referenceId: string, executiveId: string): Promise<void> {
  const reference = await prisma.executiveReference.findFirst({
    where: { id: referenceId, executiveId },
  });

  if (!reference) {
    throw new Error('Reference not found');
  }

  if (reference.status !== 'PENDING') {
    throw new Error('Cannot delete a reference that has already been requested');
  }

  await prisma.executiveReference.delete({
    where: { id: referenceId },
  });
}
