/**
 * Access Control Verification
 * SOC 2 compliant access management and review
 */

import { randomBytes } from 'crypto';

export interface AccessRight {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  resourceType: ResourceType;
  resourceId?: string;
  resourceName?: string;
  permission: Permission;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
  justification?: string;
  lastReviewed?: Date;
  lastReviewedBy?: string;
  status: AccessStatus;
}

export interface AccessReview {
  id: string;
  name: string;
  description: string;
  type: ReviewType;
  scope: ReviewScope;
  status: ReviewStatus;
  createdAt: Date;
  createdBy: string;
  dueDate: Date;
  completedAt?: Date;
  completedBy?: string;
  reviewers: string[];
  accessRights: AccessReviewItem[];
  summary?: ReviewSummary;
}

export interface AccessReviewItem {
  accessRightId: string;
  accessRight: AccessRight;
  decision?: ReviewDecision;
  decidedAt?: Date;
  decidedBy?: string;
  notes?: string;
}

export interface ReviewSummary {
  total: number;
  approved: number;
  revoked: number;
  modified: number;
  pending: number;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inherits?: string[]; // Parent roles
  createdAt: Date;
  updatedAt: Date;
  isSystem: boolean;
}

export interface SeparationOfDuties {
  id: string;
  name: string;
  description: string;
  conflictingRoles: [string, string];
  severity: 'high' | 'medium' | 'low';
  exceptions: SoDException[];
}

export interface SoDException {
  userId: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt: Date;
  justification: string;
}

export enum ResourceType {
  SYSTEM = 'system',
  SERVICE = 'service',
  DATABASE = 'database',
  API = 'api',
  FILE = 'file',
  PROJECT = 'project',
  SKILLPOD = 'skillpod',
  BILLING = 'billing',
  ADMIN = 'admin',
}

export enum Permission {
  // General
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',

  // Specific
  VIEW_PII = 'view_pii',
  EXPORT_DATA = 'export_data',
  MANAGE_USERS = 'manage_users',
  MANAGE_ROLES = 'manage_roles',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_BILLING = 'manage_billing',
  ACCESS_PRODUCTION = 'access_production',
  DEPLOY = 'deploy',
  VIEW_SECRETS = 'view_secrets',
  MANAGE_SECRETS = 'manage_secrets',
}

export enum AccessStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  PENDING_REVIEW = 'pending_review',
}

export enum ReviewType {
  PERIODIC = 'periodic', // Quarterly/Annual
  CERTIFICATION = 'certification', // Full access certification
  TARGETED = 'targeted', // Specific resource/role
  PRIVILEGE = 'privilege', // Elevated access review
}

export enum ReviewScope {
  ALL_USERS = 'all_users',
  ROLE_BASED = 'role_based',
  RESOURCE_BASED = 'resource_based',
  PRIVILEGED_ONLY = 'privileged_only',
}

export enum ReviewStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ReviewDecision {
  APPROVE = 'approve',
  REVOKE = 'revoke',
  MODIFY = 'modify',
}

// In-memory stores
const accessRights: Map<string, AccessRight> = new Map();
const accessReviews: Map<string, AccessReview> = new Map();
const roleDefinitions: Map<string, RoleDefinition> = new Map();
const sodPolicies: Map<string, SeparationOfDuties> = new Map();

export class AccessControlManager {
  constructor() {
    this.initializeRoles();
    this.initializeSoDPolicies();
  }

  /**
   * Grant access to a user
   */
  async grantAccess(
    userId: string,
    userName: string,
    userEmail: string,
    resourceType: ResourceType,
    permission: Permission,
    grantedBy: string,
    options?: {
      resourceId?: string;
      resourceName?: string;
      expiresAt?: Date;
      justification?: string;
    }
  ): Promise<AccessRight> {
    // Check SoD conflicts
    const conflicts = await this.checkSoDConflicts(userId, permission);
    if (conflicts.length > 0) {
      throw new Error(`Separation of Duties conflict: ${conflicts.map((c) => c.name).join(', ')}`);
    }

    const id = `ar_${randomBytes(8).toString('hex')}`;

    const accessRight: AccessRight = {
      id,
      userId,
      userName,
      userEmail,
      resourceType,
      resourceId: options?.resourceId,
      resourceName: options?.resourceName,
      permission,
      grantedAt: new Date(),
      grantedBy,
      expiresAt: options?.expiresAt,
      justification: options?.justification,
      status: AccessStatus.ACTIVE,
    };

    accessRights.set(id, accessRight);
    return accessRight;
  }

