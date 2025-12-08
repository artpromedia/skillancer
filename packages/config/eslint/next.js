/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./react.js', 'next/core-web-vitals'],
  rules: {
    // Next.js specific
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-img-element': 'warn',

    // Allow default exports for pages and API routes
    'import/no-default-export': 'off',

    // Accessibility in Next.js
    'jsx-a11y/anchor-is-valid': [
      'error',
      {
        components: ['Link'],
        specialLink: ['hrefLeft', 'hrefRight'],
        aspects: ['invalidHref', 'preferButton'],
      },
    ],
  },
  overrides: [
    {
      // Allow default exports in pages, app router, and config files
      files: [
        'src/pages/**/*.tsx',
        'src/app/**/*.tsx',
        'app/**/*.tsx',
        'pages/**/*.tsx',
        '*.config.ts',
        '*.config.js',
        'middleware.ts',
      ],
      rules: {
        'import/no-default-export': 'off',
      },
    },
  ],
};
