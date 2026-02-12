// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/admin/tenant-admin-portal
 * Tenant Admin Portal Backend
 *
 * Features:
 * - Tenant admin role management
 * - User management APIs
 * - Policy management
 * - Session monitoring
 * - Reports and analytics
 * - Admin activity logging
 */

import { randomBytes } from 'crypto';

import { createAuditLog } from '@skillancer/audit-client';
import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { sendEmail } from '@skillancer/notification-svc';

// =============================================================================
// TYPES
// =============================================================================

export type TenantAdminRole = 'SUPER_ADMIN' | 'SECURITY_ADMIN' | 'USER_ADMIN' | 'VIEWER';
export type TenantUserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface TenantAdmin {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: TenantAdminRole;
  status: TenantUserStatus;
  lastActiveAt?: Date;
  createdAt: Date;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: TenantAdminRole | 'USER';
  status: TenantUserStatus;
  lastActiveAt?: Date;
  totalSessions: number;
  createdAt: Date;
}

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: TenantAdminRole | 'USER';
}

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export interface SessionInfo {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: string;
  startedAt: Date;
  duration: number;
  policyName: string;
  ipAddress: string;
  violations: number;
}

export interface AdminDashboardStats {
  activeUsers: number;
  activeSessions: number;
  storageUsedGB: number;
  storageQuotaGB: number;
  securityEvents24h: number;
  criticalAlerts: number;
}

// =============================================================================
// ROLE PERMISSIONS
// =============================================================================

const ROLE_PERMISSIONS: Record<TenantAdminRole, string[]> = {
  SUPER_ADMIN: [
    'tenant:read',
    'tenant:update',
    'tenant:billing',
    'users:read',
    'users:invite',
    'users:update',
    'users:remove',
    'policies:read',
    'policies:create',
    'policies:update',
    'policies:delete',
    'sessions:read',
    'sessions:terminate',
    'reports:read',
    'reports:export',
    'audit:read',
    'sso:configure',
    'api:manage',
  ],
  SECURITY_ADMIN: [
    'tenant:read',
    'users:read',
    'policies:read',
    'policies:create',
    'policies:update',
    'policies:delete',
    'sessions:read',
    'sessions:terminate',
    'reports:read',
    'reports:export',
    'audit:read',
  ],
  USER_ADMIN: [
    'tenant:read',
    'users:read',
    'users:invite',
    'users:update',
    'users:remove',
    'sessions:read',
    'reports:read',
  ],
  VIEWER: ['tenant:read', 'users:read', 'policies:read', 'sessions:read', 'reports:read'],
};

// =============================================================================
// TENANT ADMIN PORTAL SERVICE
// =============================================================================

export class TenantAdminPortalService {
  // ===========================================================================
  // PERMISSION CHECKING
  // ===========================================================================

