/**
 * @module @skillancer/admin/services
 * Admin service - core admin user and permission management
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import {
  type AdminUser,
  type AdminRole,
  type AdminPermission,
  rolePermissions,
  type AuditLogEntry,
  type AuditAction,
  type ResourceType,
  type FeatureFlag,
  type SystemSetting,
} from '../models/admin-schema.js';

import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

export interface AdminServiceConfig {
  sessionTTL: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  mfaRequired: boolean;
}

export interface RequestContext {
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  audit(entry: AuditLogEntry): void;
}

export class AdminService {
  private requestContext: RequestContext | null = null;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger,
    private config: AdminServiceConfig
  ) {}

  setRequestContext(context: RequestContext): void {
    this.requestContext = context;
  }

  // ==================== Admin User Management ====================

  async createAdminUser(
    data: {
      email: string;
      name: string;
      role: AdminRole;
      permissions?: AdminPermission[];
      department?: string;
    },
    createdBy: string
  ): Promise<AdminUser> {
    const existing = await (this.prisma as any).adminUser.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error('Admin user with this email already exists');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const permissions = [...rolePermissions[data.role], ...(data.permissions || [])];

    const adminUser = await (this.prisma as any).adminUser.create({
      data: {
        id: uuidv4(),
        email: data.email,
        name: data.name,
        role: data.role,
        permissions: [...new Set(permissions)],
        department: data.department,
        passwordHash,
        isActive: true,
        mfaEnabled: this.config.mfaRequired,
        createdBy,
      },
    });

    await this.logAuditEvent({
      adminUserId: createdBy,
      action: 'create',
      resource: { type: 'admin_user', id: adminUser.id, name: adminUser.email },
      details: { after: { email: data.email, role: data.role } },
    });

    await this.sendAdminInviteEmail(adminUser.email, tempPassword);

    return this.sanitizeAdminUser(adminUser);
  }

  async updateAdminUser(
    id: string,
    data: Partial<{
      name: string;
      role: AdminRole;
      permissions: AdminPermission[];
      department: string;
      isActive: boolean;
    }>,
    updatedBy: string
  ): Promise<AdminUser> {
    const existing = await (this.prisma as any).adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Admin user not found');
    }

    let permissions = data.permissions || existing.permissions;
    if (data.role && data.role !== existing.role) {
      permissions = [...rolePermissions[data.role], ...(data.permissions || [])];
    }

    const adminUser = await (this.prisma as any).adminUser.update({
      where: { id },
      data: {
        ...data,
        permissions: [...new Set(permissions)],
        updatedAt: new Date(),
      },
    });

    await this.logAuditEvent({
      adminUserId: updatedBy,
      action: 'update',
      resource: { type: 'admin_user', id, name: adminUser.email },
      details: {
        before: { role: existing.role, isActive: existing.isActive },
        after: { role: data.role, isActive: data.isActive },
      },
    });

    if (data.isActive === false) {
      await this.invalidateAdminSessions(id);
    }

    return this.sanitizeAdminUser(adminUser);
  }

  async getAdminUser(id: string): Promise<AdminUser | null> {
    const adminUser = await (this.prisma as any).adminUser.findUnique({
      where: { id },
    });

    return adminUser ? this.sanitizeAdminUser(adminUser) : null;
  }

  async listAdminUsers(filters?: {
    role?: AdminRole;
    isActive?: boolean;
    department?: string;
    search?: string;
  }): Promise<AdminUser[]> {
    const where: Record<string, unknown> = {};

    if (filters?.role) where.role = filters.role;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.department) where.department = filters.department;
    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const adminUsers = await (this.prisma as any).adminUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return adminUsers.map((u: unknown) => this.sanitizeAdminUser(u));
  }

  async deleteAdminUser(id: string, deletedBy: string): Promise<void> {
    const existing = await (this.prisma as any).adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Admin user not found');
    }

    await (this.prisma as any).adminUser.update({
      where: { id },
      data: {
        isActive: false,
        email: `deleted_${Date.now()}_${existing.email}`,
        deletedAt: new Date(),
      },
    });

    await this.invalidateAdminSessions(id);

    await this.logAuditEvent({
      adminUserId: deletedBy,
      action: 'delete',
      resource: { type: 'admin_user', id, name: existing.email },
      details: { before: { email: existing.email, role: existing.role } },
    });
  }

  // ==================== Permission Checking ====================

  async hasPermission(adminUserId: string, permission: AdminPermission): Promise<boolean> {
    const adminUser = await this.getAdminUser(adminUserId);
    if (!adminUser || !adminUser.isActive) return false;

    if (adminUser.role === 'super_admin') return true;

    return adminUser.permissions.includes(permission);
  }

  async hasAnyPermission(adminUserId: string, permissions: AdminPermission[]): Promise<boolean> {
    const adminUser = await this.getAdminUser(adminUserId);
    if (!adminUser || !adminUser.isActive) return false;

    if (adminUser.role === 'super_admin') return true;

    return permissions.some((p) => adminUser.permissions.includes(p));
  }

  async requirePermission(adminUserId: string, permission: AdminPermission): Promise<void> {
    const hasPermission = await this.hasPermission(adminUserId, permission);
    if (!hasPermission) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }

  // ==================== Audit Logging ====================

  async logAuditEvent(params: {
    adminUserId: string;
    action: AuditAction;
    resource: { type: ResourceType; id: string; name?: string };
    details?: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      reason?: string;
      metadata?: Record<string, unknown>;
    };
    status?: 'success' | 'failure';
    errorMessage?: string;
  }): Promise<void> {
    const adminUser = await this.getAdminUser(params.adminUserId);
    const context = this.requestContext;

    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      adminUserId: params.adminUserId,
      adminUserEmail: adminUser?.email || 'unknown',
      adminUserRole: adminUser?.role || ('unknown' as AdminRole),
      action: params.action,
      resource: params.resource,
      details: params.details || {},
      ipAddress: context?.ipAddress || 'unknown',
      userAgent: context?.userAgent || 'unknown',
      sessionId: context?.sessionId || 'unknown',
      status: params.status || 'success',
      errorMessage: params.errorMessage,
    };

    await (this.prisma as any).auditLog.create({
      data: entry,
    });

    this.logger.audit(entry);
  }

  async getAuditLogs(filters: {
    adminUserId?: string;
    action?: AuditAction;
    resourceType?: ResourceType;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: 'success' | 'failure';
    page?: number;
    limit?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.adminUserId) where.adminUserId = filters.adminUserId;
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resource = { path: ['type'], equals: filters.resourceType };
    if (filters.resourceId) where.resource = { path: ['id'], equals: filters.resourceId };
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {} as Record<string, Date>;
      if (filters.startDate) (where.timestamp as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate) (where.timestamp as Record<string, Date>).lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      (this.prisma as any).auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: ((filters.page || 1) - 1) * (filters.limit || 50),
        take: filters.limit || 50,
      }),
      (this.prisma as any).auditLog.count({ where }),
    ]);

    return { logs: logs as AuditLogEntry[], total };
  }

  // ==================== Feature Flags ====================

  async getFeatureFlags(environment?: string): Promise<FeatureFlag[]> {
    const where: Record<string, unknown> = {};
    if (environment) where.environment = environment;

    return (this.prisma as any).featureFlag.findMany({
      where,
      orderBy: { key: 'asc' },
    });
  }

  async getFeatureFlag(key: string, environment: string): Promise<FeatureFlag | null> {
    return (this.prisma as any).featureFlag.findFirst({
      where: { key, environment },
    });
  }

  async updateFeatureFlag(
    key: string,
    environment: string,
    data: Partial<{
      enabled: boolean;
      rolloutPercentage: number;
      targetedUsers: string[];
      targetedSegments: string[];
      rules: unknown[];
    }>,
    updatedBy: string
  ): Promise<FeatureFlag> {
    const existing = await this.getFeatureFlag(key, environment);
    if (!existing) {
      throw new Error('Feature flag not found');
    }

    const updated = await (this.prisma as any).featureFlag.update({
      where: { id: existing.id },
      data: {
        ...data,
        updatedAt: new Date(),
        updatedBy,
      },
    });

    await this.redis.del(`feature:${environment}:${key}`);

    await this.logAuditEvent({
      adminUserId: updatedBy,
      action: 'configure',
      resource: { type: 'feature_flag', id: key, name: existing.name },
      details: {
        before: { enabled: existing.enabled, rolloutPercentage: existing.rolloutPercentage },
        after: { enabled: data.enabled, rolloutPercentage: data.rolloutPercentage },
      },
    });

    return updated;
  }

  async isFeatureEnabled(
    key: string,
    environment: string,
    userId?: string,
    userAttributes?: Record<string, unknown>
  ): Promise<boolean> {
    const cacheKey = `feature:${environment}:${key}`;
    const cached = await this.redis.get(cacheKey);

    let flag: FeatureFlag;
    if (cached) {
      flag = JSON.parse(cached);
    } else {
      const dbFlag = await this.getFeatureFlag(key, environment);
      if (!dbFlag) return false;
      flag = dbFlag;
      await this.redis.setex(cacheKey, 300, JSON.stringify(flag));
    }

    if (!flag.enabled) return false;

    if (userId && flag.targetedUsers?.includes(userId)) return true;

    if (flag.rules && userAttributes) {
      for (const rule of flag.rules) {
        if (!this.evaluateRule(rule, userAttributes)) {
          return false;
        }
      }
    }

    if (flag.rolloutPercentage < 100) {
      if (!userId) return false;
      const hash = this.hashUserId(userId, key);
      return hash < flag.rolloutPercentage;
    }

    return true;
  }

  private evaluateRule(rule: unknown, attributes: Record<string, unknown>): boolean {
    const r = rule as { attribute: string; operator: string; value: unknown };
    const value = attributes[r.attribute];
    if (value === undefined) return false;

    switch (r.operator) {
      case 'equals':
        return value === r.value;
      case 'not_equals':
        return value !== r.value;
      case 'contains':
        return String(value).includes(String(r.value));
      case 'greater_than':
        return Number(value) > Number(r.value);
      case 'less_than':
        return Number(value) < Number(r.value);
      case 'in':
        return Array.isArray(r.value) && (r.value as unknown[]).includes(value);
      case 'not_in':
        return Array.isArray(r.value) && !(r.value as unknown[]).includes(value);
      default:
        return false;
    }
  }

  private hashUserId(userId: string, key: string): number {
    const str = `${userId}:${key}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  // ==================== System Settings ====================

  async getSettings(category?: string): Promise<SystemSetting[]> {
    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const settings = await (this.prisma as any).systemSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return settings.map((s: SystemSetting) => ({
      ...s,
      value: s.valueType === 'secret' ? '********' : s.value,
    }));
  }

  async getSetting(key: string): Promise<SystemSetting | null> {
    const cached = await this.redis.get(`setting:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const setting = await (this.prisma as any).systemSetting.findUnique({
      where: { key },
    });

    if (setting) {
      await this.redis.setex(`setting:${key}`, 300, JSON.stringify(setting));
    }

    return setting;
  }

  async getSettingValue<T>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.getSetting(key);
    return setting ? (setting.value as T) : (defaultValue as T);
  }

  async updateSetting(key: string, value: unknown, updatedBy: string): Promise<SystemSetting> {
    const existing = await (this.prisma as any).systemSetting.findUnique({
      where: { key },
    });

    if (!existing) {
      throw new Error('Setting not found');
    }

    if (!existing.isEditable) {
      throw new Error('This setting cannot be modified');
    }

    this.validateSettingValue(existing, value);

    const updated = await (this.prisma as any).systemSetting.update({
      where: { key },
      data: {
        value,
        updatedAt: new Date(),
        updatedBy,
      },
    });

    await this.redis.del(`setting:${key}`);

    await this.logAuditEvent({
      adminUserId: updatedBy,
      action: 'configure',
      resource: { type: 'setting', id: key, name: existing.description },
      details: {
        before: { value: existing.valueType === 'secret' ? '[REDACTED]' : existing.value },
        after: { value: existing.valueType === 'secret' ? '[REDACTED]' : value },
      },
    });

    return updated;
  }

  private validateSettingValue(setting: SystemSetting, value: unknown): void {
    const rules = setting.validationRules;
    if (!rules) return;

    if (setting.valueType === 'number') {
      if (rules.min !== undefined && (value as number) < rules.min) {
        throw new Error(`Value must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && (value as number) > rules.max) {
        throw new Error(`Value must be at most ${rules.max}`);
      }
    }

    if (setting.valueType === 'string') {
      if (rules.pattern && !new RegExp(rules.pattern).test(value as string)) {
        throw new Error('Value does not match required pattern');
      }
      if (rules.options && !rules.options.includes(value as string)) {
        throw new Error(`Value must be one of: ${rules.options.join(', ')}`);
      }
    }
  }

  // ==================== Helper Methods ====================

  private sanitizeAdminUser(user: unknown): AdminUser {
    const u = user as Record<string, unknown>;
    const { passwordHash: _passwordHash, ...sanitized } = u;
    return sanitized as unknown as AdminUser;
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async invalidateAdminSessions(adminUserId: string): Promise<void> {
    const pattern = `admin:session:${adminUserId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async sendAdminInviteEmail(email: string, _tempPassword: string): Promise<void> {
    this.logger.info('Sending admin invite email', { email, tempPassword: '[REDACTED]' });
  }
}
