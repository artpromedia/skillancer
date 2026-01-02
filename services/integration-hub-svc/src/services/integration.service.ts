// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/services/integration
 * Integration Service - Manages integration lifecycle, data fetching, and sync
 */

import { prisma } from '@skillancer/database';
import type { ExecutiveType } from '@skillancer/database';
import { connectorRegistry } from '../connectors/registry.js';
import { oauthService } from './oauth.service.js';
import { cacheService } from './cache.service.js';
import type { ConnectorInfo, IntegrationCategory, WidgetData } from '../types/index.js';
import { IntegrationError } from '../types/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrationListItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl?: string;
  category: IntegrationCategory;
  tier: string;
  isBeta: boolean;
  isConnected: boolean;
  connectionStatus?: string;
  lastSyncAt?: Date;
  enabledWidgetsCount?: number;
}

export interface IntegrationDetails {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl?: string;
  category: IntegrationCategory;
  tier: string;
  isBeta: boolean;
  widgets: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  }>;
  connection?: {
    id: string;
    status: string;
    connectedAt?: Date;
    lastSyncAt?: Date;
    error?: string;
  };
}

export interface WorkspaceIntegrationStatus {
  integrationId: string;
  connectorSlug: string;
  name: string;
  status: string;
  connectedAt?: Date;
  lastSyncAt?: Date;
  syncStatus: string;
  error?: string;
  enabledWidgets: string[];
}

// ============================================================================
// INTEGRATION SERVICE
// ============================================================================