  /**
   * Check if admin has permission
   */
  hasPermission(role: TenantAdminRole, permission: string): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) || false;
  }

  /**
   * Get all permissions for role
   */
  getRolePermissions(role: TenantAdminRole): string[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  // ===========================================================================
  // DASHBOARD
  // ===========================================================================

  /**
   * Get admin dashboard stats
   */
  async getDashboardStats(tenantId: string): Promise<AdminDashboardStats> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activeUsers, activeSessions, storage, securityEvents, criticalAlerts, tenant] =
      await Promise.all([
        prisma.skillpodTenantUser.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        prisma.skillpodSession.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        prisma.skillpodStorage.aggregate({
          where: { tenantId },
          _sum: { sizeBytes: true },
        }),
        prisma.skillpodSecurityEvent.count({
          where: { tenantId, createdAt: { gte: yesterday } },
        }),
        prisma.skillpodSecurityEvent.count({
          where: {
            tenantId,
            severity: 'CRITICAL',
            acknowledged: false,
          },
        }),
        prisma.skillpodTenant.findUnique({
          where: { id: tenantId },
          select: { limits: true },
        }),
      ]);

    const limits = tenant?.limits as Record<string, number> | undefined;
    const storageQuotaGB = limits?.storageQuotaGB || 0;
    const storageUsedGB =
      Math.round(((storage._sum.sizeBytes || 0) / (1024 * 1024 * 1024)) * 100) / 100;

    return {
      activeUsers,
      activeSessions,
      storageUsedGB,
      storageQuotaGB,
      securityEvents24h: securityEvents,
      criticalAlerts,
    };
  }

  // ===========================================================================
  // USER MANAGEMENT
  // ===========================================================================

  /**
   * List tenant users
   */
  async listUsers(
    tenantId: string,
    options: {
      status?: TenantUserStatus;
      role?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ users: TenantUser[]; total: number }> {
    const { status, role, search, limit = 20, offset = 0 } = options;

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.skillpodTenantUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.skillpodTenantUser.count({ where }),
    ]);

    // Get session counts
    const userIds = users.map((u) => u.id);
    const sessionCounts = await prisma.skillpodSession.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: true,
    });

    const sessionCountMap = new Map(sessionCounts.map((s) => [s.userId, s._count]));

    return {
      users: users.map((u) => ({
        id: u.id,
        tenantId: u.tenantId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role as TenantAdminRole | 'USER',
        status: u.status as TenantUserStatus,
        lastActiveAt: u.lastActiveAt || undefined,
        totalSessions: sessionCountMap.get(u.id) || 0,
        createdAt: u.createdAt,
      })),
      total,
    };
  }

  /**
   * Get user details
   */
  async getUser(tenantId: string, userId: string): Promise<TenantUser | null> {
    const user = await prisma.skillpodTenantUser.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) return null;

    const sessionCount = await prisma.skillpodSession.count({
      where: { userId },
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as TenantAdminRole | 'USER',
      status: user.status as TenantUserStatus,
      lastActiveAt: user.lastActiveAt || undefined,
      totalSessions: sessionCount,
      createdAt: user.createdAt,
    };
  }

  /**
   * Invite a user
   */
  async inviteUser(
    tenantId: string,
    adminId: string,
    request: InviteUserRequest
  ): Promise<TenantUser> {
    // Check if user already exists
    const existing = await prisma.skillpodTenantUser.findFirst({
      where: { tenantId, email: request.email },
    });

    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Check user limits
    const tenant = await prisma.skillpodTenant.findUnique({
      where: { id: tenantId },
      select: { limits: true },
    });

    const limits = tenant?.limits as Record<string, number> | undefined;
    const maxUsers = limits?.maxUsers || 0;

    if (maxUsers !== -1) {
      const currentCount = await prisma.skillpodTenantUser.count({
        where: { tenantId, status: { in: ['ACTIVE', 'INVITED'] } },
      });

      if (currentCount >= maxUsers) {
        throw new Error(`User limit reached (${maxUsers}). Upgrade to add more users.`);
      }
    }

    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await prisma.skillpodTenantUser.create({
      data: {
        tenantId,
        email: request.email,
        firstName: request.firstName,
        lastName: request.lastName,
        role: request.role,
        status: 'INVITED',
        invitedAt: new Date(),
        invitedBy: adminId,
        inviteToken,
        inviteExpiresAt,
      },
    });

    // Send invitation email
    await sendEmail({
      to: request.email,
      template: 'skillpod-user-invite',
      data: {
        firstName: request.firstName,
        inviteLink: `${process.env.SKILLPOD_URL}/invite/${inviteToken}`,
        expiresAt: inviteExpiresAt,
      },
    });

    await createAuditLog({
      action: 'USER_INVITED',
      resourceType: 'skillpod_tenant_user',
      resourceId: user.id,
      userId: adminId,
      metadata: { email: request.email, role: request.role },
    });

    logger.info({ tenantId, email: request.email }, 'User invited');

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as TenantAdminRole | 'USER',
      status: 'INVITED',
      totalSessions: 0,
      createdAt: user.createdAt,
    };
  }

  /**
   * Bulk import users from CSV
   */
  async bulkImportUsers(
    tenantId: string,
    adminId: string,
    users: Array<{ email: string; firstName: string; lastName: string; role?: string }>
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = { success: 0, failed: 0, errors: [] };

    for (const userData of users) {
      try {
        await this.inviteUser(tenantId, adminId, {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: (userData.role as TenantAdminRole) || 'USER',
        });
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          email: userData.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await createAuditLog({
      action: 'USERS_BULK_IMPORTED',
      resourceType: 'skillpod_tenant',
      resourceId: tenantId,
      userId: adminId,
      metadata: { success: result.success, failed: result.failed },
    });

    return result;
  }

  /**
   * Update user role
   */
  async updateUserRole(
    tenantId: string,
    adminId: string,
    userId: string,
    role: TenantAdminRole | 'USER'
  ): Promise<TenantUser> {
    const user = await prisma.skillpodTenantUser.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent demoting the last super admin
    if (user.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const superAdminCount = await prisma.skillpodTenantUser.count({
        where: { tenantId, role: 'SUPER_ADMIN', status: 'ACTIVE' },
      });

      if (superAdminCount <= 1) {
        throw new Error('Cannot remove the last Super Admin');
      }
    }

    const updated = await prisma.skillpodTenantUser.update({
      where: { id: userId },
      data: { role },
    });

    await createAuditLog({
      action: 'USER_ROLE_UPDATED',
      resourceType: 'skillpod_tenant_user',
      resourceId: userId,
      userId: adminId,
      metadata: { previousRole: user.role, newRole: role },
    });

    return this.getUser(tenantId, userId) as Promise<TenantUser>;
  }

  /**
   * Suspend user
   */
  async suspendUser(tenantId: string, adminId: string, userId: string): Promise<TenantUser> {
    const user = await prisma.skillpodTenantUser.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (userId === adminId) {
      throw new Error('Cannot suspend yourself');
    }

    // Terminate active sessions
    await prisma.skillpodSession.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'TERMINATED', terminatedAt: new Date() },
    });

    await prisma.skillpodTenantUser.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });

    await createAuditLog({
      action: 'USER_SUSPENDED',
      resourceType: 'skillpod_tenant_user',
      resourceId: userId,
      userId: adminId,
    });

    return this.getUser(tenantId, userId) as Promise<TenantUser>;
  }

  /**
   * Reactivate user
   */
  async reactivateUser(tenantId: string, adminId: string, userId: string): Promise<TenantUser> {
    await prisma.skillpodTenantUser.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    await createAuditLog({
      action: 'USER_REACTIVATED',
      resourceType: 'skillpod_tenant_user',
      resourceId: userId,
      userId: adminId,
    });

    return this.getUser(tenantId, userId) as Promise<TenantUser>;
  }

  /**
   * Remove user
   */
  async removeUser(tenantId: string, adminId: string, userId: string): Promise<void> {
    const user = await prisma.skillpodTenantUser.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (userId === adminId) {
      throw new Error('Cannot remove yourself');
    }

    // Terminate sessions and soft delete
    await prisma.$transaction([
      prisma.skillpodSession.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'TERMINATED', terminatedAt: new Date() },
      }),
      prisma.skillpodTenantUser.update({
        where: { id: userId },
        data: { status: 'REMOVED', removedAt: new Date() },
      }),
    ]);

    await createAuditLog({
      action: 'USER_REMOVED',
      resourceType: 'skillpod_tenant_user',
      resourceId: userId,
      userId: adminId,
    });
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  /**
   * List active sessions
   */
  async listActiveSessions(tenantId: string): Promise<SessionInfo[]> {
    const sessions = await prisma.skillpodSession.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        policy: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const sessionIds = sessions.map((s) => s.id);
    const violations = await prisma.skillpodSecurityEvent.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessionIds }, type: 'POLICY_VIOLATION' },
      _count: true,
    });

    const violationMap = new Map(violations.map((v) => [v.sessionId, v._count]));

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user.email,
      userName: `${s.user.firstName} ${s.user.lastName}`,
      status: s.status,
      startedAt: s.startedAt,
      duration: Math.round((Date.now() - s.startedAt.getTime()) / 60000),
      policyName: s.policy?.name || 'Default',
      ipAddress: s.ipAddress,
      violations: violationMap.get(s.id) || 0,
    }));
  }

  /**
   * Terminate session
   */
  async terminateSession(tenantId: string, adminId: string, sessionId: string): Promise<void> {
    const session = await prisma.skillpodSession.findFirst({
      where: { id: sessionId, tenantId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    await prisma.skillpodSession.update({
      where: { id: sessionId },
      data: {
        status: 'TERMINATED',
        terminatedAt: new Date(),
        terminatedBy: adminId,
        terminationReason: 'ADMIN_TERMINATED',
      },
    });

    await createAuditLog({
      action: 'SESSION_TERMINATED',
      resourceType: 'skillpod_session',
      resourceId: sessionId,
      userId: adminId,
    });
  }

  // ===========================================================================
  // AUDIT LOG
  // ===========================================================================

  /**
   * Get admin activity log
   */
  async getAdminActivityLog(
    tenantId: string,
    options: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ logs: unknown[]; total: number }> {
    const { userId, action, startDate, endDate, limit = 50, offset = 0 } = options;

    const where: Record<string, unknown> = {
      resourceType: { startsWith: 'skillpod_' },
      metadata: { path: ['tenantId'], equals: tenantId },
    };

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let adminPortalService: TenantAdminPortalService | null = null;

export function getTenantAdminPortalService(): TenantAdminPortalService {
  if (!adminPortalService) {
    adminPortalService = new TenantAdminPortalService();
  }
  return adminPortalService;
}
