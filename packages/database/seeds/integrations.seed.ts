import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Integration types to seed
const integrationTypes = [
  // ============================================
  // COMMON INTEGRATIONS (All Roles)
  // ============================================
  {
    slug: 'slack',
    name: 'Slack',
    description: 'Team communication and collaboration platform',
    logoUrl: '/integrations/slack.svg',
    category: 'COMMUNICATION',
    applicableRoles: [
      'CTO',
      'CFO',
      'COO',
      'CMO',
      'CPO',
      'CHRO',
      'CLO',
      'CISO',
      'CDO',
      'CSO',
      'CRO',
    ],
    requiredScopes: ['channels:read', 'chat:write', 'users:read'],
    optionalScopes: ['channels:history', 'groups:read'],
    tier: 'BASIC',
    widgets: [
      {
        id: 'channel-activity',
        name: 'Channel Activity',
        description: 'Recent messages in key channels',
        refreshInterval: 60,
      },
      {
        id: 'team-presence',
        name: 'Team Presence',
        description: "Who's online and available",
        refreshInterval: 30,
      },
      {
        id: 'notifications',
        name: 'Notifications',
        description: 'Unread mentions and messages',
        refreshInterval: 30,
      },
    ],
  },
  {
    slug: 'google-calendar',
    name: 'Google Calendar',
    description: 'Calendar and scheduling management',
    logoUrl: '/integrations/google-calendar.svg',
    category: 'PRODUCTIVITY',
    applicableRoles: [
      'CTO',
      'CFO',
      'COO',
      'CMO',
      'CPO',
      'CHRO',
      'CLO',
      'CISO',
      'CDO',
      'CSO',
      'CRO',
    ],
    requiredScopes: ['calendar.readonly', 'calendar.events'],
    optionalScopes: ['calendar.settings.readonly'],
    tier: 'BASIC',
    widgets: [
      {
        id: 'upcoming-meetings',
        name: 'Upcoming Meetings',
        description: 'Your next scheduled meetings',
        refreshInterval: 300,
      },
      {
        id: 'today-schedule',
        name: "Today's Schedule",
        description: "Full view of today's calendar",
        refreshInterval: 300,
      },
      {
        id: 'availability',
        name: 'Availability',
        description: 'Your free/busy status',
        refreshInterval: 600,
      },
    ],
  },
  {
    slug: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Team collaboration and communication',
    logoUrl: '/integrations/teams.svg',
    category: 'COMMUNICATION',
    applicableRoles: [
      'CTO',
      'CFO',
      'COO',
      'CMO',
      'CPO',
      'CHRO',
      'CLO',
      'CISO',
      'CDO',
      'CSO',
      'CRO',
    ],
    requiredScopes: ['Team.ReadBasic.All', 'Chat.Read', 'User.Read'],
    optionalScopes: ['Channel.ReadBasic.All'],
    tier: 'BASIC',
    widgets: [
      {
        id: 'teams-chat',
        name: 'Recent Chats',
        description: 'Recent chat messages',
        refreshInterval: 60,
      },
      {
        id: 'teams-presence',
        name: 'Team Presence',
        description: 'Availability status',
        refreshInterval: 30,
      },
    ],
  },
  {
    slug: 'notion',
    name: 'Notion',
    description: 'Documentation and knowledge management',
    logoUrl: '/integrations/notion.svg',
    category: 'PRODUCTIVITY',
    applicableRoles: [
      'CTO',
      'CFO',
      'COO',
      'CMO',
      'CPO',
      'CHRO',
      'CLO',
      'CISO',
      'CDO',
      'CSO',
      'CRO',
    ],
    requiredScopes: [],
    optionalScopes: [],
    tier: 'BASIC',
    widgets: [
      {
        id: 'recent-pages',
        name: 'Recent Pages',
        description: 'Recently edited pages',
        refreshInterval: 300,
      },
      {
        id: 'database-view',
        name: 'Database View',
        description: 'Embedded database view',
        refreshInterval: 300,
      },
      {
        id: 'page-embed',
        name: 'Page Embed',
        description: 'Display specific page content',
        refreshInterval: 600,
      },
    ],
  },
  {
    slug: 'asana',
    name: 'Asana',
    description: 'Project and task management',
    logoUrl: '/integrations/asana.svg',
    category: 'PRODUCTIVITY',
    applicableRoles: [
      'CTO',
      'CFO',
      'COO',
      'CMO',
      'CPO',
      'CHRO',
      'CLO',
      'CISO',
      'CDO',
      'CSO',
      'CRO',
    ],
    requiredScopes: ['default'],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'my-tasks',
        name: 'My Tasks',
        description: 'Tasks assigned to you',
        refreshInterval: 180,
      },
      {
        id: 'project-status',
        name: 'Project Status',
        description: 'Project progress overview',
        refreshInterval: 300,
      },
    ],
  },

  // ============================================
  // CTO INTEGRATIONS
  // ============================================
  {
    slug: 'github',
    name: 'GitHub',
    description: 'Code hosting and version control',
    logoUrl: '/integrations/github.svg',
    category: 'DEVTOOLS',
    applicableRoles: ['CTO', 'CPO'],
    requiredScopes: ['repo', 'read:user'],
    optionalScopes: ['read:org'],
    tier: 'PRO',
    widgets: [
      {
        id: 'recent-commits',
        name: 'Recent Commits',
        description: 'Latest commits across repos',
        refreshInterval: 300,
      },
      {
        id: 'open-prs',
        name: 'Open Pull Requests',
        description: 'PRs awaiting review',
        refreshInterval: 180,
      },
      {
        id: 'issues',
        name: 'Issues',
        description: 'Open issues across repos',
        refreshInterval: 300,
      },
    ],
  },
  {
    slug: 'gitlab',
    name: 'GitLab',
    description: 'DevOps and version control platform',
    logoUrl: '/integrations/gitlab.svg',
    category: 'DEVTOOLS',
    applicableRoles: ['CTO', 'CPO'],
    requiredScopes: ['read_api', 'read_user'],
    optionalScopes: ['read_repository'],
    tier: 'PRO',
    widgets: [
      {
        id: 'merge-requests',
        name: 'Merge Requests',
        description: 'Open MRs awaiting review',
        refreshInterval: 180,
      },
      {
        id: 'pipeline-status',
        name: 'Pipeline Status',
        description: 'CI/CD pipeline health',
        refreshInterval: 120,
      },
    ],
  },
  {
    slug: 'jira',
    name: 'Jira',
    description: 'Issue tracking and project management',
    logoUrl: '/integrations/jira.svg',
    category: 'DEVTOOLS',
    applicableRoles: ['CTO', 'COO', 'CPO'],
    requiredScopes: ['read:jira-work', 'read:jira-user'],
    optionalScopes: ['offline_access'],
    tier: 'PRO',
    widgets: [
      {
        id: 'sprint-progress',
        name: 'Sprint Progress',
        description: 'Current sprint status',
        refreshInterval: 300,
      },
      {
        id: 'my-issues',
        name: 'My Issues',
        description: 'Issues assigned to you',
        refreshInterval: 180,
      },
      {
        id: 'velocity-chart',
        name: 'Velocity Chart',
        description: 'Team velocity over sprints',
        refreshInterval: 3600,
      },
    ],
  },
  {
    slug: 'datadog',
    name: 'Datadog',
    description: 'Infrastructure monitoring and APM',
    logoUrl: '/integrations/datadog.svg',
    category: 'DEVTOOLS',
    applicableRoles: ['CTO'],
    requiredScopes: ['dashboards_read', 'monitors_read'],
    optionalScopes: ['events_read'],
    tier: 'ENTERPRISE',
    widgets: [
      {
        id: 'system-health',
        name: 'System Health',
        description: 'Infrastructure health overview',
        refreshInterval: 60,
      },
      {
        id: 'active-alerts',
        name: 'Active Alerts',
        description: 'Current monitoring alerts',
        refreshInterval: 60,
      },
    ],
  },
  {
    slug: 'aws',
    name: 'AWS',
    description: 'Amazon Web Services cloud infrastructure',
    logoUrl: '/integrations/aws.svg',
    category: 'CLOUD',
    applicableRoles: ['CTO', 'CFO', 'CISO'],
    requiredScopes: [],
    optionalScopes: [],
    tier: 'ENTERPRISE',
    widgets: [
      {
        id: 'cost-explorer',
        name: 'Cost Explorer',
        description: 'AWS spending overview',
        refreshInterval: 3600,
      },
      {
        id: 'service-health',
        name: 'Service Health',
        description: 'AWS service status',
        refreshInterval: 300,
      },
    ],
  },

  // ============================================
  // CFO INTEGRATIONS
  // ============================================
  {
    slug: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting and financial management',
    logoUrl: '/integrations/quickbooks.svg',
    category: 'ACCOUNTING',
    applicableRoles: ['CFO', 'COO'],
    requiredScopes: ['com.intuit.quickbooks.accounting'],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'cash-flow',
        name: 'Cash Flow',
        description: 'Cash flow summary',
        refreshInterval: 3600,
      },
      {
        id: 'profit-loss',
        name: 'Profit & Loss',
        description: 'P&L statement',
        refreshInterval: 3600,
      },
      {
        id: 'invoices',
        name: 'Invoices',
        description: 'Outstanding invoices',
        refreshInterval: 1800,
      },
    ],
  },
  {
    slug: 'xero',
    name: 'Xero',
    description: 'Cloud-based accounting software',
    logoUrl: '/integrations/xero.svg',
    category: 'ACCOUNTING',
    applicableRoles: ['CFO', 'COO'],
    requiredScopes: ['accounting.transactions.read', 'accounting.reports.read'],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'bank-accounts',
        name: 'Bank Accounts',
        description: 'Account balances',
        refreshInterval: 1800,
      },
      {
        id: 'aged-receivables',
        name: 'Aged Receivables',
        description: 'Outstanding receivables',
        refreshInterval: 3600,
      },
    ],
  },
  {
    slug: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and revenue',
    logoUrl: '/integrations/stripe.svg',
    category: 'ACCOUNTING',
    applicableRoles: ['CFO', 'CRO'],
    requiredScopes: ['read_only'],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      { id: 'revenue', name: 'Revenue', description: 'Revenue metrics', refreshInterval: 1800 },
      {
        id: 'subscriptions',
        name: 'Subscriptions',
        description: 'Active subscriptions',
        refreshInterval: 1800,
      },
    ],
  },

  // ============================================
  // CMO INTEGRATIONS
  // ============================================
  {
    slug: 'google-analytics',
    name: 'Google Analytics',
    description: 'Web analytics and insights',
    logoUrl: '/integrations/google-analytics.svg',
    category: 'ANALYTICS',
    applicableRoles: ['CMO', 'CDO'],
    requiredScopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'traffic-overview',
        name: 'Traffic Overview',
        description: 'Website traffic metrics',
        refreshInterval: 1800,
      },
      {
        id: 'top-pages',
        name: 'Top Pages',
        description: 'Most visited pages',
        refreshInterval: 3600,
      },
    ],
  },
  {
    slug: 'hubspot',
    name: 'HubSpot',
    description: 'CRM and marketing automation',
    logoUrl: '/integrations/hubspot.svg',
    category: 'CRM',
    applicableRoles: ['CMO', 'CRO', 'CSO'],
    requiredScopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'deals-pipeline',
        name: 'Deals Pipeline',
        description: 'Sales pipeline overview',
        refreshInterval: 600,
      },
      {
        id: 'recent-contacts',
        name: 'Recent Contacts',
        description: 'Recently added contacts',
        refreshInterval: 600,
      },
    ],
  },
  {
    slug: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing platform',
    logoUrl: '/integrations/mailchimp.svg',
    category: 'MARKETING',
    applicableRoles: ['CMO'],
    requiredScopes: [],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'campaign-stats',
        name: 'Campaign Stats',
        description: 'Recent campaign performance',
        refreshInterval: 1800,
      },
      {
        id: 'audience-growth',
        name: 'Audience Growth',
        description: 'Subscriber growth',
        refreshInterval: 3600,
      },
    ],
  },

  // ============================================
  // CISO INTEGRATIONS
  // ============================================
  {
    slug: 'snyk',
    name: 'Snyk',
    description: 'Security vulnerability scanning',
    logoUrl: '/integrations/snyk.svg',
    category: 'SECURITY',
    applicableRoles: ['CISO', 'CTO'],
    requiredScopes: ['read'],
    optionalScopes: [],
    tier: 'ENTERPRISE',
    widgets: [
      {
        id: 'vulnerabilities',
        name: 'Vulnerabilities',
        description: 'Open security issues',
        refreshInterval: 1800,
      },
      {
        id: 'project-health',
        name: 'Project Health',
        description: 'Security score by project',
        refreshInterval: 3600,
      },
    ],
  },
  {
    slug: 'crowdstrike',
    name: 'CrowdStrike',
    description: 'Endpoint security platform',
    logoUrl: '/integrations/crowdstrike.svg',
    category: 'SECURITY',
    applicableRoles: ['CISO'],
    requiredScopes: ['read'],
    optionalScopes: [],
    tier: 'ENTERPRISE',
    widgets: [
      {
        id: 'threat-detection',
        name: 'Threat Detection',
        description: 'Active threat alerts',
        refreshInterval: 300,
      },
      {
        id: 'endpoint-status',
        name: 'Endpoint Status',
        description: 'Endpoint health overview',
        refreshInterval: 600,
      },
    ],
  },

  // ============================================
  // CHRO INTEGRATIONS
  // ============================================
  {
    slug: 'bamboohr',
    name: 'BambooHR',
    description: 'HR management software',
    logoUrl: '/integrations/bamboohr.svg',
    category: 'HR',
    applicableRoles: ['CHRO', 'COO'],
    requiredScopes: [],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'headcount',
        name: 'Headcount',
        description: 'Employee headcount metrics',
        refreshInterval: 3600,
      },
      { id: 'time-off', name: 'Time Off', description: 'Upcoming time off', refreshInterval: 1800 },
    ],
  },
  {
    slug: 'gusto',
    name: 'Gusto',
    description: 'Payroll and benefits platform',
    logoUrl: '/integrations/gusto.svg',
    category: 'HR',
    applicableRoles: ['CHRO', 'CFO'],
    requiredScopes: ['employees:read', 'payrolls:read'],
    optionalScopes: [],
    tier: 'PRO',
    widgets: [
      {
        id: 'payroll-summary',
        name: 'Payroll Summary',
        description: 'Recent payroll info',
        refreshInterval: 86400,
      },
    ],
  },
];

