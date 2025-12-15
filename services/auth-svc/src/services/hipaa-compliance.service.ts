/**
 * @module @skillancer/auth-svc/services/hipaa-compliance
 * HIPAA Compliance Management Service
 */

import {
  prisma,
  type HipaaCompliance,
  type PhiAccessLog,
  type HipaaTraining,
  type Prisma,
  HipaaComplianceLevel,
  BaaStatus,
  HipaaTrainingType,
  TrainingStatus,
} from '@skillancer/database';
import { createLogger } from '@skillancer/logger';

import type {
  EnableHipaaComplianceParams,
  HipaaComplianceStatus,
  HipaaComplianceOptions,
  CheckPhiAccessParams,
  PhiAccessCheckResult,
  AccessCheck,
  LogPhiAccessParams,
  RequestBaaParams,
  CompleteBaaSigningParams,
  TrainingRequirements,
  TrainingRequirement,
  RecordTrainingCompletionParams,
  ComplianceAssessment,
  AssessmentItem,
  AssessmentItemStatus,
  Recommendation,
  RecommendationPriority,
} from '../types/hipaa.types.js';

const logger = createLogger({ serviceName: 'hipaa-compliance' });

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine compliance status based on a rate/score threshold
 */
function getComplianceStatusFromRate(
  rate: number,
  highThreshold: number,
  partialThreshold: number
): AssessmentItemStatus {
  if (rate >= highThreshold) return 'COMPLIANT';
  if (rate >= partialThreshold) return 'PARTIAL';
  return 'NON_COMPLIANT';
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REQUIRED_TRAINING_TYPES: HipaaTrainingType[] = [
  HipaaTrainingType.AWARENESS,
  HipaaTrainingType.SECURITY,
  HipaaTrainingType.PRIVACY,
];

const PASSING_SCORE = 80;
const TRAINING_VALIDITY_YEARS = 1;
const ASSESSMENT_INTERVAL_MONTHS = 3;
const DEFAULT_AUDIT_RETENTION_YEARS = 6;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;

// =============================================================================
// HIPAA COMPLIANCE SERVICE
// =============================================================================

/**
 * Enable HIPAA compliance for a tenant
 */
export async function enableHipaaCompliance(
  params: EnableHipaaComplianceParams
): Promise<HipaaCompliance> {
  const { tenantId, adminUserId, options } = params;

  logger.info({ tenantId, adminUserId }, 'Enabling HIPAA compliance for tenant');

  // Validate prerequisites
  await validateHipaaPrerequisites(tenantId);

  // Calculate next assessment date
  const nextAssessmentDue = calculateNextAssessmentDate();

  // Create or update compliance record
  const compliance = await prisma.hipaaCompliance.upsert({
    where: { tenantId },
    update: {
      hipaaEnabled: true,
      complianceLevel: HipaaComplianceLevel.BASIC,
      mfaRequired: options?.mfaRequired ?? true,
      sessionTimeout: options?.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT_MINUTES,
      ipWhitelist: options?.ipWhitelist ?? [],
      encryptionEnabled: true,
      enhancedAuditEnabled: true,
      trainingRequired: true,
      auditRetentionYears: options?.auditRetentionYears ?? DEFAULT_AUDIT_RETENTION_YEARS,
      nextAssessmentDue,
    },
    create: {
      tenantId,
      hipaaEnabled: true,
      complianceLevel: HipaaComplianceLevel.BASIC,
      mfaRequired: options?.mfaRequired ?? true,
      sessionTimeout: options?.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT_MINUTES,
      ipWhitelist: options?.ipWhitelist ?? [],
      encryptionEnabled: true,
      enhancedAuditEnabled: true,
      trainingRequired: true,
      auditRetentionYears: options?.auditRetentionYears ?? DEFAULT_AUDIT_RETENTION_YEARS,
      nextAssessmentDue,
    },
  });

  // Enforce MFA for all tenant users if required
  if (compliance.mfaRequired) {
    await enforceMfaForTenant(tenantId);
  }

  logger.info(
    { tenantId, complianceId: compliance.id, complianceLevel: compliance.complianceLevel },
    'HIPAA compliance enabled for tenant'
  );

  return compliance;
}

/**
 * Get HIPAA compliance status for a tenant
 */
export async function getComplianceStatus(tenantId: string): Promise<HipaaComplianceStatus | null> {
  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance) {
    return null;
  }

  return {
    id: compliance.id,
    hipaaEnabled: compliance.hipaaEnabled,
    complianceLevel: compliance.complianceLevel,
    baaStatus: compliance.baaStatus,
    baaSignedAt: compliance.baaSignedAt,
    baaExpiresAt: compliance.baaExpiresAt,
    mfaRequired: compliance.mfaRequired,
    sessionTimeout: compliance.sessionTimeout,
    encryptionEnabled: compliance.encryptionEnabled,
    encryptionKeyId: compliance.encryptionKeyId,
    assessmentScore: compliance.assessmentScore,
    lastAssessmentAt: compliance.lastAssessmentAt,
    nextAssessmentDue: compliance.nextAssessmentDue,
    trainingRequired: compliance.trainingRequired,
    enhancedAuditEnabled: compliance.enhancedAuditEnabled,
    auditRetentionYears: compliance.auditRetentionYears,
    ipWhitelist: compliance.ipWhitelist,
  };
}