  /**
   * Revoke access
   */
  async revokeAccess(accessRightId: string, revokedBy: string, reason?: string): Promise<boolean> {
    const accessRight = accessRights.get(accessRightId);
    if (!accessRight) return false;

    accessRight.status = AccessStatus.REVOKED;
    accessRights.set(accessRightId, accessRight);

    console.log(
      `[ACCESS] Revoked ${accessRightId} for ${accessRight.userName} by ${revokedBy}: ${reason || 'No reason provided'}`
    );

    return true;
  }

  /**
   * Get user's access rights
   */
  async getUserAccessRights(userId: string): Promise<AccessRight[]> {
    return Array.from(accessRights.values()).filter(
      (ar) => ar.userId === userId && ar.status === AccessStatus.ACTIVE
    );
  }

  /**
   * Get all access rights for a resource
   */
  async getResourceAccessRights(
    resourceType: ResourceType,
    resourceId?: string
  ): Promise<AccessRight[]> {
    return Array.from(accessRights.values()).filter(
      (ar) =>
        ar.resourceType === resourceType &&
        ar.status === AccessStatus.ACTIVE &&
        (!resourceId || ar.resourceId === resourceId)
    );
  }

  /**
   * Create an access review
   */
  async createAccessReview(
    name: string,
    description: string,
    type: ReviewType,
    scope: ReviewScope,
    dueDate: Date,
    createdBy: string,
    reviewers: string[]
  ): Promise<AccessReview> {
    const id = `rev_${randomBytes(8).toString('hex')}`;

    // Get access rights to review based on scope
    let rightsToReview: AccessRight[];
    switch (scope) {
      case ReviewScope.PRIVILEGED_ONLY:
        rightsToReview = Array.from(accessRights.values()).filter(
          (ar) =>
            ar.status === AccessStatus.ACTIVE &&
            [
              Permission.ADMIN,
              Permission.MANAGE_USERS,
              Permission.MANAGE_ROLES,
              Permission.ACCESS_PRODUCTION,
              Permission.MANAGE_SECRETS,
            ].includes(ar.permission)
        );
        break;
      case ReviewScope.ALL_USERS:
      default:
        rightsToReview = Array.from(accessRights.values()).filter(
          (ar) => ar.status === AccessStatus.ACTIVE
        );
    }

    const review: AccessReview = {
      id,
      name,
      description,
      type,
      scope,
      status: ReviewStatus.DRAFT,
      createdAt: new Date(),
      createdBy,
      dueDate,
      reviewers,
      accessRights: rightsToReview.map((ar) => ({
        accessRightId: ar.id,
        accessRight: ar,
      })),
    };

    accessReviews.set(id, review);
    return review;
  }

  /**
   * Start an access review
   */
  async startAccessReview(reviewId: string): Promise<AccessReview | null> {
    const review = accessReviews.get(reviewId);
    if (!review) return null;

    review.status = ReviewStatus.IN_PROGRESS;

    // Mark access rights as pending review
    for (const item of review.accessRights) {
      const ar = accessRights.get(item.accessRightId);
      if (ar) {
        ar.status = AccessStatus.PENDING_REVIEW;
        accessRights.set(ar.id, ar);
      }
    }

    accessReviews.set(reviewId, review);
    return review;
  }

  /**
   * Make a decision on an access right in a review
   */
  async makeReviewDecision(
    reviewId: string,
    accessRightId: string,
    decision: ReviewDecision,
    decidedBy: string,
    notes?: string
  ): Promise<boolean> {
    const review = accessReviews.get(reviewId);
    if (!review) return false;

    const item = review.accessRights.find((i) => i.accessRightId === accessRightId);
    if (!item) return false;

    item.decision = decision;
    item.decidedAt = new Date();
    item.decidedBy = decidedBy;
    item.notes = notes;

    // Apply the decision
    const accessRight = accessRights.get(accessRightId);
    if (accessRight) {
      switch (decision) {
        case ReviewDecision.APPROVE:
          accessRight.status = AccessStatus.ACTIVE;
          accessRight.lastReviewed = new Date();
          accessRight.lastReviewedBy = decidedBy;
          break;
        case ReviewDecision.REVOKE:
          accessRight.status = AccessStatus.REVOKED;
          break;
        case ReviewDecision.MODIFY:
          // Would trigger a modification workflow
          accessRight.status = AccessStatus.ACTIVE;
          break;
      }
      accessRights.set(accessRightId, accessRight);
    }

    accessReviews.set(reviewId, review);

    // Check if review is complete
    const allDecided = review.accessRights.every((i) => i.decision !== undefined);
    if (allDecided) {
      await this.completeAccessReview(reviewId, decidedBy);
    }

    return true;
  }

