/**
 * CTO Widget Registry - Exports all CTO-specific widgets
 */

// Deploy & CI/CD
export { DeployHealthWidget } from './deploy-health.widget';

// Cloud Cost Management
export { CloudSpendWidget } from './cloud-spend.widget';

// Security & Vulnerabilities
export { SecurityAlertsWidget } from './security-alerts.widget';

// Widget type definitions for dynamic loading
export const CTO_WIDGETS = {
  'deploy-health': {
    id: 'deploy-health',
    name: 'Deploy Health',
    description: 'CI/CD pipeline and deployment status',
    integrations: ['github', 'gitlab', 'circleci', 'jenkins'],
    component: 'DeployHealthWidget',
    refreshInterval: 120,
  },
  'cloud-spend': {
    id: 'cloud-spend',
    name: 'Cloud Spend',
    description: 'Cloud infrastructure costs and trends',
    integrations: ['aws', 'gcp', 'azure'],
    component: 'CloudSpendWidget',
    refreshInterval: 3600,
  },
  'security-alerts': {
    id: 'security-alerts',
    name: 'Security Alerts',
    description: 'Vulnerability and security issue tracking',
    integrations: ['snyk', 'dependabot', 'sonarqube'],
    component: 'SecurityAlertsWidget',
    refreshInterval: 300,
  },
  'recent-commits': {
    id: 'recent-commits',
    name: 'Recent Commits',
    description: 'Latest code commits across repositories',
    integrations: ['github', 'gitlab', 'bitbucket'],
    component: 'RecentCommitsWidget',
    refreshInterval: 300,
  },
  'pull-requests': {
    id: 'pull-requests',
    name: 'Pull Requests',
    description: 'Open PRs and code review status',
    integrations: ['github', 'gitlab', 'bitbucket'],
    component: 'PullRequestsWidget',
    refreshInterval: 180,
  },
  'tech-debt': {
    id: 'tech-debt',
    name: 'Tech Debt',
    description: 'Code quality and technical debt metrics',
    integrations: ['sonarqube', 'codeclimate'],
    component: 'TechDebtWidget',
    refreshInterval: 3600,
  },
  roadmap: {
    id: 'roadmap',
    name: 'Technical Roadmap',
    description: 'Initiative progress and milestones',
    integrations: ['jira', 'github'],
    component: 'RoadmapWidget',
    refreshInterval: 600,
  },
} as const;

export type CTOWidgetId = keyof typeof CTO_WIDGETS;

export function getCTOWidgetConfig(widgetId: string) {
  return CTO_WIDGETS[widgetId as CTOWidgetId];
}

export function getAvailableCTOWidgets(connectedIntegrations: string[]) {
  return Object.values(CTO_WIDGETS).filter((widget) =>
    widget.integrations.some((integration) => connectedIntegrations.includes(integration))
  );
}
