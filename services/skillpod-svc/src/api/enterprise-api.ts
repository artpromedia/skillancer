// @ts-nocheck
/**
 * Enterprise API Service
 * API key management and enterprise endpoints
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { getLogger } from '@skillancer/logger';
import { getAuditClient } from '@skillancer/audit-client';

// =============================================================================
// TYPES
// =============================================================================

type ApiKeyScope = 'read' | 'write' | 'admin';
type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string;
  ipWhitelist: string[];
  rateLimit: number; // requests per minute
}

interface ApiKeyCreateResult {
  id: string;
  name: string;
  keyPrefix: string;
  fullKey: string; // Only returned once on creation
  scopes: ApiKeyScope[];
  expiresAt: Date | null;
}

interface ApiUsageStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  avgResponseTimeMs: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
  }>;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

// =============================================================================
// ENTERPRISE API SERVICE
// =============================================================================

export class EnterpriseApiService {
  private prisma: PrismaClient;
  private logger = getLogger('enterprise-api');
  private audit = getAuditClient();

  // API key prefix for identification
  private readonly KEY_PREFIX = 'skpd_';
  private readonly KEY_LENGTH = 32;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ===========================================================================
  // API KEY MANAGEMENT
  // ===========================================================================

  /**
   * Generate a secure API key
   */
  private generateApiKey(): { key: string; hash: string; prefix: string } {
    const rawKey = randomBytes(this.KEY_LENGTH).toString('base64url');
    const fullKey = `${this.KEY_PREFIX}${rawKey}`;
    const prefix = fullKey.substring(0, 12);

    // Store hash, not the actual key
    const hash = createHash('sha256').update(fullKey).digest('hex');

    return { key: fullKey, hash, prefix };
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    tenantId: string,
    params: {
      name: string;
      scopes: ApiKeyScope[];
      expiresInDays?: number;
      ipWhitelist?: string[];
      rateLimit?: number;
    },
    createdBy: string
  ): Promise<ApiKeyCreateResult> {
    // Check if tenant has API access
    const tenant = await this.prisma.skillpodTenant.findUnique({
      where: { id: tenantId },
      select: { features: true, planId: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const features = tenant.features as Record<string, boolean>;
    if (!features.apiAccess) {
      throw new Error('API access not available on your plan. Upgrade to Pro or Enterprise.');
    }

    // Check API key limit
    const existingKeys = await this.prisma.skillpodApiKey.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const maxKeys = tenant.planId === 'ENTERPRISE' ? 50 : 10;
    if (existingKeys >= maxKeys) {
      throw new Error(`Maximum API keys (${maxKeys}) reached`);
    }

    // Generate key
    const { key, hash, prefix } = this.generateApiKey();

    // Calculate expiration
    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Create key record
    const apiKey = await this.prisma.skillpodApiKey.create({
      data: {
        tenantId,
        name: params.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: params.scopes,
        status: 'ACTIVE',
        expiresAt,
        ipWhitelist: params.ipWhitelist || [],
        rateLimit: params.rateLimit || 1000,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'API_KEY_CREATED',
      resourceType: 'API_KEY',
      resourceId: apiKey.id,
      actorId: createdBy,
      metadata: {
        tenantId,
        name: params.name,
        scopes: params.scopes,
      },
    });

    this.logger.info('API key created', {
      tenantId,
      keyId: apiKey.id,
      name: params.name,
    });

    // Return full key only once
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: prefix,
      fullKey: key, // Only time the full key is returned
      scopes: params.scopes,
      expiresAt,
    };
  }

  /**
   * List API keys for tenant
   */
  async listApiKeys(tenantId: string): Promise<ApiKey[]> {
    const keys = await this.prisma.skillpodApiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes as ApiKeyScope[],
      status: key.status as ApiKeyStatus,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      createdBy: key.createdBy,
      ipWhitelist: key.ipWhitelist as string[],
      rateLimit: key.rateLimit,
    }));
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(tenantId: string, keyId: string, revokedBy: string): Promise<void> {
    const key = await this.prisma.skillpodApiKey.findFirst({
      where: { id: keyId, tenantId },
    });

    if (!key) {
      throw new Error('API key not found');
    }

    if (key.status === 'REVOKED') {
      throw new Error('API key is already revoked');
    }

    await this.prisma.skillpodApiKey.update({
      where: { id: keyId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy,
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'API_KEY_REVOKED',
      resourceType: 'API_KEY',
      resourceId: keyId,
      actorId: revokedBy,
      metadata: { tenantId, name: key.name },
    });

    this.logger.info('API key revoked', { keyId, tenantId });
  }

  /**
   * Rotate an API key (revoke old, create new with same settings)
   */
  async rotateApiKey(
    tenantId: string,
    keyId: string,
    rotatedBy: string
  ): Promise<ApiKeyCreateResult> {
    const oldKey = await this.prisma.skillpodApiKey.findFirst({
      where: { id: keyId, tenantId },
    });

    if (!oldKey) {
      throw new Error('API key not found');
    }

    // Create new key with same settings
    const newKeyResult = await this.createApiKey(
      tenantId,
      {
        name: oldKey.name,
        scopes: oldKey.scopes as ApiKeyScope[],
        expiresInDays: oldKey.expiresAt
          ? Math.ceil((oldKey.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : undefined,
        ipWhitelist: oldKey.ipWhitelist as string[],
        rateLimit: oldKey.rateLimit,
      },
      rotatedBy
    );

    // Revoke old key
    await this.revokeApiKey(tenantId, keyId, rotatedBy);

    await this.audit.log({
      action: 'API_KEY_ROTATED',
      resourceType: 'API_KEY',
      resourceId: keyId,
      actorId: rotatedBy,
      metadata: {
        tenantId,
        oldKeyId: keyId,
        newKeyId: newKeyResult.id,
      },
    });

    return newKeyResult;
  }

  /**
   * Validate an API key and return tenant context
   */
  async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    tenantId?: string;
    scopes?: ApiKeyScope[];
    rateLimitInfo?: RateLimitInfo;
    error?: string;
  }> {
    // Check format
    if (!apiKey.startsWith(this.KEY_PREFIX)) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // Hash the key for comparison
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Find matching key
    const key = await this.prisma.skillpodApiKey.findFirst({
      where: { keyHash },
      include: {
        tenant: {
          select: { id: true, status: true, limits: true },
        },
      },
    });

    if (!key) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (key.status === 'REVOKED') {
      return { valid: false, error: 'API key has been revoked' };
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    if (key.tenant.status !== 'ACTIVE') {
      return { valid: false, error: 'Tenant is not active' };
    }

    // Update last used timestamp (async, don't wait)
    this.prisma.skillpodApiKey
      .update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {}); // Ignore errors

    // Get rate limit info
    const rateLimitInfo = await this.getRateLimitInfo(key.id, key.rateLimit);

    return {
      valid: true,
      tenantId: key.tenantId,
      scopes: key.scopes as ApiKeyScope[],
      rateLimitInfo,
    };
  }

  /**
   * Check and increment rate limit
   */
  private async getRateLimitInfo(keyId: string, limit: number): Promise<RateLimitInfo> {
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000); // Start of current minute
    const windowEnd = new Date(windowStart.getTime() + 60000);

    // Count requests in current window
    const count = await this.prisma.skillpodApiRequest.count({
      where: {
        apiKeyId: keyId,
        timestamp: { gte: windowStart },
      },
    });

    return {
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: windowEnd,
    };
  }

  /**
   * Record an API request
   */
  async recordRequest(params: {
    apiKeyId: string;
    tenantId: string;
    method: string;
    endpoint: string;
    statusCode: number;
    responseTimeMs: number;
    ipAddress: string;
  }): Promise<void> {
    await this.prisma.skillpodApiRequest.create({
      data: {
        apiKeyId: params.apiKeyId,
        tenantId: params.tenantId,
        method: params.method,
        endpoint: params.endpoint,
        statusCode: params.statusCode,
        responseTimeMs: params.responseTimeMs,
        ipAddress: params.ipAddress,
        timestamp: new Date(),
      },
    });
  }

  // ===========================================================================
  // API USAGE STATISTICS
  // ===========================================================================

  /**
   * Get API usage statistics for tenant
   */
  async getUsageStats(tenantId: string): Promise<ApiUsageStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total requests
    const totalRequests = await this.prisma.skillpodApiRequest.count({
      where: { tenantId },
    });

    // Requests today
    const requestsToday = await this.prisma.skillpodApiRequest.count({
      where: { tenantId, timestamp: { gte: todayStart } },
    });

    // Requests this month
    const requestsThisMonth = await this.prisma.skillpodApiRequest.count({
      where: { tenantId, timestamp: { gte: monthStart } },
    });

    // Average response time (last 24 hours)
    const recentRequests = await this.prisma.skillpodApiRequest.aggregate({
      where: {
        tenantId,
        timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      _avg: { responseTimeMs: true },
    });

    // Error rate (last 24 hours)
    const errorCount = await this.prisma.skillpodApiRequest.count({
      where: {
        tenantId,
        timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        statusCode: { gte: 400 },
      },
    });

    const last24hCount = await this.prisma.skillpodApiRequest.count({
      where: {
        tenantId,
        timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });

    // Top endpoints (last 7 days)
    const topEndpoints = await this.prisma.skillpodApiRequest.groupBy({
      by: ['endpoint', 'method'],
      where: {
        tenantId,
        timestamp: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return {
      totalRequests,
      requestsToday,
      requestsThisMonth,
      avgResponseTimeMs: recentRequests._avg.responseTimeMs || 0,
      errorRate: last24hCount > 0 ? (errorCount / last24hCount) * 100 : 0,
      topEndpoints: topEndpoints.map((e) => ({
        endpoint: e.endpoint,
        method: e.method,
        count: e._count.id,
      })),
    };
  }

  // ===========================================================================
  // ENTERPRISE API ENDPOINTS
  // ===========================================================================

  /**
   * Get sessions for tenant via API
   */
  async getSessions(
    tenantId: string,
    params: {
      status?: 'active' | 'completed' | 'terminated';
      userId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    sessions: Array<{
      id: string;
      userId: string;
      userEmail: string;
      status: string;
      startedAt: Date;
      endedAt: Date | null;
      duration: number | null;
      ipAddress: string;
    }>;
    total: number;
  }> {
    const where: any = { tenantId };
    if (params.status) where.status = params.status.toUpperCase();
    if (params.userId) where.userId = params.userId;

    const [sessions, total] = await Promise.all([
      this.prisma.skillpodSession.findMany({
        where,
        include: {
          user: { select: { email: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.skillpodSession.count({ where }),
    ]);

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.user.email,
        status: s.status,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        duration: s.endedAt
          ? Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
          : null,
        ipAddress: s.ipAddress,
      })),
      total,
    };
  }

  /**
   * Get users for tenant via API
   */
  async getUsers(
    tenantId: string,
    params: {
      status?: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
      role?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      status: string;
      lastLoginAt: Date | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const where: any = { tenantId };
    if (params.status) where.status = params.status;
    if (params.role) where.role = params.role;

    const [users, total] = await Promise.all([
      this.prisma.skillpodUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.skillpodUser.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
      total,
    };
  }

  /**
   * Get security events for tenant via API
   */
  async getSecurityEvents(
    tenantId: string,
    params: {
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    events: Array<{
      id: string;
      type: string;
      severity: string;
      description: string;
      userId: string | null;
      sessionId: string | null;
      metadata: Record<string, any>;
      timestamp: Date;
    }>;
    total: number;
  }> {
    const where: any = { tenantId };
    if (params.severity) where.severity = params.severity;
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = params.startDate;
      if (params.endDate) where.timestamp.lte = params.endDate;
    }

    const [events, total] = await Promise.all([
      this.prisma.skillpodSecurityEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.skillpodSecurityEvent.count({ where }),
    ]);

    return {
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        description: e.description,
        userId: e.userId,
        sessionId: e.sessionId,
        metadata: e.metadata as Record<string, any>,
        timestamp: e.timestamp,
      })),
      total,
    };
  }

  /**
   * Create webhook subscription
   */
  async createWebhook(
    tenantId: string,
    params: {
      url: string;
      events: string[];
      secret?: string;
    },
    createdBy: string
  ): Promise<{ id: string; secret: string }> {
    // Check if tenant has webhook access
    const tenant = await this.prisma.skillpodTenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });

    const features = tenant?.features as Record<string, boolean>;
    if (!features?.webhooks) {
      throw new Error('Webhooks not available on your plan');
    }

    // Validate URL
    try {
      const url = new URL(params.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid URL protocol');
      }
    } catch {
      throw new Error('Invalid webhook URL');
    }

    // Generate secret if not provided
    const secret = params.secret || randomBytes(32).toString('hex');

    const webhook = await this.prisma.skillpodWebhook.create({
      data: {
        tenantId,
        url: params.url,
        events: params.events,
        secret,
        enabled: true,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'WEBHOOK_CREATED',
      resourceType: 'WEBHOOK',
      resourceId: webhook.id,
      actorId: createdBy,
      metadata: { url: params.url, events: params.events },
    });

    return { id: webhook.id, secret };
  }

  /**
   * List webhooks for tenant
   */
  async listWebhooks(tenantId: string): Promise<
    Array<{
      id: string;
      url: string;
      events: string[];
      enabled: boolean;
      lastDeliveryAt: Date | null;
      lastDeliveryStatus: string | null;
      createdAt: Date;
    }>
  > {
    const webhooks = await this.prisma.skillpodWebhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events as string[],
      enabled: w.enabled,
      lastDeliveryAt: w.lastDeliveryAt,
      lastDeliveryStatus: w.lastDeliveryStatus,
      createdAt: w.createdAt,
    }));
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(tenantId: string, webhookId: string, deletedBy: string): Promise<void> {
    const webhook = await this.prisma.skillpodWebhook.findFirst({
      where: { id: webhookId, tenantId },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    await this.prisma.skillpodWebhook.delete({
      where: { id: webhookId },
    });

    await this.audit.log({
      action: 'WEBHOOK_DELETED',
      resourceType: 'WEBHOOK',
      resourceId: webhookId,
      actorId: deletedBy,
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let apiService: EnterpriseApiService | null = null;

export function getEnterpriseApiService(): EnterpriseApiService {
  if (!apiService) {
    const { PrismaClient } = require('@prisma/client');
    apiService = new EnterpriseApiService(new PrismaClient());
  }
  return apiService;
}