/**
 * Update HIPAA compliance settings
 */
export async function updateComplianceSettings(
  tenantId: string,
  options: HipaaComplianceOptions
): Promise<HipaaCompliance> {
  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance) {
    throw new Error('HIPAA compliance not enabled for tenant');
  }

  const updated = await prisma.hipaaCompliance.update({
    where: { id: compliance.id },
    data: {
      mfaRequired: options.mfaRequired ?? compliance.mfaRequired,
      sessionTimeout: options.sessionTimeout ?? compliance.sessionTimeout,
      ipWhitelist: options.ipWhitelist ?? compliance.ipWhitelist,
      auditRetentionYears: options.auditRetentionYears ?? compliance.auditRetentionYears,
    },
  });

  // Enforce MFA if newly required
  if (options.mfaRequired && !compliance.mfaRequired) {
    await enforceMfaForTenant(tenantId);
  }

  return updated;
}

/**
 * Check if user can access PHI
 */
export async function checkPhiAccess(params: CheckPhiAccessParams): Promise<PhiAccessCheckResult> {
  const { userId, tenantId, accessType, phiCategory, purpose } = params;

  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance?.hipaaEnabled) {
    return {
      allowed: false,
      reason: 'HIPAA compliance not enabled for tenant',
      requiresAction: 'ENABLE_HIPAA',
    };
  }

  const checks: AccessCheck[] = [];

  // Check BAA status
  if (compliance.baaStatus !== BaaStatus.SIGNED) {
    checks.push({
      check: 'BAA_SIGNED',
      passed: false,
      message: 'Business Associate Agreement not signed',
    });
  }

  // Check training status
  const trainings = await prisma.hipaaTraining.findMany({
    where: { userId, tenantId },
  });

  const hasValidTraining = trainings.some(
    (t) =>
      t.status === TrainingStatus.COMPLETED &&
      t.passed &&
      (!t.expiresAt || t.expiresAt > new Date())
  );

  if (compliance.trainingRequired && !hasValidTraining) {
    checks.push({
      check: 'TRAINING_COMPLETED',
      passed: false,
      message: 'HIPAA training not completed or expired',
    });
  }

  // Check MFA status
  const mfaSettings = await prisma.userMfa.findUnique({
    where: { userId },
  });

  if (compliance.mfaRequired && !mfaSettings?.enabled) {
    checks.push({
      check: 'MFA_ENABLED',
      passed: false,
      message: 'Multi-factor authentication required',
    });
  }

  // Check user verification level
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationLevel: true },
  });

  if (user?.verificationLevel === 'NONE' || user?.verificationLevel === 'EMAIL') {
    checks.push({
      check: 'IDENTITY_VERIFIED',
      passed: false,
      message: 'Enhanced identity verification required for PHI access',
    });
  }

  const failedChecks = checks.filter((c) => !c.passed);
  const allowed = failedChecks.length === 0;

  if (!allowed) {
    const actionMap: Record<string, string> = {
      BAA_SIGNED: '/settings/compliance/baa',
      TRAINING_COMPLETED: '/settings/compliance/training',
      MFA_ENABLED: '/settings/security/mfa',
      IDENTITY_VERIFIED: '/settings/verification',
    };

    const firstFailedCheck = failedChecks[0];
    const requiresAction = firstFailedCheck?.check;
    const actionUrl = requiresAction ? actionMap[requiresAction] : undefined;

    const result: PhiAccessCheckResult = {
      allowed: false,
      reason: failedChecks.map((c) => c.message).join('; '),
      failedChecks,
    };
    if (requiresAction) result.requiresAction = requiresAction;
    if (actionUrl) result.actionUrl = actionUrl;

    return result;
  }

  // Generate access ID and log access
  const accessId = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Log PHI access
  await logPhiAccess({
    hipaaComplianceId: compliance.id,
    userId,
    accessType,
    phiCategory,
    purpose,
    resourceType: params.resourceType ?? 'phi_data',
    resourceId: params.resourceId,
  });

  return {
    allowed: true,
    accessId,
    expiresAt,
  };
}