async function seedIntegrations(): Promise<void> {
  console.log('Seeding integration types...');

  for (const integration of integrationTypes) {
    const existing = await prisma.integrationType.findUnique({
      where: { slug: integration.slug },
    });

    if (existing) {
      console.log(`  Updating: ${integration.name}`);
      await prisma.integrationType.update({
        where: { slug: integration.slug },
        data: {
          name: integration.name,
          description: integration.description,
          logoUrl: integration.logoUrl,
          category: integration.category as any,
          applicableRoles: integration.applicableRoles as any[],
          requiredScopes: integration.requiredScopes,
          optionalScopes: integration.optionalScopes,
          tier: integration.tier as any,
          widgets: integration.widgets as any,
          isActive: true,
        },
      });
    } else {
      console.log(`  Creating: ${integration.name}`);
      await prisma.integrationType.create({
        data: {
          slug: integration.slug,
          name: integration.name,
          description: integration.description,
          logoUrl: integration.logoUrl,
          category: integration.category as any,
          applicableRoles: integration.applicableRoles as any[],
          requiredScopes: integration.requiredScopes,
          optionalScopes: integration.optionalScopes,
          tier: integration.tier as any,
          widgets: integration.widgets as any,
          isActive: true,
          isBeta: false,
        },
      });
    }
  }

  console.log(`Seeded ${integrationTypes.length} integration types.`);
}

export { seedIntegrations };

// Run if called directly
if (require.main === module) {
  seedIntegrations()
    .then(() => {
      console.log('Integration seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
