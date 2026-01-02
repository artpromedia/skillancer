import type { ComponentType } from 'react';

// Widget metadata
export interface WidgetInfo {
  id: string;
  name: string;
  description: string;
  integration: string;
  integrationName: string;
  category: string;
  defaultConfig?: Record<string, unknown>;
  configSchema?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Widget component props
export interface WidgetComponentProps {
  integrationId: string;
  workspaceId: string;
  config?: Record<string, unknown>;
  onSettings?: () => void;
}

// Registry of all available widgets
const widgetRegistry: Record<string, ComponentType<WidgetComponentProps>> = {};

// Widget metadata registry
const widgetMetadata: Record<string, WidgetInfo> = {
  // Slack widgets
  'slack-channel-activity': {
    id: 'slack-channel-activity',
    name: 'Channel Activity',
    description: 'Recent messages in key channels',
    integration: 'slack',
    integrationName: 'Slack',
    category: 'COMMUNICATION',
  },
  'slack-team-presence': {
    id: 'slack-team-presence',
    name: 'Team Presence',
    description: "Who's online and available",
    integration: 'slack',
    integrationName: 'Slack',
    category: 'COMMUNICATION',
  },
  'slack-notifications': {
    id: 'slack-notifications',
    name: 'Notifications',
    description: 'Unread mentions and messages',
    integration: 'slack',
    integrationName: 'Slack',
    category: 'COMMUNICATION',
  },

  // Google Calendar widgets
  'google-calendar-upcoming': {
    id: 'google-calendar-upcoming',
    name: 'Upcoming Meetings',
    description: 'Your next scheduled meetings',
    integration: 'google-calendar',
    integrationName: 'Google Calendar',
    category: 'PRODUCTIVITY',
  },
  'google-calendar-today': {
    id: 'google-calendar-today',
    name: "Today's Schedule",
    description: "Full view of today's calendar",
    integration: 'google-calendar',
    integrationName: 'Google Calendar',
    category: 'PRODUCTIVITY',
  },
  'google-calendar-availability': {
    id: 'google-calendar-availability',
    name: 'Availability',
    description: 'Your free/busy status',
    integration: 'google-calendar',
    integrationName: 'Google Calendar',
    category: 'PRODUCTIVITY',
  },

  // Notion widgets
  'notion-recent-pages': {
    id: 'notion-recent-pages',
    name: 'Recent Pages',
    description: 'Recently edited pages',
    integration: 'notion',
    integrationName: 'Notion',
    category: 'PRODUCTIVITY',
  },
  'notion-database-view': {
    id: 'notion-database-view',
    name: 'Database View',
    description: 'Embedded database view',
    integration: 'notion',
    integrationName: 'Notion',
    category: 'PRODUCTIVITY',
    configSchema: {
      type: 'object',
      properties: {
        databaseId: { type: 'string', description: 'Notion database ID' },
      },
      required: ['databaseId'],
    },
  },
  'notion-page-embed': {
    id: 'notion-page-embed',
    name: 'Page Embed',
    description: 'Display specific page content',
    integration: 'notion',
    integrationName: 'Notion',
    category: 'PRODUCTIVITY',
    configSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Notion page ID' },
      },
      required: ['pageId'],
    },
  },

  // Jira widgets
  'jira-sprint-progress': {
    id: 'jira-sprint-progress',
    name: 'Sprint Progress',
    description: 'Current sprint status and burndown',
    integration: 'jira',
    integrationName: 'Jira',
    category: 'DEVTOOLS',
    configSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'Jira board ID' },
      },
      required: ['boardId'],
    },
  },
  'jira-my-issues': {
    id: 'jira-my-issues',
    name: 'My Issues',
    description: 'Issues assigned to you',
    integration: 'jira',
    integrationName: 'Jira',
    category: 'DEVTOOLS',
  },
  'jira-recent-activity': {
    id: 'jira-recent-activity',
    name: 'Recent Activity',
    description: 'Recent project activity',
    integration: 'jira',
    integrationName: 'Jira',
    category: 'DEVTOOLS',
  },
  'jira-velocity-chart': {
    id: 'jira-velocity-chart',
    name: 'Velocity Chart',
    description: 'Team velocity over sprints',
    integration: 'jira',
    integrationName: 'Jira',
    category: 'DEVTOOLS',
    configSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'Jira board ID' },
        sprintCount: { type: 'number', description: 'Number of sprints', default: 6 },
      },
      required: ['boardId'],
    },
  },
};

/**
 * Register a widget component
 */
export function registerWidget(
  widgetId: string,
  component: ComponentType<WidgetComponentProps>
): void {
  widgetRegistry[widgetId] = component;
}

/**
 * Get a widget component by ID
 */
export function getWidget(widgetId: string): ComponentType<WidgetComponentProps> | null {
  return widgetRegistry[widgetId] || null;
}

/**
 * Get widget metadata by ID
 */
export function getWidgetInfo(widgetId: string): WidgetInfo | null {
  return widgetMetadata[widgetId] || null;
}

/**
 * Get all widgets for a specific integration
 */
export function getWidgetsByIntegration(integrationSlug: string): WidgetInfo[] {
  return Object.values(widgetMetadata).filter((widget) => widget.integration === integrationSlug);
}

/**
 * Get all widgets for a specific category
 */
export function getWidgetsByCategory(category: string): WidgetInfo[] {
  return Object.values(widgetMetadata).filter((widget) => widget.category === category);
}

/**
 * Get all available widgets
 */
export function getAllWidgets(): WidgetInfo[] {
  return Object.values(widgetMetadata);
}

/**
 * Check if a widget requires configuration
 */
export function widgetRequiresConfig(widgetId: string): boolean {
  const info = widgetMetadata[widgetId];
  return !!info?.configSchema?.required?.length;
}

export default {
  registerWidget,
  getWidget,
  getWidgetInfo,
  getWidgetsByIntegration,
  getWidgetsByCategory,
  getAllWidgets,
  widgetRequiresConfig,
};