/**
 * Log PHI access
 */
export async function logPhiAccess(params: LogPhiAccessParams): Promise<PhiAccessLog> {
  const log = await prisma.phiAccessLog.create({
    data: {
      hipaaComplianceId: params.hipaaComplianceId,
      userId: params.userId,
      accessType: params.accessType,
      phiCategory: params.phiCategory,
      recordCount: params.recordCount ?? 1,
      purpose: params.purpose,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      ipAddress: params.ipAddress ?? null,
      skillpodSessionId: params.skillpodSessionId ?? null,
    },
  });

  logger.info(
    {
      userId: params.userId,
      accessType: params.accessType,
      phiCategory: params.phiCategory,
      purpose: params.purpose,
    },
    'PHI access logged'
  );

  return log;
}

/**
 * Get PHI access logs
 */
export async function getPhiAccessLogs(params: {
  tenantId: string;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  userId?: string | undefined;
  phiCategory?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}): Promise<{
  logs: (PhiAccessLog & { user: { firstName: string; lastName: string } })[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { tenantId, startDate, endDate, userId, phiCategory, page = 1, limit = 20 } = params;

  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance) {
    return { logs: [], total: 0, page: 1, totalPages: 0 };
  }

  const where: Prisma.PhiAccessLogWhereInput = {
    hipaaComplianceId: compliance.id,
  };

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  if (userId) {
    where.userId = userId;
  }

  if (phiCategory) {
    where.phiCategory = phiCategory as PhiAccessLog['phiCategory'];
  }

  const [logs, total] = await Promise.all([
    prisma.phiAccessLog.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.phiAccessLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Request Business Associate Agreement
 */
export async function requestBaa(params: RequestBaaParams): Promise<void> {
  const { tenantId, requestedBy, contactInfo } = params;

  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance) {
    throw new Error('HIPAA compliance not enabled for tenant');
  }

  await prisma.hipaaCompliance.update({
    where: { id: compliance.id },
    data: { baaStatus: BaaStatus.REQUESTED },
  });

  logger.info(
    {
      tenantId,
      requestedBy,
      contactEmail: contactInfo.email,
    },
    'BAA request submitted'
  );

  // In production, this would:
  // 1. Create a support ticket
  // 2. Notify compliance team
  // 3. Send confirmation email to requester
}

/**
 * Complete BAA signing (admin operation)
 */
export async function completeBaaSigning(
  params: CompleteBaaSigningParams
): Promise<HipaaCompliance> {
  const { tenantId, documentUrl, signedAt, expiresAt, adminUserId } = params;

  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance) {
    throw new Error('HIPAA compliance not enabled for tenant');
  }

  const updated = await prisma.hipaaCompliance.update({
    where: { id: compliance.id },
    data: {
      baaStatus: BaaStatus.SIGNED,
      baaSignedAt: signedAt,
      baaExpiresAt: expiresAt,
      baaDocumentUrl: documentUrl,
      complianceLevel: HipaaComplianceLevel.STANDARD,
    },
  });

  logger.info(
    {
      tenantId,
      adminUserId,
      baaSignedAt: signedAt,
      baaExpiresAt: expiresAt,
    },
    'BAA signing completed'
  );

  return updated;
}

/**
 * Get training requirements for user
 */
export async function getTrainingRequirements(
  userId: string,
  tenantId: string
): Promise<TrainingRequirements> {
  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance?.hipaaEnabled || !compliance.trainingRequired) {
    return { required: false, trainings: [] };
  }

  const userTrainings = await prisma.hipaaTraining.findMany({
    where: { userId, tenantId },
  });

  const trainings: TrainingRequirement[] = REQUIRED_TRAINING_TYPES.map((type) => {
    const existing = userTrainings.find((t) => t.trainingType === type);
    const now = new Date();

    return {
      type,
      status: existing?.status ?? TrainingStatus.NOT_STARTED,
      completed: existing?.status === TrainingStatus.COMPLETED && existing.passed,
      expired: existing?.expiresAt ? existing.expiresAt < now : false,
      expiresAt: existing?.expiresAt ?? null,
      certificateUrl: existing?.certificateUrl ?? null,
    };
  });

  const allCompleted = trainings.every((t) => t.completed && !t.expired);
  const nextDue = trainings.find((t) => !t.completed || t.expired)?.type;

  const result: TrainingRequirements = {
    required: true,
    allCompleted,
    trainings,
  };
  if (nextDue) result.nextDue = nextDue;

  return result;
}