export class IntegrationService {
  /**
   * Get available integrations for a given executive type
   */
  async getAvailableIntegrations(
    workspaceId?: string,
    executiveType?: ExecutiveType,
    category?: IntegrationCategory
  ): Promise<IntegrationListItem[]> {
    // Get all connectors
    let connectors = connectorRegistry.getAll();

    // Filter by executive type
    if (executiveType) {
      connectors = connectors.filter((c) => c.applicableRoles.includes(executiveType));
    }

    // Filter by category
    if (category) {
      connectors = connectors.filter((c) => c.category === category);
    }

    // Get workspace connections if provided
    let connectionsBySlug = new Map<
      string,
      { status: string; lastSyncAt?: Date; enabledWidgets: string[] }
    >();

    if (workspaceId) {
      const connections = await prisma.workspaceIntegration.findMany({
        where: { workspaceId },
        include: { integrationType: true },
      });

      for (const conn of connections) {
        connectionsBySlug.set(conn.integrationType.slug, {
          status: conn.status,
          lastSyncAt: conn.lastSyncAt ?? undefined,
          enabledWidgets: conn.enabledWidgets,
        });
      }
    }

    return connectors.map((c) => {
      const connection = connectionsBySlug.get(c.slug);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        logoUrl: c.logoUrl,
        category: c.category,
        tier: c.tier,
        isBeta: c.isBeta ?? false,
        isConnected: connection?.status === 'CONNECTED',
        connectionStatus: connection?.status,
        lastSyncAt: connection?.lastSyncAt,
        enabledWidgetsCount: connection?.enabledWidgets.length,
      };
    });
  }

  /**
   * Get detailed information about an integration
   */
  async getIntegrationDetails(slug: string, workspaceId?: string): Promise<IntegrationDetails> {
    const connector = connectorRegistry.get(slug);

    if (!connector) {
      throw new IntegrationError(`Integration not found: ${slug}`, 'NOT_FOUND', 404);
    }

    const info = connector.getInfo();

    let connection: IntegrationDetails['connection'];
    let enabledWidgetIds: string[] = [];

    if (workspaceId) {
      const integrationType = await prisma.integrationType.findUnique({
        where: { slug },
      });

      if (integrationType) {
        const wsIntegration = await prisma.workspaceIntegration.findUnique({
          where: {
            workspaceId_integrationTypeId: {
              workspaceId,
              integrationTypeId: integrationType.id,
            },
          },
        });

        if (wsIntegration) {
          connection = {
            id: wsIntegration.id,
            status: wsIntegration.status,
            connectedAt: wsIntegration.connectedAt ?? undefined,
            lastSyncAt: wsIntegration.lastSyncAt ?? undefined,
            error: wsIntegration.lastError ?? undefined,
          };
          enabledWidgetIds = wsIntegration.enabledWidgets;
        }
      }
    }

    return {
      id: info.id,
      slug: info.slug,
      name: info.name,
      description: info.description,
      logoUrl: info.logoUrl,
      category: info.category,
      tier: info.tier,
      isBeta: info.isBeta ?? false,
      widgets: info.supportedWidgets.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        enabled: enabledWidgetIds.includes(w.id),
      })),
      connection,
    };
  }

  /**
   * Connect an integration (initiate OAuth)
   */
  async connectIntegration(
    workspaceId: string,
    connectorSlug: string,
    userId: string,
    scopes?: string[]
  ): Promise<{ authorizationUrl: string }> {
    // Verify connector exists
    const connector = connectorRegistry.get(connectorSlug);
    if (!connector) {
      throw new IntegrationError(`Integration not found: ${connectorSlug}`, 'NOT_FOUND', 404);
    }

    // Verify workspace exists
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new IntegrationError(`Workspace not found: ${workspaceId}`, 'NOT_FOUND', 404);
    }

    // Initiate OAuth
    const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:3006'}/oauth/callback/${connectorSlug}`;
    const { authorizationUrl } = await oauthService.initiateOAuth(
      workspaceId,
      connectorSlug,
      redirectUri,
      userId,
      scopes
    );

    return { authorizationUrl };
  }

  /**
   * Disconnect an integration
   */
  async disconnectIntegration(integrationId: string, userId: string): Promise<void> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { workspace: { include: { engagement: true } } },
    });

    if (!integration) {
      throw new IntegrationError('Integration not found', 'NOT_FOUND', 404);
    }

    // Revoke OAuth and clean up
    await oauthService.revokeIntegration(integrationId);

    // Clear cached data
    await cacheService.invalidateIntegration(integrationId);
  }

  /**
   * Get all integrations for a workspace
   */
  async getWorkspaceIntegrations(workspaceId: string): Promise<WorkspaceIntegrationStatus[]> {
    const integrations = await prisma.workspaceIntegration.findMany({
      where: { workspaceId },
      include: { integrationType: true },
    });

    return integrations.map((i) => ({
      integrationId: i.id,
      connectorSlug: i.integrationType.slug,
      name: i.integrationType.name,
      status: i.status,
      connectedAt: i.connectedAt ?? undefined,
      lastSyncAt: i.lastSyncAt ?? undefined,
      syncStatus: i.syncStatus,
      error: i.lastError ?? undefined,
      enabledWidgets: i.enabledWidgets,
    }));
  }

  /**
   * Test an integration's connection
   */
  async testIntegration(integrationId: string): Promise<{ success: boolean; error?: string }> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new IntegrationError('Integration not found', 'NOT_FOUND', 404);
    }

    const connector = connectorRegistry.getOrThrow(integration.integrationType.slug);

    try {
      const tokens = await oauthService.getValidTokens(integrationId);
      const success = await connector.testConnection(tokens);

      if (success) {
        await prisma.workspaceIntegration.update({
          where: { id: integrationId },
          data: {
            status: 'CONNECTED',
            lastError: null,
            lastErrorAt: null,
          },
        });
      }

      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.workspaceIntegration.update({
        where: { id: integrationId },
        data: {
          status: 'ERROR',
          lastError: errorMessage,
          lastErrorAt: new Date(),
        },
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get widget data from an integration
   */
  async getWidgetData(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>,
    bypassCache?: boolean
  ): Promise<WidgetData> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new IntegrationError('Integration not found', 'NOT_FOUND', 404);
    }

    if (integration.status !== 'CONNECTED') {
      throw new IntegrationError('Integration is not connected', 'NOT_CONNECTED', 400);
    }

    if (!integration.enabledWidgets.includes(widgetId)) {
      throw new IntegrationError(
        'Widget is not enabled for this integration',
        'WIDGET_DISABLED',
        400
      );
    }

    const connector = connectorRegistry.getOrThrow(integration.integrationType.slug);

    // Check cache first (unless bypassed)
    if (!bypassCache) {
      const cached = await cacheService.getWidgetData(integrationId, widgetId, params);
      if (cached) {
        return { ...cached, data: cached.data };
      }
    }

    // Get fresh data
    const tokens = await oauthService.getValidTokens(integrationId);
    const widgetData = await connector.getWidgetData(tokens, widgetId, params);

    // Cache the result
    const widgetDef = connector.supportedWidgets.find((w) => w.id === widgetId);
    if (widgetDef && widgetDef.refreshInterval > 0) {
      await cacheService.setWidgetData(
        integrationId,
        widgetId,
        params,
        widgetData,
        widgetDef.refreshInterval
      );
    }

    return widgetData;
  }

  /**
   * Trigger a sync for an integration
   */
  async syncIntegration(integrationId: string): Promise<void> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new IntegrationError('Integration not found', 'NOT_FOUND', 404);
    }

    const connector = connectorRegistry.getOrThrow(integration.integrationType.slug);

    // Update sync status
    await prisma.workspaceIntegration.update({
      where: { id: integrationId },
      data: { syncStatus: 'SYNCING' },
    });

    // Create sync log
    const syncLog = await prisma.integrationSyncLog.create({
      data: {
        integrationId,
        syncType: 'manual',
        status: 'started',
      },
    });

    try {
      // Get valid tokens
      const tokens = await oauthService.getValidTokens(integrationId);

      // Sync all enabled widgets
      let itemsSynced = 0;
      for (const widgetId of integration.enabledWidgets) {
        try {
          const data = await connector.getWidgetData(tokens, widgetId);
          const widgetDef = connector.supportedWidgets.find((w) => w.id === widgetId);
          if (widgetDef) {
            await cacheService.setWidgetData(
              integrationId,
              widgetId,
              undefined,
              data,
              widgetDef.refreshInterval
            );
          }
          itemsSynced++;
        } catch (error) {
          console.warn(`Failed to sync widget ${widgetId}:`, error);
        }
      }

      // Update sync status
      await prisma.workspaceIntegration.update({
        where: { id: integrationId },
        data: {
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
          syncError: null,
        },
      });

      // Complete sync log
      await prisma.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          itemsSynced,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update sync status
      await prisma.workspaceIntegration.update({
        where: { id: integrationId },
        data: {
          syncStatus: 'FAILED',
          syncError: errorMessage,
        },
      });

      // Complete sync log with error
      await prisma.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage,
        },
      });

      throw error;
    }
  }

  /**
   * Update enabled widgets for an integration
   */
  async updateEnabledWidgets(integrationId: string, widgetIds: string[]): Promise<void> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new IntegrationError('Integration not found', 'NOT_FOUND', 404);
    }

    const connector = connectorRegistry.getOrThrow(integration.integrationType.slug);

    // Validate widget IDs
    const validWidgetIds = connector.supportedWidgets.map((w) => w.id);
    const invalidIds = widgetIds.filter((id) => !validWidgetIds.includes(id));

    if (invalidIds.length > 0) {
      throw new IntegrationError(
        `Invalid widget IDs: ${invalidIds.join(', ')}`,
        'INVALID_WIDGETS',
        400
      );
    }

    await prisma.workspaceIntegration.update({
      where: { id: integrationId },
      data: { enabledWidgets: widgetIds },
    });
  }

  /**
   * Update integration configuration
   */
  async updateIntegrationConfig(
    integrationId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    await prisma.workspaceIntegration.update({
      where: { id: integrationId },
      data: { config },
    });
  }
}

// Export singleton instance
export const integrationService = new IntegrationService();

