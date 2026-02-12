module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Formatting, missing semicolons, etc.
        'refactor', // Code refactoring
        'perf', // Performance improvements
        'test', // Adding tests
        'build', // Build system or dependencies
        'ci', // CI configuration
        'chore', // Maintenance
        'revert', // Revert changes
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'web',
        'web-market',
        'web-cockpit',
        'web-skillpod',
        'mobile',
        'api-gateway',
        'auth-svc',
        'billing-svc',
        'market-svc',
        'skillpod-svc',
        'cockpit-svc',
        'notification-svc',
        'audit-svc',
        'service-template',
        'ui',
        'types',
        'utils',
        'config',
        'database',
        'cache',
        'api-client',
        'infra',
        'docs',
        'deps',
        'release',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
  },
};
