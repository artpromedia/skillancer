import { PrismaClient } from '../types/prisma-shim.js';
import crypto from 'crypto';

export interface IntegrationConnectInput {
  engagementId: string;
  integrationTypeSlug: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  apiKey?: string;
  config?: Record<string, unknown>;
  accountId?: string;
  accountName?: string;
}

export interface IntegrationSyncResult {
  success: boolean;
  data?: any;
  error?: string;
  syncedAt: Date;
}

export class IntegrationHubService {
  private encryptionKey: Buffer;

  constructor(private readonly prisma: PrismaClient) {
    // Use environment variable for encryption key
    const key = process.env.INTEGRATION_ENCRYPTION_KEY || 'default-32-char-encryption-key!';
    this.encryptionKey = Buffer.from(key.padEnd(32, '0').slice(0, 32));
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get all available integration types
   */
  async getIntegrationTypes(category?: string, executiveRole?: string) {
    const where: any = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (executiveRole) {
      where.applicableRoles = { has: executiveRole };
    }

    const types = await this.prisma.integrationType.findMany({
      where,
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });

    return types;
  }

  /**
   * Get integration type by slug
   */
  async getIntegrationTypeBySlug(slug: string) {
    const type = await this.prisma.integrationType.findUnique({
      where: { slug },
    });

    return type;
  }

  /**
   * Connect an integration
   */
  async connectIntegration(input: IntegrationConnectInput) {
    const integrationType = await this.prisma.integrationType.findUnique({
      where: { slug: input.integrationTypeSlug },
    });

    if (!integrationType) {
      throw new Error(`Integration type ${input.integrationTypeSlug} not found`);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = input.accessToken ? this.encrypt(input.accessToken) : null;
    const encryptedRefreshToken = input.refreshToken ? this.encrypt(input.refreshToken) : null;
    const encryptedApiKey = input.apiKey ? this.encrypt(input.apiKey) : null;

    const integration = await this.prisma.executiveIntegration.upsert({
      where: {
        engagementId_integrationTypeId: {
          engagementId: input.engagementId,
          integrationTypeId: integrationType.id,
        },
      },
      create: {
        engagementId: input.engagementId,
        integrationTypeId: integrationType.id,
        status: 'CONNECTED',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        apiKey: encryptedApiKey,
        config: input.config ? JSON.parse(JSON.stringify(input.config)) : null,
        accountId: input.accountId,
        accountName: input.accountName,
        syncEnabled: true,
      },
      update: {
        status: 'CONNECTED',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        apiKey: encryptedApiKey,
        config: input.config ? JSON.parse(JSON.stringify(input.config)) : undefined,
        accountId: input.accountId,
        accountName: input.accountName,
      },
      include: {
        integrationType: true,
      },
    });

    return integration;
  }

  /**
   * Disconnect an integration
   */
  async disconnectIntegration(integrationId: string) {
    const integration = await this.prisma.executiveIntegration.update({
      where: { id: integrationId },
      data: {
        status: 'REVOKED',
        accessToken: null,
        refreshToken: null,
        apiKey: null,
        syncEnabled: false,
      },
    });

    return integration;
  }

  /**
   * Get integrations for an engagement
   */
  async getEngagementIntegrations(engagementId: string) {
    const integrations = await this.prisma.executiveIntegration.findMany({
      where: { engagementId },
      include: {
        integrationType: true,
      },
    });

    // Remove sensitive data from response
    return integrations.map((integration) => ({
      ...integration,
      accessToken: undefined,
      refreshToken: undefined,
      apiKey: undefined,
      isConnected: integration.status === 'CONNECTED',
    }));
  }

  /**
   * Get decrypted credentials for an integration
   * This should only be called internally for API calls
   */
  async getIntegrationCredentials(integrationId: string) {
    const integration = await this.prisma.executiveIntegration.findUnique({
      where: { id: integrationId },
      include: {
        integrationType: true,
      },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    return {
      accessToken: integration.accessToken ? this.decrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.decrypt(integration.refreshToken) : null,
      apiKey: integration.apiKey ? this.decrypt(integration.apiKey) : null,
      config: integration.config,
      integrationType: integration.integrationType,
    };
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(
    integrationId: string,
    newAccessToken: string,
    newRefreshToken?: string,
    expiresAt?: Date
  ) {
    const encryptedAccessToken = this.encrypt(newAccessToken);
    const encryptedRefreshToken = newRefreshToken ? this.encrypt(newRefreshToken) : undefined;

    const integration = await this.prisma.executiveIntegration.update({
      where: { id: integrationId },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        status: 'CONNECTED',
      },
    });

    return integration;
  }

  /**
   * Mark integration as needing re-auth
   */
  async markNeedsReauth(integrationId: string) {
    const integration = await this.prisma.executiveIntegration.update({
      where: { id: integrationId },
      data: {
        status: 'REQUIRES_REAUTH',
      },
    });

    return integration;
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(integrationId: string, result: IntegrationSyncResult) {
    const integration = await this.prisma.executiveIntegration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: result.syncedAt,
        lastSyncStatus: result.success ? 'SUCCESS' : 'FAILED',
        lastSyncError: result.error,
        cachedData: result.data ? JSON.parse(JSON.stringify(result.data)) : undefined,
        cacheExpiresAt: result.data
          ? new Date(Date.now() + 60 * 60 * 1000) // 1 hour cache
          : undefined,
      },
    });

    return integration;
  }

  /**
   * Get cached data for integration
   */
  async getCachedData(integrationId: string) {
    const integration = await this.prisma.executiveIntegration.findUnique({
      where: { id: integrationId },
      select: {
        cachedData: true,
        cacheExpiresAt: true,
        lastSyncAt: true,
      },
    });

    if (!integration) {
      return null;
    }

    // Check if cache is expired
    if (integration.cacheExpiresAt && integration.cacheExpiresAt < new Date()) {
      return null;
    }

    return integration.cachedData;
  }

  /**
   * Enable/disable sync for integration
   */
  async toggleSync(integrationId: string, enabled: boolean) {
    const integration = await this.prisma.executiveIntegration.update({
      where: { id: integrationId },
      data: {
        syncEnabled: enabled,
      },
    });

    return integration;
  }

  /**
   * Set sync frequency
   */
  async setSyncFrequency(integrationId: string, frequency: string) {
    const integration = await this.prisma.executiveIntegration.update({
      where: { id: integrationId },
      data: {
        syncFrequency: frequency,
      },
    });

    return integration;
  }

  /**
   * Get integrations that need syncing
   */
  async getIntegrationsToSync() {
    const now = new Date();

    const integrations = await this.prisma.executiveIntegration.findMany({
      where: {
        status: 'CONNECTED',
        syncEnabled: true,
        OR: [
          { lastSyncAt: null },
          {
            syncFrequency: 'REALTIME',
            lastSyncAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) }, // 5 min
          },
          {
            syncFrequency: 'HOURLY',
            lastSyncAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) }, // 1 hour
          },
          {
            syncFrequency: 'DAILY',
            lastSyncAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // 24 hours
          },
        ],
      },
      include: {
        integrationType: true,
        engagement: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    return integrations;
  }

  /**
   * Create or update integration type (admin function)
   */
  async upsertIntegrationType(data: {
    slug: string;
    name: string;
    description?: string;
    category: string;
    applicableRoles: string[];
    oauthProvider?: string;
    oauthAuthUrl?: string;
    oauthTokenUrl?: string;
    oauthScopes?: string[];
    apiBaseUrl?: string;
    logoUrl?: string;
    tier: string;
    addonPriceMonthly?: number;
    supportedWidgets?: any[];
  }) {
    const integrationType = await this.prisma.integrationType.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: data.category as any,
        applicableRoles: data.applicableRoles as any[],
        oauthProvider: data.oauthProvider,
        oauthAuthUrl: data.oauthAuthUrl,
        oauthTokenUrl: data.oauthTokenUrl,
        oauthScopes: data.oauthScopes || [],
        apiBaseUrl: data.apiBaseUrl,
        logoUrl: data.logoUrl,
        tier: data.tier as any,
        addonPriceMonthly: data.addonPriceMonthly,
        supportedWidgets: data.supportedWidgets
          ? JSON.parse(JSON.stringify(data.supportedWidgets))
          : null,
        isActive: true,
      },
      update: {
        name: data.name,
        description: data.description,
        category: data.category as any,
        applicableRoles: data.applicableRoles as any[],
        oauthProvider: data.oauthProvider,
        oauthAuthUrl: data.oauthAuthUrl,
        oauthTokenUrl: data.oauthTokenUrl,
        oauthScopes: data.oauthScopes || [],
        apiBaseUrl: data.apiBaseUrl,
        logoUrl: data.logoUrl,
        tier: data.tier as any,
        addonPriceMonthly: data.addonPriceMonthly,
        supportedWidgets: data.supportedWidgets
          ? JSON.parse(JSON.stringify(data.supportedWidgets))
          : undefined,
      },
    });

    return integrationType;
  }

  /**
   * Seed default integration types
   */
  async seedIntegrationTypes() {
    const integrations = [
      // CTO Tools
      {
        slug: 'github',
        name: 'GitHub',
        description: 'Access repositories, commits, pull requests, and code analytics',
        category: 'DEVTOOLS',
        applicableRoles: ['FRACTIONAL_CTO'],
        oauthProvider: 'github',
        tier: 'PRO',
        logoUrl: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      },
      {
        slug: 'gitlab',
        name: 'GitLab',
        description: 'Access GitLab repositories and CI/CD pipelines',
        category: 'DEVTOOLS',
        applicableRoles: ['FRACTIONAL_CTO'],
        oauthProvider: 'gitlab',
        tier: 'PRO',
      },
      {
        slug: 'datadog',
        name: 'Datadog',
        description: 'Monitor application performance and infrastructure metrics',
        category: 'DEVTOOLS',
        applicableRoles: ['FRACTIONAL_CTO', 'FRACTIONAL_CISO'],
        tier: 'PRO',
      },
      {
        slug: 'aws',
        name: 'AWS',
        description: 'Access AWS cost explorer and service health',
        category: 'CLOUD',
        applicableRoles: ['FRACTIONAL_CTO', 'FRACTIONAL_CFO'],
        tier: 'PRO',
      },
      // CFO Tools
      {
        slug: 'quickbooks',
        name: 'QuickBooks Online',
        description: 'Access financial data, invoices, and reports',
        category: 'ACCOUNTING',
        applicableRoles: ['FRACTIONAL_CFO'],
        oauthProvider: 'quickbooks',
        tier: 'PRO',
      },
      {
        slug: 'xero',
        name: 'Xero',
        description: 'Access accounting data and financial reports',
        category: 'ACCOUNTING',
        applicableRoles: ['FRACTIONAL_CFO'],
        oauthProvider: 'xero',
        tier: 'PRO',
      },
      {
        slug: 'stripe',
        name: 'Stripe',
        description: 'Access payment data and revenue analytics',
        category: 'ACCOUNTING',
        applicableRoles: ['FRACTIONAL_CFO'],
        tier: 'PRO',
      },
      // CMO Tools
      {
        slug: 'google-analytics',
        name: 'Google Analytics 4',
        description: 'Access website and app analytics',
        category: 'ANALYTICS',
        applicableRoles: ['FRACTIONAL_CMO'],
        oauthProvider: 'google',
        tier: 'PRO',
      },
      {
        slug: 'meta-ads',
        name: 'Meta Ads',
        description: 'Access Facebook and Instagram advertising data',
        category: 'MARKETING',
        applicableRoles: ['FRACTIONAL_CMO'],
        oauthProvider: 'facebook',
        tier: 'PRO',
      },
      {
        slug: 'hubspot',
        name: 'HubSpot',
        description: 'Access CRM and marketing automation data',
        category: 'CRM',
        applicableRoles: ['FRACTIONAL_CMO', 'FRACTIONAL_CRO'],
        oauthProvider: 'hubspot',
        tier: 'PRO',
      },
      // CISO Tools
      {
        slug: 'snyk',
        name: 'Snyk',
        description: 'Monitor code vulnerabilities and security issues',
        category: 'SECURITY',
        applicableRoles: ['FRACTIONAL_CISO', 'FRACTIONAL_CTO'],
        tier: 'PRO',
      },
      {
        slug: 'aws-security-hub',
        name: 'AWS Security Hub',
        description: 'Centralized security findings and compliance',
        category: 'SECURITY',
        applicableRoles: ['FRACTIONAL_CISO'],
        tier: 'PRO',
      },
      // HR Tools
      {
        slug: 'bamboohr',
        name: 'BambooHR',
        description: 'Access HR data and employee information',
        category: 'HR',
        applicableRoles: ['FRACTIONAL_CHRO'],
        tier: 'PRO',
      },
      {
        slug: 'gusto',
        name: 'Gusto',
        description: 'Access payroll and benefits data',
        category: 'HR',
        applicableRoles: ['FRACTIONAL_CHRO', 'FRACTIONAL_CFO'],
        tier: 'PRO',
      },
      {
        slug: 'greenhouse',
        name: 'Greenhouse',
        description: 'Access recruiting and hiring data',
        category: 'HR',
        applicableRoles: ['FRACTIONAL_CHRO'],
        tier: 'PRO',
      },
      // Common Tools
      {
        slug: 'notion',
        name: 'Notion',
        description: 'Access documentation and knowledge base',
        category: 'PRODUCTIVITY',
        applicableRoles: [
          'FRACTIONAL_CTO',
          'FRACTIONAL_CFO',
          'FRACTIONAL_CMO',
          'FRACTIONAL_COO',
          'FRACTIONAL_CHRO',
          'FRACTIONAL_CISO',
          'FRACTIONAL_CPO',
        ],
        oauthProvider: 'notion',
        tier: 'BASIC',
      },
      {
        slug: 'jira',
        name: 'Jira',
        description: 'Access project and issue tracking',
        category: 'PROJECT_MANAGEMENT',
        applicableRoles: ['FRACTIONAL_CTO', 'FRACTIONAL_CPO', 'FRACTIONAL_COO'],
        oauthProvider: 'atlassian',
        tier: 'PRO',
      },
      {
        slug: 'asana',
        name: 'Asana',
        description: 'Access project and task management',
        category: 'PROJECT_MANAGEMENT',
        applicableRoles: ['FRACTIONAL_COO', 'FRACTIONAL_CPO'],
        oauthProvider: 'asana',
        tier: 'PRO',
      },
    ];

    for (const integration of integrations) {
      await this.upsertIntegrationType(integration as any);
    }

    return { count: integrations.length };
  }
}
