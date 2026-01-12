import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationService } from '../src/services/integration.service';
import { prisma } from '@skillancer/database';

// Mock the connector registry
vi.mock('../src/connectors/registry.js', () => ({
  connectorRegistry: {
    getAll: vi.fn().mockReturnValue([
      {
        id: 'connector-1',
        slug: 'slack',
        name: 'Slack',
        description: 'Slack integration',
        category: 'COMMUNICATION',
        tier: 'standard',
        isBeta: false,
        applicableRoles: ['CTO', 'VP_ENGINEERING'],
        supportedWidgets: [
          { id: 'messages', name: 'Recent Messages', description: 'Latest messages' },
        ],
      },
      {
        id: 'connector-2',
        slug: 'jira',
        name: 'Jira',
        description: 'Jira integration',
        category: 'PROJECT_MANAGEMENT',
        tier: 'premium',
        isBeta: true,
        applicableRoles: ['CTO', 'VP_ENGINEERING', 'CPO'],
        supportedWidgets: [
          { id: 'issues', name: 'Active Issues', description: 'Current issues' },
        ],
      },
    ]),
    get: vi.fn(),
    getOrThrow: vi.fn(),
  },
}));

// Mock oauth service
vi.mock('../src/services/oauth.service.js', () => ({
  oauthService: {
    initiateOAuth: vi.fn().mockResolvedValue({ authorizationUrl: 'https://auth.example.com' }),
    revokeIntegration: vi.fn().mockResolvedValue(undefined),
    getValidTokens: vi.fn().mockResolvedValue({ accessToken: 'test-token' }),
  },
}));

