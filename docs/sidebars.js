// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // Getting Started sidebar
  gettingStarted: [
    {
      type: 'doc',
      id: 'getting-started/index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Setup',
      collapsed: false,
      items: [
        'getting-started/prerequisites',
        'getting-started/installation',
        'getting-started/project-structure',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'getting-started/workflow',
        'getting-started/testing',
        'getting-started/debugging',
        'getting-started/code-generation',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'getting-started/contributing',
        'getting-started/code-style',
        'getting-started/pull-requests',
      ],
    },
  ],

  // Architecture sidebar
  architecture: [
    {
      type: 'doc',
      id: 'architecture/index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'System Design',
      items: [
        'architecture/system-overview',
        'architecture/data-flow',
        'architecture/security',
        'architecture/multi-tenancy',
      ],
    },
    {
      type: 'category',
      label: 'Backend',
      items: [
        'architecture/backend/services',
        'architecture/backend/database',
        'architecture/backend/caching',
        'architecture/backend/messaging',
      ],
    },
    {
      type: 'category',
      label: 'Frontend',
      items: [
        'architecture/frontend/apps',
        'architecture/frontend/components',
        'architecture/frontend/state-management',
      ],
    },
    {
      type: 'category',
      label: 'Infrastructure',
      items: [
        'architecture/infrastructure/aws',
        'architecture/infrastructure/kubernetes',
        'architecture/infrastructure/ci-cd',
      ],
    },
    {
      type: 'category',
      label: 'ADRs',
      link: {
        type: 'doc',
        id: 'architecture/adr/index',
      },
      items: [
        'architecture/adr/template',
        'architecture/adr/001-monorepo-structure',
        'architecture/adr/002-fastify-backend',
        'architecture/adr/003-nextjs-frontend',
        'architecture/adr/004-prisma-orm',
      ],
    },
  ],

  // API Reference sidebar
  api: [
    {
      type: 'doc',
      id: 'api/index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Authentication',
      items: [
        'api/auth/overview',
        'api/auth/login',
        'api/auth/register',
        'api/auth/oauth',
        'api/auth/tokens',
      ],
    },
    {
      type: 'category',
      label: 'Market',
      items: [
        'api/market/overview',
        'api/market/jobs',
        'api/market/proposals',
        'api/market/contracts',
        'api/market/services',
      ],
    },
    {
      type: 'category',
      label: 'SkillPod',
      items: [
        'api/skillpod/overview',
        'api/skillpod/sessions',
        'api/skillpod/pods',
        'api/skillpod/workspaces',
      ],
    },
    {
      type: 'category',
      label: 'Billing',
      items: [
        'api/billing/overview',
        'api/billing/payments',
        'api/billing/subscriptions',
        'api/billing/invoices',
      ],
    },
    {
      type: 'category',
      label: 'Common',
      items: [
        'api/common/errors',
        'api/common/pagination',
        'api/common/filtering',
        'api/common/rate-limiting',
      ],
    },
  ],

  // Runbooks sidebar
  runbooks: [
    {
      type: 'doc',
      id: 'runbooks/index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'runbooks/deployment/production',
        'runbooks/deployment/staging',
        'runbooks/deployment/rollback',
        'runbooks/deployment/migrations',
      ],
    },
    {
      type: 'category',
      label: 'Incident Response',
      items: [
        'runbooks/incidents/overview',
        'runbooks/incidents/high-error-rate',
        'runbooks/incidents/database-issues',
        'runbooks/incidents/service-down',
        'runbooks/incidents/security-breach',
      ],
    },
    {
      type: 'category',
      label: 'Maintenance',
      items: [
        'runbooks/maintenance/secret-rotation',
        'runbooks/maintenance/scaling',
        'runbooks/maintenance/database',
        'runbooks/maintenance/cache',
      ],
    },
    {
      type: 'category',
      label: 'Monitoring',
      items: [
        'runbooks/monitoring/dashboards',
        'runbooks/monitoring/alerts',
        'runbooks/monitoring/logs',
        'runbooks/monitoring/traces',
      ],
    },
  ],
};

module.exports = sidebars;