/**
 * Record training completion
 */
export async function recordTrainingCompletion(
  params: RecordTrainingCompletionParams
): Promise<HipaaTraining> {
  const { userId, tenantId, trainingType, trainingVersion, quizScore } = params;

  const passed = quizScore >= PASSING_SCORE;

  // Calculate expiration (1 year if passed)
  let expiresAt: Date | null = null;
  if (passed) {
    expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + TRAINING_VALIDITY_YEARS);
  }

  const training = await prisma.hipaaTraining.upsert({
    where: {
      userId_tenantId_trainingType: {
        userId,
        tenantId,
        trainingType,
      },
    },
    update: {
      trainingVersion,
      status: TrainingStatus.COMPLETED,
      completedAt: new Date(),
      quizScore,
      passingScore: PASSING_SCORE,
      passed,
      expiresAt,
    },
    create: {
      userId,
      tenantId,
      trainingType,
      trainingVersion,
      status: TrainingStatus.COMPLETED,
      startedAt: new Date(),
      completedAt: new Date(),
      quizScore,
      passingScore: PASSING_SCORE,
      passed,
      expiresAt,
    },
  });

  logger.info(
    {
      userId,
      tenantId,
      trainingType,
      quizScore,
      passed,
    },
    'Training completion recorded'
  );

  // Generate certificate URL if passed
  if (passed) {
    const certificateUrl = generateTrainingCertificate(training);
    await prisma.hipaaTraining.update({
      where: { id: training.id },
      data: { certificateUrl },
    });
  }

  return training;
}

/**
 * Start training session
 */
