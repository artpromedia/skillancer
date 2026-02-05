const base = require('./base');

module.exports = {
  ...base,
  env: {
    ...base.env,
    node: true,
  },
  rules: {
    ...base.rules,
    // Library-specific relaxations
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
