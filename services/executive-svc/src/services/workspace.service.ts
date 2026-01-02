/**
 * Workspace Service
 *
 * Manages executive workspaces including layout configuration,
 * widget management, pinned items, and SkillPod integration.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import type { ExecutiveWorkspace, ExecutiveType } from '@prisma/client';

// Types
export interface WidgetPosition {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetConfig {
  widgetId: string;
  config: Record<string, any>;
}

export interface PinnedDocument {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'doc' | 'spreadsheet' | 'presentation' | 'image' | 'other';
  pinnedAt: string;
}

export interface PinnedLink {
  id: string;
  name: string;
  url: string;
  pinnedAt: string;
}

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'role-specific' | 'integration';
  requiredIntegrations?: string[];
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  configSchema?: Record<string, any>;
}

// Available widgets registry
const WIDGET_REGISTRY: WidgetDefinition[] = [
  // General widgets
  {
    id: 'time-summary',
    name: 'Time Summary',
    description: 'Overview of hours logged this period',
    category: 'general',
    defaultSize: { width: 2, height: 1 },
  },
  {
    id: 'recent-activity',
    name: 'Recent Activity',
    description: 'Latest updates and activities',
    category: 'general',
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: 'milestones',
    name: 'Milestones',
    description: 'Track engagement milestones and deliverables',
    category: 'general',
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: 'quick-actions',
    name: 'Quick Actions',
    description: 'Frequently used actions and shortcuts',
    category: 'general',
    defaultSize: { width: 1, height: 1 },
  },
  // CTO widgets
  {
    id: 'tech-health',
    name: 'Tech Health',
    description: 'Technical debt, system health, deployment status',
    category: 'role-specific',
    requiredIntegrations: ['github'],
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: 'team-overview',
    name: 'Team Overview',
    description: 'Engineering team structure and capacity',
    category: 'role-specific',
    defaultSize: { width: 2, height: 1 },
  },
  {
    id: 'sprint-progress',
    name: 'Sprint Progress',
    description: 'Current sprint status and velocity',
    category: 'role-specific',
    requiredIntegrations: ['jira', 'linear'],
    defaultSize: { width: 2, height: 2 },
  },
  // CFO widgets
  {
    id: 'financial-overview',
    name: 'Financial Overview',
    description: 'Key financial metrics and trends',
    category: 'role-specific',
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: 'cashflow',
    name: 'Cash Flow',
    description: 'Cash flow projections and runway',
    category: 'role-specific',
    defaultSize: { width: 2, height: 1 },
  },
  {
    id: 'budget-tracker',
    name: 'Budget Tracker',
    description: 'Budget vs actual spending',
    category: 'role-specific',
    defaultSize: { width: 2, height: 2 },
  },
  // CMO widgets
  {
    id: 'marketing-metrics',
    name: 'Marketing Metrics',
    description: 'Key marketing KPIs',
    category: 'role-specific',
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: 'campaign-performance',
    name: 'Campaign Performance',
    description: 'Active campaign metrics',
    category: 'role-specific',
    defaultSize: { width: 2, height: 2 },
  },
  // Integration widgets
  {
    id: 'slack-activity',
    name: 'Slack Activity',
    description: 'Recent Slack messages and mentions',
    category: 'integration',
    requiredIntegrations: ['slack'],
    defaultSize: { width: 2, height: 2 },
  },
  {
    id: 'github-activity',
    name: 'GitHub Activity',
    description: 'Recent commits, PRs, and issues',
    category: 'integration',
    requiredIntegrations: ['github'],
    defaultSize: { width: 2, height: 2 },
  },
];

class WorkspaceService {
  /**
   * Get workspace for an engagement
   */
  async getWorkspace(
    engagementId: string,
    executiveId: string
  ): Promise<ExecutiveWorkspace | null> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { engagementId },
      include: {
        engagement: {
          select: {
            executiveId: true,
            role: true,
            status: true,
            connectedIntegrations: true,
          },
        },
      },
    });

    if (!workspace) {
      return null;
    }

    // Verify access
    if (workspace.engagement.executiveId !== executiveId) {
      throw new Error('Access denied to this workspace');
    }

    return workspace;
  }

  /**
   * Update workspace layout
   */
  async updateWorkspaceLayout(
    workspaceId: string,
    layout: WidgetPosition[]
  ): Promise<ExecutiveWorkspace> {
    // Validate layout structure
    for (const position of layout) {
      if (
        typeof position.x !== 'number' ||
        typeof position.y !== 'number' ||
        typeof position.width !== 'number' ||
        typeof position.height !== 'number'
      ) {
        throw new Error('Invalid layout structure');
      }
    }

    const updated = await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: {
        dashboardLayout: layout as any,
      },
    });

    logger.info({ workspaceId }, 'Workspace layout updated');

    return updated;
  }

  /**
   * Update widget configuration
   */
  async updateWidgetConfig(
    workspaceId: string,
    widgetId: string,
    config: Record<string, any>
  ): Promise<ExecutiveWorkspace> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Get existing configs
    const existingConfigs = (workspace.widgetConfigs as Record<string, any>) || {};

    // Update the specific widget config
    existingConfigs[widgetId] = config;

    const updated = await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: {
        widgetConfigs: existingConfigs,
      },
    });

    logger.info({ workspaceId, widgetId }, 'Widget config updated');

    return updated;
  }

  /**
   * Get available widgets for an executive type
   */
  getAvailableWidgets(executiveType: ExecutiveType): WidgetDefinition[] {
    // General widgets are always available
    const generalWidgets = WIDGET_REGISTRY.filter(
      (w) => w.category === 'general' || w.category === 'integration'
    );

    // Role-specific widgets based on executive type
    const roleWidgetIds = this.getRoleWidgetIds(executiveType);
    const roleWidgets = WIDGET_REGISTRY.filter(
      (w) => w.category === 'role-specific' && roleWidgetIds.includes(w.id)
    );

    return [...generalWidgets, ...roleWidgets];
  }

  /**
   * Enable a widget in the workspace
   */
  async enableWidget(workspaceId: string, widgetId: string): Promise<ExecutiveWorkspace> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
      include: {
        engagement: {
          include: { connectedIntegrations: true },
        },
      },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check if widget exists in registry
    const widgetDef = WIDGET_REGISTRY.find((w) => w.id === widgetId);
    if (!widgetDef) {
      throw new Error('Widget not found');
    }

    // Check required integrations
    if (widgetDef.requiredIntegrations?.length) {
      const connectedTypes = workspace.engagement.connectedIntegrations
        .filter((i) => i.status === 'CONNECTED')
        .map((i) => i.integrationType);

      const hasRequired = widgetDef.requiredIntegrations.some((req) =>
        connectedTypes.includes(req)
      );

      if (!hasRequired) {
        throw new Error(`Widget requires one of: ${widgetDef.requiredIntegrations.join(', ')}`);
      }
    }

    // Add to enabled widgets if not already there
    const enabledWidgets = workspace.enabledWidgets || [];
    if (!enabledWidgets.includes(widgetId)) {
      enabledWidgets.push(widgetId);
    }

    const updated = await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { enabledWidgets },
    });

    logger.info({ workspaceId, widgetId }, 'Widget enabled');

    return updated;
  }

  /**
   * Disable a widget in the workspace
   */
  async disableWidget(workspaceId: string, widgetId: string): Promise<ExecutiveWorkspace> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const enabledWidgets = (workspace.enabledWidgets || []).filter((id) => id !== widgetId);

    const updated = await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { enabledWidgets },
    });

    logger.info({ workspaceId, widgetId }, 'Widget disabled');

    return updated;
  }

  /**
   * Pin a document
   */
  async pinDocument(
    workspaceId: string,
    document: Omit<PinnedDocument, 'id' | 'pinnedAt'>
  ): Promise<ExecutiveWorkspace> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const pinnedDocuments = (workspace.pinnedDocuments as unknown as PinnedDocument[]) || [];

    // Max 10 pinned documents
    if (pinnedDocuments.length >= 10) {
      throw new Error('Maximum of 10 pinned documents allowed');
    }

    // Check for duplicates
    if (pinnedDocuments.some((d) => d.url === document.url)) {
      throw new Error('Document already pinned');
    }

    const newDoc: PinnedDocument = {
      id: crypto.randomUUID(),
      ...document,
      pinnedAt: new Date().toISOString(),
    };

    pinnedDocuments.push(newDoc);

    const updated = await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { pinnedDocuments: pinnedDocuments as any },
    });

    logger.info({ workspaceId, documentId: newDoc.id }, 'Document pinned');

    return updated;
  }

  /**
   * Unpin a document
   */
  async unpinDocument(workspaceId: string, documentId: string): Promise<ExecutiveWorkspace> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const pinnedDocuments = (
      (workspace.pinnedDocuments as unknown as PinnedDocument[]) || []
    ).filter((d) => d.id !== documentId);

    const updated = await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { pinnedDocuments: pinnedDocuments as any },
    });

    logger.info({ workspaceId, documentId }, 'Document unpinned');

    return updated;
  }

  /**
   * Pin a link
   */
  async pinLink(
    workspaceId: string,
    link: Omit<PinnedLink, 'id' | 'pinnedAt'>
  ): Promise<ExecutiveWorkspace> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const pinnedLinks = (workspace.pinnedLinks as unknown as PinnedLink[]) || [];

    if (pinnedLinks.length >= 10) {
      throw new Error('Maximum of 10 pinned links allowed');
    }

    const newLink: PinnedLink = {
      id: crypto.randomUUID(),
      ...link,
      pinnedAt: new Date().toISOString(),
    };

    pinnedLinks.push(newLink);

    const updated = await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { pinnedLinks: pinnedLinks as any },
    });

    return updated;
  }

  /**
   * Update recent files
   */
  async updateRecentFiles(
    workspaceId: string,
    file: { name: string; url: string; type: string }
  ): Promise<void> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return;
    }

    const recentFiles = (workspace.recentFiles as any[]) || [];

    // Remove if already exists
    const filtered = recentFiles.filter((f) => f.url !== file.url);

    // Add to front
    filtered.unshift({
      ...file,
      accessedAt: new Date().toISOString(),
    });

    // Keep only last 20
    const trimmed = filtered.slice(0, 20);

    await prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { recentFiles: trimmed },
    });
  }

  /**
   * Update executive notes
   */
  async updateExecutiveNotes(workspaceId: string, notes: string): Promise<ExecutiveWorkspace> {
    return prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { executiveNotes: notes },
    });
  }

  /**
   * Update client context
   */
  async updateClientContext(workspaceId: string, context: string): Promise<ExecutiveWorkspace> {
    return prisma.executiveWorkspace.update({
      where: { id: workspaceId },
      data: { clientContext: context },
    });
  }

  /**
   * Launch SkillPod session
   */
  async launchSkillPod(
    workspaceId: string,
    executiveId: string
  ): Promise<{ sessionUrl: string; sessionId: string }> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { id: workspaceId },
      include: {
        engagement: {
          select: {
            id: true,
            executiveId: true,
            clientTenantId: true,
            status: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Verify access
    if (workspace.engagement.executiveId !== executiveId) {
      throw new Error('Access denied');
    }

    // Verify engagement is active
    if (workspace.engagement.status !== 'ACTIVE') {
      throw new Error('Engagement must be active to launch SkillPod');
    }

    if (!workspace.skillpodEnabled) {
      throw new Error('SkillPod is not enabled for this workspace');
    }

    // TODO: Call SkillPod service to create session
    // This would integrate with skillpod-svc
    const sessionId = crypto.randomUUID();
    const sessionUrl = `${process.env.SKILLPOD_URL}/session/${sessionId}`;

    logger.info(
      {
        workspaceId,
        engagementId: workspace.engagementId,
        sessionId,
      },
      'SkillPod session launched'
    );

    return { sessionUrl, sessionId };
  }

  /**
   * Get role-specific widget IDs
   */
  private getRoleWidgetIds(role: ExecutiveType): string[] {
    const roleWidgets: Record<string, string[]> = {
      FRACTIONAL_CTO: ['tech-health', 'team-overview', 'sprint-progress'],
      FRACTIONAL_CFO: ['financial-overview', 'cashflow', 'budget-tracker'],
      FRACTIONAL_CMO: ['marketing-metrics', 'campaign-performance', 'pipeline'],
      FRACTIONAL_COO: ['operations-dashboard', 'kpi-tracker', 'process-health'],
      FRACTIONAL_CHRO: ['team-health', 'hiring-pipeline', 'engagement-scores'],
      FRACTIONAL_CPO: ['product-roadmap', 'feature-progress', 'user-metrics'],
      FRACTIONAL_CRO: ['revenue-metrics', 'sales-pipeline', 'forecast'],
      FRACTIONAL_CISO: ['security-posture', 'compliance-status', 'risk-matrix'],
      FRACTIONAL_CLO: ['legal-matters', 'contract-status', 'compliance'],
      FRACTIONAL_CDO: ['data-quality', 'analytics-dashboard', 'data-governance'],
      BOARD_ADVISOR: ['company-overview', 'key-metrics', 'strategic-initiatives'],
      INTERIM_EXECUTIVE: ['handover-status', 'key-priorities', 'team-overview'],
    };

    return roleWidgets[role] || [];
  }
}

export const workspaceService = new WorkspaceService();