export async function startTraining(
  userId: string,
  tenantId: string,
  trainingType: HipaaTrainingType,
  trainingVersion: string
): Promise<HipaaTraining> {
  const training = await prisma.hipaaTraining.upsert({
    where: {
      userId_tenantId_trainingType: {
        userId,
        tenantId,
        trainingType,
      },
    },
    update: {
      trainingVersion,
      status: TrainingStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
    create: {
      userId,
      tenantId,
      trainingType,
      trainingVersion,
      status: TrainingStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
  });

  return training;
}

/**
 * Generate compliance assessment
 */
export async function generateComplianceAssessment(
  tenantId: string
): Promise<ComplianceAssessment> {
  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
  });

  if (!compliance) {
    throw new Error('HIPAA compliance not enabled for tenant');
  }

  const allUsers = await prisma.tenantMember.findMany({
    where: { tenantId },
    include: { user: true },
  });

  const assessmentItems: AssessmentItem[] = [];
  let totalScore = 0;
  let maxScore = 0;

  // 1. BAA Status (20 points)
  maxScore += 20;
  if (compliance.baaStatus === BaaStatus.SIGNED) {
    totalScore += 20;
    assessmentItems.push({
      category: 'Administrative Safeguards',
      item: 'Business Associate Agreement',
      status: 'COMPLIANT',
      score: 20,
      maxScore: 20,
    });
  } else {
    assessmentItems.push({
      category: 'Administrative Safeguards',
      item: 'Business Associate Agreement',
      status: 'NON_COMPLIANT',
      score: 0,
      maxScore: 20,
      remediation: 'Sign Business Associate Agreement',
    });
  }

  // 2. Training Compliance (20 points)
  maxScore += 20;
  const trainedUsersCount = await countTrainedUsers(tenantId);
  const trainingRate = allUsers.length > 0 ? trainedUsersCount / allUsers.length : 0;
  const trainingScore = Math.round(trainingRate * 20);
  totalScore += trainingScore;

  const trainingStatus: AssessmentItemStatus = getComplianceStatusFromRate(trainingRate, 0.95, 0.8);

  const trainingItem: AssessmentItem = {
    category: 'Administrative Safeguards',
    item: 'Workforce Training',
    status: trainingStatus,
    score: trainingScore,
    maxScore: 20,
    details: `${trainedUsersCount} of ${allUsers.length} users have completed training (${Math.round(trainingRate * 100)}%)`,
  };
  if (trainingRate < 0.95) {
    trainingItem.remediation = 'Ensure all users complete HIPAA training';
  }
  assessmentItems.push(trainingItem);

  // 3. Access Controls (15 points)
  maxScore += 15;
  let accessControlScore = 0;
  const accessControlDetails: string[] = [];

  if (compliance.mfaRequired) {
    const mfaEnabledCount = await countMfaEnabledUsers(tenantId);
    const mfaRate = allUsers.length > 0 ? mfaEnabledCount / allUsers.length : 0;
    if (mfaRate >= 0.95) {
      accessControlScore += 5;
      accessControlDetails.push('MFA enforced for all users');
    } else {
      accessControlDetails.push(`MFA enabled for ${Math.round(mfaRate * 100)}% of users`);
    }
  }

  if (compliance.sessionTimeout <= 15) {
    accessControlScore += 5;
    accessControlDetails.push(`Session timeout: ${compliance.sessionTimeout} minutes`);
  }

  if (compliance.ipWhitelist.length > 0) {
    accessControlScore += 5;
    accessControlDetails.push(
      `IP whitelist configured with ${compliance.ipWhitelist.length} addresses`
    );
  }

  totalScore += accessControlScore;

  const accessControlStatus: AssessmentItemStatus = getComplianceStatusFromRate(
    accessControlScore / 15,
    0.8,
    0.533
  );

  assessmentItems.push({
    category: 'Technical Safeguards',
    item: 'Access Controls',
    status: accessControlStatus,
    score: accessControlScore,
    maxScore: 15,
    details: accessControlDetails.join('; '),
  });

  // 4. Encryption (15 points)
  maxScore += 15;
  let encryptionScore = 0;

  if (compliance.encryptionEnabled) {
    encryptionScore += 10;
  }
  if (compliance.encryptionKeyId) {
    encryptionScore += 5;
  }

  totalScore += encryptionScore;

  const encryptionStatus: AssessmentItemStatus = encryptionScore === 15 ? 'COMPLIANT' : 'PARTIAL';

  assessmentItems.push({
    category: 'Technical Safeguards',
    item: 'Encryption',
    status: encryptionStatus,
    score: encryptionScore,
    maxScore: 15,
    details: compliance.encryptionEnabled
      ? 'Data encryption enabled with tenant-specific key'
      : 'Encryption not configured',
  });

  // 5. Audit Controls (15 points)
  maxScore += 15;
  let auditScore = 0;

  if (compliance.enhancedAuditEnabled) {
    auditScore += 10;
  }
  if (compliance.auditRetentionYears >= 6) {
    auditScore += 5;
  }

  totalScore += auditScore;

  const auditStatus: AssessmentItemStatus = auditScore === 15 ? 'COMPLIANT' : 'PARTIAL';

  assessmentItems.push({
    category: 'Technical Safeguards',
    item: 'Audit Controls',
    status: auditStatus,
    score: auditScore,
    maxScore: 15,
    details: `Enhanced auditing ${compliance.enhancedAuditEnabled ? 'enabled' : 'disabled'}, retention: ${compliance.auditRetentionYears} years`,
  });

  // 6. Identity Verification (15 points)
  maxScore += 15;
  const verifiedUsersCount = await countVerifiedUsers(tenantId);
  const verificationRate = allUsers.length > 0 ? verifiedUsersCount / allUsers.length : 0;
  const verificationScore = Math.round(verificationRate * 15);

  totalScore += verificationScore;

  const verificationStatus: AssessmentItemStatus = getComplianceStatusFromRate(
    verificationRate,
    0.95,
    0.7
  );

  assessmentItems.push({
    category: 'Physical Safeguards',
    item: 'Identity Verification',
    status: verificationStatus,
    score: verificationScore,
    maxScore: 15,
    details: `${verifiedUsersCount} of ${allUsers.length} users have enhanced identity verification`,
  });

  // Calculate overall score
  const overallScore = Math.round((totalScore / maxScore) * 100);
  const overallStatus: AssessmentItemStatus = getComplianceStatusFromRate(
    overallScore / 100,
    0.9,
    0.7
  );

  // Update compliance record
  const nextAssessmentDue = calculateNextAssessmentDate();
  await prisma.hipaaCompliance.update({
    where: { id: compliance.id },
    data: {
      lastAssessmentAt: new Date(),
      assessmentScore: overallScore,
      nextAssessmentDue,
    },
  });

  return {
    assessmentId: crypto.randomUUID(),
    tenantId,
    generatedAt: new Date(),
    overallScore,
    overallStatus,
    totalScore,
    maxScore,
    items: assessmentItems,
    recommendations: generateRecommendations(assessmentItems),
    nextAssessmentDue,
  };
}