// Mock cache service
vi.mock('../src/services/cache.service.js', () => ({
  cacheService: {
    invalidateIntegration: vi.fn().mockResolvedValue(undefined),
    getWidgetData: vi.fn().mockResolvedValue(null),
    setWidgetData: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('IntegrationService', () => {
  let service: IntegrationService;
  const mockPrisma = prisma as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntegrationService();
  });

  describe('getAvailableIntegrations', () => {
    it('should return all available integrations', async () => {
      mockPrisma.workspaceIntegration.findMany.mockResolvedValue([]);

      const result = await service.getAvailableIntegrations();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('slack');
      expect(result[1].slug).toBe('jira');
    });

    it('should mark integrations as connected when workspace has connections', async () => {
      mockPrisma.workspaceIntegration.findMany.mockResolvedValue([
        {
          integrationType: { slug: 'slack' },
          status: 'CONNECTED',
          lastSyncAt: new Date(),
          enabledWidgets: ['messages'],
        },
      ]);

      const result = await service.getAvailableIntegrations('workspace-123');

      const slackIntegration = result.find((i) => i.slug === 'slack');
      expect(slackIntegration?.isConnected).toBe(true);
      expect(slackIntegration?.enabledWidgetsCount).toBe(1);

      const jiraIntegration = result.find((i) => i.slug === 'jira');
      expect(jiraIntegration?.isConnected).toBe(false);
    });

    it('should filter by executive type', async () => {
      mockPrisma.workspaceIntegration.findMany.mockResolvedValue([]);

      const result = await service.getAvailableIntegrations(undefined, 'CPO' as any);

      // Only Jira includes CPO in applicableRoles
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('jira');
    });

    it('should filter by category', async () => {
      mockPrisma.workspaceIntegration.findMany.mockResolvedValue([]);

      const result = await service.getAvailableIntegrations(undefined, undefined, 'COMMUNICATION' as any);

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('slack');
    });
  });

  describe('getWorkspaceIntegrations', () => {
    it('should return all integrations for a workspace', async () => {
      mockPrisma.workspaceIntegration.findMany.mockResolvedValue([
        {
          id: 'int-1',
          integrationType: { slug: 'slack', name: 'Slack' },
          status: 'CONNECTED',
          connectedAt: new Date(),
          lastSyncAt: new Date(),
          syncStatus: 'SYNCED',
          lastError: null,
          enabledWidgets: ['messages'],
        },
      ]);

      const result = await service.getWorkspaceIntegrations('workspace-123');

      expect(result).toHaveLength(1);
      expect(result[0].connectorSlug).toBe('slack');
      expect(result[0].status).toBe('CONNECTED');
      expect(result[0].enabledWidgets).toContain('messages');
    });

    it('should return empty array when no integrations exist', async () => {
      mockPrisma.workspaceIntegration.findMany.mockResolvedValue([]);

      const result = await service.getWorkspaceIntegrations('workspace-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('connectIntegration', () => {
    it('should initiate OAuth and return authorization URL', async () => {
      const { connectorRegistry } = await import('../src/connectors/registry.js');
      (connectorRegistry.get as any).mockReturnValue({
        getInfo: () => ({ slug: 'slack' }),
      });

      mockPrisma.executiveWorkspace.findUnique.mockResolvedValue({
        id: 'workspace-123',
      });

      const result = await service.connectIntegration(
        'workspace-123',
        'slack',
        'user-123'
      );

      expect(result.authorizationUrl).toBe('https://auth.example.com');
    });

    it('should throw error for non-existent connector', async () => {
      const { connectorRegistry } = await import('../src/connectors/registry.js');
      (connectorRegistry.get as any).mockReturnValue(null);

      await expect(
        service.connectIntegration('workspace-123', 'unknown', 'user-123')
      ).rejects.toThrow('Integration not found');
    });

    it('should throw error for non-existent workspace', async () => {
      const { connectorRegistry } = await import('../src/connectors/registry.js');
      (connectorRegistry.get as any).mockReturnValue({ getInfo: () => ({}) });

      mockPrisma.executiveWorkspace.findUnique.mockResolvedValue(null);

      await expect(
        service.connectIntegration('non-existent', 'slack', 'user-123')
      ).rejects.toThrow('Workspace not found');
    });
  });

  describe('disconnectIntegration', () => {
    it('should revoke OAuth and clear cache', async () => {
      const { oauthService } = await import('../src/services/oauth.service.js');
      const { cacheService } = await import('../src/services/cache.service.js');

      mockPrisma.workspaceIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        workspace: { engagement: {} },
      });

      await service.disconnectIntegration('int-123', 'user-123');

      expect(oauthService.revokeIntegration).toHaveBeenCalledWith('int-123');
      expect(cacheService.invalidateIntegration).toHaveBeenCalledWith('int-123');
    });

    it('should throw error for non-existent integration', async () => {
      mockPrisma.workspaceIntegration.findUnique.mockResolvedValue(null);

      await expect(
        service.disconnectIntegration('non-existent', 'user-123')
      ).rejects.toThrow('Integration not found');
    });
  });

  describe('testIntegration', () => {
    it('should update status to CONNECTED on successful test', async () => {
      const { connectorRegistry } = await import('../src/connectors/registry.js');

      mockPrisma.workspaceIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        integrationType: { slug: 'slack' },
      });

      (connectorRegistry.getOrThrow as any).mockReturnValue({
        testConnection: vi.fn().mockResolvedValue(true),
      });

      mockPrisma.workspaceIntegration.update.mockResolvedValue({});

      const result = await service.testIntegration('int-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.workspaceIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        data: {
          status: 'CONNECTED',
          lastError: null,
          lastErrorAt: null,
        },
      });
    });

    it('should update status to ERROR on failed test', async () => {
      const { connectorRegistry } = await import('../src/connectors/registry.js');
      const { oauthService } = await import('../src/services/oauth.service.js');

      mockPrisma.workspaceIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        integrationType: { slug: 'slack' },
      });

      (oauthService.getValidTokens as any).mockRejectedValue(new Error('Token expired'));
      mockPrisma.workspaceIntegration.update.mockResolvedValue({});

      const result = await service.testIntegration('int-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
    });
  });

  describe('updateEnabledWidgets', () => {
    it('should update enabled widgets', async () => {
      const { connectorRegistry } = await import('../src/connectors/registry.js');

      mockPrisma.workspaceIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        integrationType: { slug: 'slack' },
      });

      (connectorRegistry.getOrThrow as any).mockReturnValue({
        supportedWidgets: [{ id: 'messages' }, { id: 'channels' }],
      });

      mockPrisma.workspaceIntegration.update.mockResolvedValue({});

      await service.updateEnabledWidgets('int-123', ['messages']);

      expect(mockPrisma.workspaceIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        data: { enabledWidgets: ['messages'] },
      });
    });

    it('should throw error for invalid widget IDs', async () => {
      const { connectorRegistry } = await import('../src/connectors/registry.js');

      mockPrisma.workspaceIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        integrationType: { slug: 'slack' },
      });

      (connectorRegistry.getOrThrow as any).mockReturnValue({
        supportedWidgets: [{ id: 'messages' }],
      });

      await expect(
        service.updateEnabledWidgets('int-123', ['invalid-widget'])
      ).rejects.toThrow('Invalid widget IDs');
    });
  });
});