  /**
   * Complete an access review
   */
  async completeAccessReview(reviewId: string, completedBy: string): Promise<AccessReview | null> {
    const review = accessReviews.get(reviewId);
    if (!review) return null;

    review.status = ReviewStatus.COMPLETED;
    review.completedAt = new Date();
    review.completedBy = completedBy;

    // Calculate summary
    review.summary = {
      total: review.accessRights.length,
      approved: review.accessRights.filter((i) => i.decision === ReviewDecision.APPROVE).length,
      revoked: review.accessRights.filter((i) => i.decision === ReviewDecision.REVOKE).length,
      modified: review.accessRights.filter((i) => i.decision === ReviewDecision.MODIFY).length,
      pending: review.accessRights.filter((i) => !i.decision).length,
    };

    accessReviews.set(reviewId, review);
    return review;
  }

  /**
   * Get access review by ID
   */
  async getAccessReview(id: string): Promise<AccessReview | null> {
    return accessReviews.get(id) || null;
  }

  /**
   * Get all access reviews
   */
  async getAccessReviews(status?: ReviewStatus): Promise<AccessReview[]> {
    let reviews = Array.from(accessReviews.values());
    if (status) {
      reviews = reviews.filter((r) => r.status === status);
    }
    return reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Check for Separation of Duties conflicts
   */
  async checkSoDConflicts(
    userId: string,
    newPermission: Permission
  ): Promise<SeparationOfDuties[]> {
    const userRights = await this.getUserAccessRights(userId);
    const userPermissions = new Set(userRights.map((r) => r.permission));
    userPermissions.add(newPermission);

    const conflicts: SeparationOfDuties[] = [];

    for (const policy of sodPolicies.values()) {
      const [role1, role2] = policy.conflictingRoles;
      if (userPermissions.has(role1 as Permission) && userPermissions.has(role2 as Permission)) {
        // Check if user has an exception
        const hasException = policy.exceptions.some(
          (e) => e.userId === userId && new Date() < e.expiresAt
        );
        if (!hasException) {
          conflicts.push(policy);
        }
      }
    }

    return conflicts;
  }

  /**
   * Get access metrics
   */
  async getAccessMetrics(): Promise<{
    totalActiveRights: number;
    byResourceType: Record<string, number>;
    byPermission: Record<string, number>;
    expiringWithin30Days: number;
    neverReviewed: number;
    privilegedAccess: number;
    sodViolations: number;
    pendingReviews: number;
  }> {
    const active = Array.from(accessRights.values()).filter(
      (ar) => ar.status === AccessStatus.ACTIVE
    );
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const byResourceType: Record<string, number> = {};
    const byPermission: Record<string, number> = {};
    let expiringWithin30Days = 0;
    let neverReviewed = 0;
    let privilegedAccess = 0;

    const privilegedPermissions = new Set([
      Permission.ADMIN,
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
      Permission.ACCESS_PRODUCTION,
      Permission.MANAGE_SECRETS,
    ]);

    for (const ar of active) {
      byResourceType[ar.resourceType] = (byResourceType[ar.resourceType] || 0) + 1;
      byPermission[ar.permission] = (byPermission[ar.permission] || 0) + 1;

      if (ar.expiresAt && ar.expiresAt <= thirtyDaysFromNow) expiringWithin30Days++;
      if (!ar.lastReviewed) neverReviewed++;
      if (privilegedPermissions.has(ar.permission)) privilegedAccess++;
    }

    // Count pending reviews
    const pendingReviews = Array.from(accessReviews.values()).filter(
      (r) => r.status === ReviewStatus.IN_PROGRESS
    ).length;

    // Check for SoD violations (simplified)
    const userPermissions: Map<string, Set<Permission>> = new Map();
    for (const ar of active) {
      if (!userPermissions.has(ar.userId)) {
        userPermissions.set(ar.userId, new Set());
      }
      userPermissions.get(ar.userId)!.add(ar.permission);
    }

    let sodViolations = 0;
    for (const policy of sodPolicies.values()) {
      for (const [userId, perms] of userPermissions.entries()) {
        const [role1, role2] = policy.conflictingRoles;
        if (perms.has(role1 as Permission) && perms.has(role2 as Permission)) {
          const hasException = policy.exceptions.some(
            (e) => e.userId === userId && new Date() < e.expiresAt
          );
          if (!hasException) sodViolations++;
        }
      }
    }

    return {
      totalActiveRights: active.length,
      byResourceType,
      byPermission,
      expiringWithin30Days,
      neverReviewed,
      privilegedAccess,
      sodViolations,
      pendingReviews,
    };
  }

  /**
   * Get orphaned accounts (access with no recent activity)
   */
  async getOrphanedAccounts(inactiveDays: number = 90): Promise<AccessRight[]> {
    // In production, this would check against activity logs
    // For now, return access rights without recent review
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    return Array.from(accessRights.values()).filter(
      (ar) => ar.status === AccessStatus.ACTIVE && (!ar.lastReviewed || ar.lastReviewed < cutoff)
    );
  }

  /**
   * Generate access report for compliance
   */
  async generateAccessReport(): Promise<{
    generatedAt: Date;
    summary: {
      totalUsers: number;
      totalAccessRights: number;
      privilegedUsers: number;
      pendingReviews: number;
      sodViolations: number;
    };
    byResourceType: { type: string; count: number; users: number }[];
    privilegedAccess: { user: string; permissions: string[] }[];
    recentChanges: { action: string; user: string; date: Date }[];
    reviewStatus: { total: number; completed: number; overdue: number };
  }> {
    const active = Array.from(accessRights.values()).filter(
      (ar) => ar.status === AccessStatus.ACTIVE
    );
    const metrics = await this.getAccessMetrics();

    // Calculate unique users
    const uniqueUsers = new Set(active.map((ar) => ar.userId));

    // Group by resource type
    const resourceGroups: Map<string, { count: number; users: Set<string> }> = new Map();
    for (const ar of active) {
      if (!resourceGroups.has(ar.resourceType)) {
        resourceGroups.set(ar.resourceType, { count: 0, users: new Set() });
      }
      const group = resourceGroups.get(ar.resourceType)!;
      group.count++;
      group.users.add(ar.userId);
    }

    // Privileged access by user
    const privilegedPermissions = new Set([
      Permission.ADMIN,
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
      Permission.ACCESS_PRODUCTION,
      Permission.MANAGE_SECRETS,
    ]);

    const privilegedByUser: Map<string, { name: string; permissions: Set<string> }> = new Map();
    for (const ar of active) {
      if (privilegedPermissions.has(ar.permission)) {
        if (!privilegedByUser.has(ar.userId)) {
          privilegedByUser.set(ar.userId, { name: ar.userName, permissions: new Set() });
        }
        privilegedByUser.get(ar.userId)!.permissions.add(ar.permission);
      }
    }

    // Review status
    const reviews = Array.from(accessReviews.values());
    const now = new Date();
    const overdue = reviews.filter(
      (r) => r.status === ReviewStatus.IN_PROGRESS && r.dueDate < now
    ).length;

    return {
      generatedAt: new Date(),
      summary: {
        totalUsers: uniqueUsers.size,
        totalAccessRights: active.length,
        privilegedUsers: privilegedByUser.size,
        pendingReviews: metrics.pendingReviews,
        sodViolations: metrics.sodViolations,
      },
      byResourceType: Array.from(resourceGroups.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        users: data.users.size,
      })),
      privilegedAccess: Array.from(privilegedByUser.entries()).map(([, data]) => ({
        user: data.name,
        permissions: Array.from(data.permissions),
      })),
      recentChanges: [], // Would be populated from audit logs
      reviewStatus: {
        total: reviews.length,
        completed: reviews.filter((r) => r.status === ReviewStatus.COMPLETED).length,
        overdue,
      },
    };
  }

  // Private helpers

  private initializeRoles(): void {
    const roles: RoleDefinition[] = [
      {
        id: 'role_admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: [
          Permission.ADMIN,
          Permission.MANAGE_USERS,
          Permission.MANAGE_ROLES,
          Permission.VIEW_AUDIT_LOGS,
        ],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'role_developer',
        name: 'Developer',
        description: 'Development access',
        permissions: [Permission.READ, Permission.WRITE, Permission.DEPLOY],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'role_viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [Permission.READ],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const role of roles) {
      roleDefinitions.set(role.id, role);
    }
  }

  private initializeSoDPolicies(): void {
    const policies: SeparationOfDuties[] = [
      {
        id: 'sod_deploy_approve',
        name: 'Deployment Segregation',
        description: 'Users who can deploy should not approve their own deployments',
        conflictingRoles: [Permission.DEPLOY, Permission.ADMIN],
        severity: 'high',
        exceptions: [],
      },
      {
        id: 'sod_billing_admin',
        name: 'Billing Segregation',
        description: 'Billing management should be separate from admin access',
        conflictingRoles: [Permission.MANAGE_BILLING, Permission.ADMIN],
        severity: 'medium',
        exceptions: [],
      },
      {
        id: 'sod_secrets_deploy',
        name: 'Secrets Segregation',
        description: 'Secrets management should be separate from deployment',
        conflictingRoles: [Permission.MANAGE_SECRETS, Permission.DEPLOY],
        severity: 'high',
        exceptions: [],
      },
    ];

    for (const policy of policies) {
      sodPolicies.set(policy.id, policy);
    }
  }
}

export const accessControlManager = new AccessControlManager();