/**
 * Set encryption key for tenant
 */
export async function setEncryptionKey(tenantId: string, keyId: string): Promise<void> {
  await prisma.hipaaCompliance.update({
    where: { tenantId },
    data: { encryptionKeyId: keyId },
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function validateHipaaPrerequisites(tenantId: string): Promise<void> {
  // Check tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Check tenant plan allows HIPAA (Enterprise only in production)
  // For now, allow all plans for development
}

async function enforceMfaForTenant(tenantId: string): Promise<void> {
  // Get all tenant members
  const members = await prisma.tenantMember.findMany({
    where: { tenantId },
    include: { user: true },
  });

  // In production, this would:
  // 1. Send notifications to users without MFA
  // 2. Set a deadline for MFA enablement
  // 3. Potentially restrict access until MFA is enabled
  logger.info({ tenantId, memberCount: members.length }, 'MFA enforcement initiated for tenant');
}

function calculateNextAssessmentDate(): Date {
  const next = new Date();
  next.setMonth(next.getMonth() + ASSESSMENT_INTERVAL_MONTHS);
  return next;
}

async function countTrainedUsers(tenantId: string): Promise<number> {
  const trainedUsers = await prisma.hipaaTraining.groupBy({
    by: ['userId'],
    where: {
      tenantId,
      status: TrainingStatus.COMPLETED,
      passed: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  return trainedUsers.length;
}

async function countMfaEnabledUsers(tenantId: string): Promise<number> {
  const members = await prisma.tenantMember.findMany({
    where: { tenantId },
    select: { userId: true },
  });

  const userIds = members.map((m) => m.userId);

  const mfaEnabled = await prisma.userMfa.count({
    where: {
      userId: { in: userIds },
      enabled: true,
    },
  });

  return mfaEnabled;
}

async function countVerifiedUsers(tenantId: string): Promise<number> {
  const members = await prisma.tenantMember.findMany({
    where: { tenantId },
    include: { user: true },
  });

  return members.filter(
    (m) => m.user.verificationLevel === 'ENHANCED' || m.user.verificationLevel === 'PREMIUM'
  ).length;
}

function generateTrainingCertificate(_training: HipaaTraining): string {
  // In production, this would generate a PDF certificate
  // For now, return a placeholder URL
  const certificateId = crypto.randomUUID();
  return `/api/hipaa/certificates/${certificateId}`;
}

function generateRecommendations(items: AssessmentItem[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const item of items) {
    if (item.status !== 'COMPLIANT' && item.remediation) {
      const priority: RecommendationPriority = item.score === 0 ? 'HIGH' : 'MEDIUM';

      recommendations.push({
        priority,
        category: item.category,
        item: item.item,
        action: item.remediation,
        impact: `Could improve score by up to ${item.maxScore - item.score} points`,
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<RecommendationPriority, number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
  };

  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
